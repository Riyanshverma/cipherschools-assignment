import { describe, it, expect } from 'vitest';
import { HistoryProjection } from '../../../src/application/HistoryProjection.js';
import { Attempt } from '../../../src/domain/Attempt.js';
import { Submission } from '../../../src/domain/Submission.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';
import { Evaluation } from '../../../src/domain/Evaluation.js';
import { Feedback, type CriterionFeedback } from '../../../src/domain/Feedback.js';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type AnchorScore, type Dimension } from '../../../src/domain/types.js';

const RUBRIC = new Rubric('v1', [], {}, 'scope');
const EMPTY_DOC = new DesignDocument(new Map(), [], null);

/** A Completed Feedback scoring every dimension at `baseline`, except the overrides given. */
function feedback(overrides: Partial<Record<Dimension, AnchorScore>>, baseline: AnchorScore = 2): Feedback {
  const criteria: CriterionFeedback[] = ALL_DIMENSIONS.map((criterion) => ({
    criterion,
    score: overrides[criterion] ?? baseline,
    evidence: [],
    strength: null,
    concern: null,
    whyItMatters: null,
    suggestion: null,
    confidence: 'medium',
  }));
  return Feedback.build('summary', criteria, RUBRIC);
}

/** A submitted Attempt with one Completed evaluation from evaluatorId (defaults to 'ai'). */
function submittedAttempt(
  attemptId: string,
  problemId: string,
  submittedAt: Date,
  scores: Partial<Record<Dimension, AnchorScore>>,
  evaluatorId = 'ai',
): { attempt: Attempt; evaluations: Evaluation[] } {
  const attempt = new Attempt(attemptId, 'learner1', problemId, submittedAt);
  attempt.submit(Submission.create('raw', 'markdown', EMPTY_DOC, submittedAt));

  const evaluation = new Evaluation(`${attemptId}-eval`, attemptId, evaluatorId, 'v1', submittedAt);
  evaluation.markRunning();
  evaluation.complete(feedback(scores));

  return { attempt, evaluations: [evaluation] };
}

