import { randomUUID } from 'node:crypto';
import { Attempt } from '../domain/Attempt.js';
import { Evaluation } from '../domain/Evaluation.js';
import { Submission } from '../domain/Submission.js';
import { CitationVerifier } from '../domain/CitationVerifier.js';
import { Feedback } from '../domain/Feedback.js';
import type { Problem } from '../domain/Problem.js';
import type { Rubric } from '../domain/Rubric.js';
import type { AttemptRepository, EvaluationRepository, ProblemRepository } from '../domain/ports/Repository.js';
import type { FormatAdapter } from '../domain/ports/FormatAdapter.js';
import type {
  Evaluator,
  EvaluationRecorder,
  EvaluationOutcome,
  ProblemContext,
} from '../domain/ports/Evaluator.js';
import type { DesignDocument } from '../domain/DesignDocument.js';

export type SubmitOutcome =
  | { kind: 'accepted'; attemptId: string; evaluationIds: string[] }
  | { kind: 'idempotentReplay'; attemptId: string; evaluationIds: string[] }
  | { kind: 'conflict'; message: string }
  | { kind: 'rejected'; missingSections: string[]; emptySections: string[] };

/**
 * Wires attempts, evaluators and the Evaluation lifecycle together. Only this
 * class (via Evaluation's own methods) ever moves an Evaluation's state —
 * evaluators just report outcomes back through `record()`.
 */
export class EvaluationOrchestrator implements EvaluationRecorder {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly attempts: AttemptRepository,
    private readonly evaluations: EvaluationRepository,
    private readonly problems: ProblemRepository,
    private readonly formatAdapters: Map<string, FormatAdapter>,
    private readonly evaluators: Evaluator[],
    private readonly rubricFor: (problem: Problem) => Rubric,
    private readonly timeoutMs: number,
  ) {}

  async startAttempt(learnerId: string, problemId: string): Promise<Attempt> {
    const attempt = new Attempt(randomUUID(), learnerId, problemId, new Date());
    await this.attempts.save(attempt);
    return attempt;
  }

  async submitAttempt(attemptId: string, rawContent: string, format: string): Promise<SubmitOutcome> {
    const attempt = await this.attempts.findById(attemptId);
    if (!attempt) throw new Error(`attempt not found: ${attemptId}`);

    const adapter = this.formatAdapters.get(format);
    if (!adapter) throw new Error(`unsupported format: ${format}`);
    const document = adapter.parse(rawContent);

    const missingSections = document.missingRequiredSections();
    const emptySections = document.emptyRequiredSections();
    if (missingSections.length > 0 || emptySections.length > 0) {
      return { kind: 'rejected', missingSections, emptySections };
    }

    const submission = Submission.create(rawContent, format, document, new Date());
    const result = attempt.submit(submission);

    if (result.kind === 'conflict') {
      return { kind: 'conflict', message: result.message };
    }
    if (result.kind === 'idempotentReplay') {
      const existing = await this.evaluations.findByAttemptId(attemptId);
      return { kind: 'idempotentReplay', attemptId, evaluationIds: existing.map((e) => e.id) };
    }

    // 'accepted' — persist the durable evidence before any evaluator runs.
    await this.attempts.save(attempt);

    const problem = await this.problems.findById(attempt.problemId);
    if (!problem) throw new Error(`problem not found: ${attempt.problemId}`);
    const rubric = this.rubricFor(problem);
    const context = this.contextFor(problem);

    const evaluationIds: string[] = [];
    for (const evaluator of this.evaluators) {
      const evaluation = await this.launchEvaluation(attempt.id, evaluator, document, rubric, context);
      evaluationIds.push(evaluation.id);
    }

    return { kind: 'accepted', attemptId: attempt.id, evaluationIds };
  }

  async retryEvaluation(attemptId: string, evaluatorId: string): Promise<{ evaluationId: string }> {
    const attempt = await this.attempts.findById(attemptId);
    if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
    const submission = attempt.getSubmission();
    if (!submission) throw new Error(`attempt ${attemptId} has no submission`);

    const problem = await this.problems.findById(attempt.problemId);
    if (!problem) throw new Error(`problem not found: ${attempt.problemId}`);
    const rubric = this.rubricFor(problem);

    const evaluator = this.evaluators.find((e) => e.id === evaluatorId);
    if (!evaluator) throw new Error(`unknown evaluator: ${evaluatorId}`);

    const evaluation = await this.launchEvaluation(
      attempt.id,
      evaluator,
      submission.document,
      rubric,
      this.contextFor(problem),
    );
    return { evaluationId: evaluation.id };
  }

  async record(evaluationId: string, outcome: EvaluationOutcome): Promise<void> {
    const timer = this.timers.get(evaluationId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(evaluationId);
    }

    const evaluation = await this.evaluations.findById(evaluationId);
    if (!evaluation) return; // unknown evaluation — nothing to record against

    const state = evaluation.getState();
    if (state === 'Completed' || state === 'Failed') return; // already terminal — no-op, guards races (e.g. a late timeout)

    if (outcome.kind === 'failed') {
      evaluation.fail(outcome.reason);
      await this.evaluations.save(evaluation);
      return;
    }

    const attempt = await this.attempts.findById(evaluation.attemptId);
    if (!attempt) throw new Error(`attempt not found for evaluation ${evaluationId}`);
    const submission = attempt.getSubmission();
    if (!submission) throw new Error(`attempt ${attempt.id} has no submission`);
    const problem = await this.problems.findById(attempt.problemId);
    if (!problem) throw new Error(`problem not found: ${attempt.problemId}`);
    const rubric = this.rubricFor(problem);

    const verifiedCriteria = CitationVerifier.verify(outcome.criteria, submission.document);
    const feedback = Feedback.build(outcome.summary, verifiedCriteria, rubric);
    evaluation.complete(feedback);
    await this.evaluations.save(evaluation);
  }

  async sweepStrandedEvaluations(): Promise<void> {
    const running = await this.evaluations.findAllRunning();
    for (const evaluation of running) {
      evaluation.markInterrupted();
      await this.evaluations.save(evaluation);
    }
  }

  private contextFor(problem: Problem): ProblemContext {
    return { problemId: problem.id, requirements: problem.requirements, scopeBoundary: problem.scopeBoundary };
  }

  /** Pending -> persist -> Running -> persist -> arm timeout -> fire evaluator.start(), without awaiting it. */
  private async launchEvaluation(
    attemptId: string,
    evaluator: Evaluator,
    document: DesignDocument,
    rubric: Rubric,
    context: ProblemContext,
  ): Promise<Evaluation> {
    const evaluation = new Evaluation(randomUUID(), attemptId, evaluator.id, rubric.version, new Date());
    await this.evaluations.save(evaluation);

    evaluation.markRunning();
    await this.evaluations.save(evaluation);

    this.timers.set(
      evaluation.id,
      setTimeout(() => {
        void this.record(evaluation.id, { kind: 'failed', reason: 'timeout' });
      }, this.timeoutMs),
    );

    evaluator.start(evaluation.id, document, rubric, context, this);

    return evaluation;
  }
}
