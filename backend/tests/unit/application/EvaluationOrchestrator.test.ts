import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvaluationOrchestrator } from '../../../src/application/EvaluationOrchestrator.js';
import { FakeEvaluator } from '../../../src/adapters/evaluators/FakeEvaluator.js';
import { MarkdownFormatAdapter } from '../../../src/adapters/format/MarkdownFormatAdapter.js';
import { Attempt } from '../../../src/domain/Attempt.js';
import { Problem } from '../../../src/domain/Problem.js';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type AnchorScore, type Dimension } from '../../../src/domain/types.js';

const VALID_MARKDOWN = `
# Requirements & Assumptions
text
# Classes & Responsibilities
text
# Relationships & Interactions
text
# Key Behaviour & Rules
text
# Edge Cases & Testability
text
# Trade-offs & Extensibility
text
`;

function inMemoryRepos() {
  const attemptsStore = new Map<string, Attempt>();
  const evaluationsStore = new Map<string, any>();
  return {
    attempts: {
      save: vi.fn(async (a: Attempt) => attemptsStore.set(a.id, a)),
      findById: vi.fn(async (id: string) => attemptsStore.get(id) ?? null),
      findByLearnerAndProblem: vi.fn(async () => []),
      findByLearner: vi.fn(async () => []),
    },
    evaluations: {
      save: vi.fn(async (e: any) => evaluationsStore.set(e.id, e)),
      findById: vi.fn(async (id: string) => evaluationsStore.get(id) ?? null),
      findByAttemptId: vi.fn(async (attemptId: string) => [...evaluationsStore.values()].filter((e) => e.attemptId === attemptId)),
      findAllRunning: vi.fn(async () => [...evaluationsStore.values()].filter((e) => e.getState() === 'Running')),
    },
  };
}