describe('HistoryProjection.build', () => {
  it('reports a positive delta when a dimension improves attempt-to-attempt on the same problem', () => {
    const first = submittedAttempt('a1', 'parking-lot', new Date('2026-01-01'), { requirementUnderstanding: 1 });
    const second = submittedAttempt('a2', 'parking-lot', new Date('2026-01-05'), { requirementUnderstanding: 3 });

    const result = HistoryProjection.build([first, second]);

    const secondSummary = result.attempts.find((a) => a.attemptId === 'a2')!;
    const ruDelta = secondSummary.deltas.find((d) => d.dimension === 'requirementUnderstanding')!;
    expect(ruDelta).toEqual({
      dimension: 'requirementUnderstanding',
      previousScore: 1,
      currentScore: 3,
      delta: 2,
    });
  });

  it('flags a dimension as a recurring weakness when it scores <=1 in 2+ attempts across different problems', () => {
    const a1 = submittedAttempt('a1', 'parking-lot', new Date('2026-01-01'), { extensibility: 0 });
    const a2 = submittedAttempt('a2', 'vending-machine', new Date('2026-01-05'), { extensibility: 1 });
    const a3 = submittedAttempt('a3', 'elevator', new Date('2026-01-10'), { extensibility: 1 });

    const result = HistoryProjection.build([a1, a2, a3]);

    const weakness = result.recurringWeaknesses.find((w) => w.dimension === 'extensibility');
    expect(weakness).toEqual({ dimension: 'extensibility', lowScoreCount: 3 });
  });

  it('does not flag a dimension that scores <=1 in only one attempt', () => {
    const a1 = submittedAttempt('a1', 'parking-lot', new Date('2026-01-01'), { extensibility: 0 });
    const a2 = submittedAttempt('a2', 'vending-machine', new Date('2026-01-05'), { extensibility: 3 });

    const result = HistoryProjection.build([a1, a2]);

    expect(result.recurringWeaknesses.find((w) => w.dimension === 'extensibility')).toBeUndefined();
  });

  it('gives null deltas (not zero) for an attempt with no preceding attempt on its problem', () => {
    const only = submittedAttempt('a1', 'parking-lot', new Date('2026-01-01'), { requirementUnderstanding: 3 });

    const result = HistoryProjection.build([only]);

    const summary = result.attempts.find((a) => a.attemptId === 'a1')!;
    for (const d of summary.deltas) {
      expect(d.delta).toBeNull();
    }
    const ru = summary.deltas.find((d) => d.dimension === 'requirementUnderstanding')!;
    expect(ru.previousScore).toBeNull();
    expect(ru.currentScore).toBe(3);
  });

  it('does not compute a delta against a different problem\'s attempt', () => {
    const onParkingLot = submittedAttempt('a1', 'parking-lot', new Date('2026-01-01'), { requirementUnderstanding: 4 });
    const onVendingMachine = submittedAttempt('a2', 'vending-machine', new Date('2026-01-05'), { requirementUnderstanding: 1 });

    const result = HistoryProjection.build([onParkingLot, onVendingMachine]);

    const secondSummary = result.attempts.find((a) => a.attemptId === 'a2')!;
    const ru = secondSummary.deltas.find((d) => d.dimension === 'requirementUnderstanding')!;
    // a2 is the *first* attempt on vending-machine, so there's nothing to compare against,
    // even though a1 (on a different problem) exists earlier chronologically.
    expect(ru.previousScore).toBeNull();
    expect(ru.delta).toBeNull();
  });

  it('finds the immediately preceding same-problem attempt even when a different-problem attempt is interleaved', () => {
    const parkingLot1 = submittedAttempt('a1', 'parking-lot', new Date('2026-01-01'), { requirementUnderstanding: 1 });
    const vendingMachine = submittedAttempt('a2', 'vending-machine', new Date('2026-01-05'), {
      requirementUnderstanding: 4,
    });
    const parkingLot2 = submittedAttempt('a3', 'parking-lot', new Date('2026-01-10'), { requirementUnderstanding: 3 });

    const result = HistoryProjection.build([parkingLot1, vendingMachine, parkingLot2]);

    const thirdSummary = result.attempts.find((a) => a.attemptId === 'a3')!;
    const ru = thirdSummary.deltas.find((d) => d.dimension === 'requirementUnderstanding')!;
    // must diff against a1 (previous parking-lot attempt: score 1), not a2 (vending-machine: 4),
    // even though a2 is chronologically the immediately preceding attempt overall.
    expect(ru).toEqual({ dimension: 'requirementUnderstanding', previousScore: 1, currentScore: 3, delta: 2 });
  });

  it('ignores the rule-based evaluator for delta/recurring-weakness (it abstains on most dimensions)', () => {
    const attempt = new Attempt('a1', 'learner1', 'parking-lot', new Date('2026-01-01'));
    attempt.submit(Submission.create('raw', 'markdown', EMPTY_DOC, new Date('2026-01-01')));

    const ruleBased = new Evaluation('e1', 'a1', 'rule-based', 'v1', new Date('2026-01-01'));
    ruleBased.markRunning();
    ruleBased.complete(feedback({ extensibility: 0 }));

    const result = HistoryProjection.build([{ attempt, evaluations: [ruleBased] }]);

    // no AI (or ai-equivalent) evaluation at all -> nothing to score with, so no low-score count
    expect(result.recurringWeaknesses).toHaveLength(0);
    const summary = result.attempts[0];
    expect(summary.deltas.every((d) => d.currentScore === null)).toBe(true);
  });

  it('skips attempts with no completed evaluation of any kind', () => {
    const attempt = new Attempt('a1', 'learner1', 'parking-lot', new Date('2026-01-01'));
    attempt.submit(Submission.create('raw', 'markdown', EMPTY_DOC, new Date('2026-01-01')));
    const pending = new Evaluation('e1', 'a1', 'ai', 'v1', new Date('2026-01-01'));

    const result = HistoryProjection.build([{ attempt, evaluations: [pending] }]);

    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].deltas.every((d) => d.currentScore === null && d.delta === null)).toBe(true);
    expect(result.recurringWeaknesses).toHaveLength(0);
  });
});
