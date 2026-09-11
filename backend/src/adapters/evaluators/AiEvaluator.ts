import type { DesignDocument } from '../../domain/DesignDocument.js';
import type { Rubric } from '../../domain/Rubric.js';
import type { LlmClient } from '../../domain/ports/LlmClient.js';
import type {
  Evaluator, EvaluationRecorder, ProblemContext, RawCriterionFeedback,
} from '../../domain/ports/Evaluator.js';
import { FeedbackResponseSchema, FEEDBACK_JSON_SCHEMA } from './feedbackSchema.js';
import { buildPrompt } from './promptBuilder.js';

const MAX_COMPLETION_TOKENS = 4000;
const SCHEMA_NAME = 'Feedback';

/**
 * Real, LLM-backed Evaluator. Never abstains (score is always 0-4, confidence
 * is never 'none' — those are rule-based-only concepts). Retries on a
 * malformed response (failed Zod validation) or a thrown LlmClient error, up
 * to `1 + maxRetries` total attempts, before reporting failure.
 */
export class AiEvaluator implements Evaluator {
  readonly id = 'ai';

  constructor(private readonly llmClient: LlmClient, private readonly maxRetries: number) {}

  start(
    evaluationId: string, document: DesignDocument, rubric: Rubric,
    context: ProblemContext, recorder: EvaluationRecorder,
  ): void {
    // Fire-and-forget per the Evaluator port — report asynchronously via recorder.
    void this.run(evaluationId, document, rubric, context, recorder);
  }

  private async run(
    evaluationId: string, document: DesignDocument, rubric: Rubric,
    context: ProblemContext, recorder: EvaluationRecorder,
  ): Promise<void> {
    const { systemPrompt, userPrompt } = buildPrompt(document, rubric, context);
    const totalAttempts = 1 + this.maxRetries;

    // recorder.record is called exactly once, after this loop — never inside
    // it. Keeping it out of the try/catch below matters: recorder.record can
    // itself throw/reject (real repository I/O), and that must never be
    // mistaken for "malformed AI response" and retried — doing so would both
    // burn a needless paid LLM call and risk calling record() a second time
    // if a later attempt then succeeds.
    let result: { summary: string; criteria: RawCriterionFeedback[] } | undefined;

    for (let attempt = 0; attempt < totalAttempts && !result; attempt++) {
      try {
        const raw = await this.llmClient.completeJson({
          systemPrompt, userPrompt,
          jsonSchema: FEEDBACK_JSON_SCHEMA, schemaName: SCHEMA_NAME,
          maxCompletionTokens: MAX_COMPLETION_TOKENS,
        });
        const parsed = FeedbackResponseSchema.safeParse(raw);
        if (parsed.success) {
          const criteria: RawCriterionFeedback[] = parsed.data.criteria.map((c) => ({
            criterion: c.criterion, score: c.score, evidence: c.evidence, strength: c.strength,
            concern: c.concern, whyItMatters: c.whyItMatters, suggestion: c.suggestion,
            confidence: c.confidence,
          }));
          result = { summary: parsed.data.summary, criteria };
        }
      } catch {
        // Thrown LlmClient errors count toward the same retry budget as a validation failure.
      }
    }

    if (result) {
      await recorder.record(evaluationId, { kind: 'completed', summary: result.summary, criteria: result.criteria });
      return;
    }

    await recorder.record(evaluationId, { kind: 'failed', reason: 'invalid AI response after retries' });
  }
}