describe('EvaluationOrchestrator', () => {
  it('returns immediately after submit, with evaluations left Pending/Running (not blocking on evaluator completion)', async () => {
    const repos = inMemoryRepos();
    const problem = new Problem('p1', 'Parking Lot', 'reqs', 'no event bus', {});
    const problems = { findAll: vi.fn(), findById: vi.fn(async () => problem) };
    const dimensions = ALL_DIMENSIONS.map((key) => ({ key, anchors: [0,1,2,3,4].map((s) => ({ score: s as AnchorScore, label: 'L', description: 'D' })) }));
    const weights = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, 1])) as Record<Dimension, number>;
    const rubric = new Rubric('v1', dimensions, weights, 'no event bus');

    const slowFake = new FakeEvaluator({ kind: 'timeout' }); // never resolves within the test's lifetime
    const orchestrator = new EvaluationOrchestrator(
      repos.attempts as any, repos.evaluations as any, problems as any,
      new Map([['markdown', new MarkdownFormatAdapter()]]), [slowFake], () => rubric, 60000,
    );

    const attempt = await orchestrator.startAttempt('learner1', 'p1');
    const outcome = await orchestrator.submitAttempt(attempt.id, VALID_MARKDOWN, 'markdown');

    expect(outcome.kind).toBe('accepted');
    if (outcome.kind === 'accepted') {
      const evaluation = await repos.evaluations.findById(outcome.evaluationIds[0]);
      expect(evaluation.getState()).toBe('Running'); // orchestrator marked it Running before firing start(), not stuck Pending
    }
  });

  it('rejects submission missing a required section, leaving the attempt in Draft', async () => {
    const repos = inMemoryRepos();
    const problem = new Problem('p1', 'Parking Lot', 'reqs', 'scope', {});
    const problems = { findAll: vi.fn(), findById: vi.fn(async () => problem) };
    const orchestrator = new EvaluationOrchestrator(
      repos.attempts as any, repos.evaluations as any, problems as any,
      new Map([['markdown', new MarkdownFormatAdapter()]]), [], () => new Rubric('v1', [], {}, 's'), 60000,
    );
    const attempt = await orchestrator.startAttempt('learner1', 'p1');
    const incomplete = VALID_MARKDOWN.replace(/# Trade-offs & Extensibility[\s\S]*$/, '');
    const outcome = await orchestrator.submitAttempt(attempt.id, incomplete, 'markdown');
    expect(outcome.kind).toBe('rejected');
    const reloaded = await repos.attempts.findById(attempt.id);
    expect(reloaded?.getState()).toBe('Draft');
  });

  it('idempotent replay on identical resubmit creates no second evaluation', async () => {
    const repos = inMemoryRepos();
    const problem = new Problem('p1', 'Parking Lot', 'reqs', 'scope', {});
    const problems = { findAll: vi.fn(), findById: vi.fn(async () => problem) };
    const fake = new FakeEvaluator({ kind: 'timeout' });
    const orchestrator = new EvaluationOrchestrator(
      repos.attempts as any, repos.evaluations as any, problems as any,
      new Map([['markdown', new MarkdownFormatAdapter()]]), [fake], () => new Rubric('v1', [], {}, 's'), 60000,
    );
    const attempt = await orchestrator.startAttempt('learner1', 'p1');
    await orchestrator.submitAttempt(attempt.id, VALID_MARKDOWN, 'markdown');
    const second = await orchestrator.submitAttempt(attempt.id, VALID_MARKDOWN, 'markdown');
    expect(second.kind).toBe('idempotentReplay');
    const evaluations = await repos.evaluations.findByAttemptId(attempt.id);
    expect(evaluations).toHaveLength(1);
  });

  it('times out a stuck evaluation, marking it Failed with reason "timeout"', async () => {
    vi.useFakeTimers();
    try {
      const repos = inMemoryRepos();
      const problem = new Problem('p1', 'Parking Lot', 'reqs', 'scope', {});
      const problems = { findAll: vi.fn(), findById: vi.fn(async () => problem) };
      const neverResolves = new FakeEvaluator({ kind: 'timeout' });
      const orchestrator = new EvaluationOrchestrator(
        repos.attempts as any, repos.evaluations as any, problems as any,
        new Map([['markdown', new MarkdownFormatAdapter()]]), [neverResolves], () => new Rubric('v1', [], {}, 's'), 10,
      );
      const attempt = await orchestrator.startAttempt('learner1', 'p1');
      const outcome = await orchestrator.submitAttempt(attempt.id, VALID_MARKDOWN, 'markdown');
      expect(outcome.kind).toBe('accepted');
      if (outcome.kind !== 'accepted') return;

      await vi.advanceTimersByTimeAsync(10);

      const evaluation = await repos.evaluations.findById(outcome.evaluationIds[0]);
      expect(evaluation.getState()).toBe('Failed');
      expect(evaluation.getFailureReason()).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a late record() once the evaluation is already terminal (timeout racing a landed result)', async () => {
    const repos = inMemoryRepos();
    const problem = new Problem('p1', 'Parking Lot', 'reqs', 'scope', {});
    const problems = { findAll: vi.fn(), findById: vi.fn(async () => problem) };
    const fake = new FakeEvaluator({ kind: 'complete', outcome: { kind: 'completed', summary: 'ok', criteria: [] } });
    const orchestrator = new EvaluationOrchestrator(
      repos.attempts as any, repos.evaluations as any, problems as any,
      new Map([['markdown', new MarkdownFormatAdapter()]]), [fake], () => new Rubric('v1', [], {}, 's'), 60000,
    );
    const attempt = await orchestrator.startAttempt('learner1', 'p1');
    const outcome = await orchestrator.submitAttempt(attempt.id, VALID_MARKDOWN, 'markdown');
    expect(outcome.kind).toBe('accepted');
    if (outcome.kind !== 'accepted') return;
    const evaluationId = outcome.evaluationIds[0];

    // let FakeEvaluator's queued microtask actually call recorder.record()
    await new Promise((resolve) => setTimeout(resolve, 0));

    let evaluation = await repos.evaluations.findById(evaluationId);
    expect(evaluation.getState()).toBe('Completed');

    // a stray timeout firing after the real result already landed must not throw or overwrite state
    await expect(orchestrator.record(evaluationId, { kind: 'failed', reason: 'timeout' })).resolves.toBeUndefined();

    evaluation = await repos.evaluations.findById(evaluationId);
    expect(evaluation.getState()).toBe('Completed');
  });
});
