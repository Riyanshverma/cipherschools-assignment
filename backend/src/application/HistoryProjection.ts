import type { Attempt } from '../domain/Attempt.js';
import type { Evaluation } from '../domain/Evaluation.js';
import { ALL_DIMENSIONS, type Dimension } from '../domain/types.js';

export interface DimensionDelta {
  dimension: Dimension;
  previousScore: number | null;
  currentScore: number | null;
  delta: number | null;
}

export interface AttemptSummary {
  attemptId: string;
  problemId: string;
  submittedAt: string;
  deltas: DimensionDelta[];
}

export interface RecurringWeakness {
  dimension: Dimension;
  lowScoreCount: number;
}

export interface AttemptWithEvaluations {
  attempt: Attempt;
  evaluations: Evaluation[];
}

const AI_EVALUATOR_ID = 'ai';
const LOW_SCORE_THRESHOLD = 1;
const RECURRING_WEAKNESS_MIN_COUNT = 2;

/** The Completed AI-evaluator evaluation for an attempt, if any — the only evaluator whose
 * scores drive delta/recurring-weakness analysis (the rule-based evaluator abstains on 5/8
 * dimensions and can't meaningfully participate; see backend/src/adapters/evaluators/AiEvaluator.ts). */
function primaryScoringEvaluation(evaluations: Evaluation[]): Evaluation | null {
  return evaluations.find((e) => e.evaluatorId === AI_EVALUATOR_ID && e.getState() === 'Completed') ?? null;
}

function scoresByDimension(evaluation: Evaluation | null): Map<Dimension, number> {
  const scores = new Map<Dimension, number>();
  const feedback = evaluation?.getFeedback() ?? null;
  if (!feedback) return scores;
  for (const c of feedback.criteria) {
    if (c.score !== null) scores.set(c.criterion, c.score);
  }
  return scores;
}

/** Pure computation over already-fetched attempts + their evaluations. No I/O — see
 * backend/src/api/routes/history.ts for the fetching side. */
export class HistoryProjection {
  static build(attemptsWithEvaluations: AttemptWithEvaluations[]): {
    attempts: AttemptSummary[];
    recurringWeaknesses: RecurringWeakness[];
  } {
    // Only submitted attempts have anything to score; sort oldest-first so "immediately
    // preceding attempt on the same problem" reads chronologically while we walk the list.
    const submitted = attemptsWithEvaluations
      .filter(({ attempt }) => attempt.getSubmission() !== null)
      .sort(
        (a, b) => a.attempt.getSubmission()!.submittedAt.getTime() - b.attempt.getSubmission()!.submittedAt.getTime(),
      );

    const lowScoreCounts = new Map<Dimension, number>();
    const lastScoresByProblem = new Map<string, Map<Dimension, number>>();
    const summaries: AttemptSummary[] = [];

    for (const { attempt, evaluations } of submitted) {
      const currentScores = scoresByDimension(primaryScoringEvaluation(evaluations));

      for (const [dimension, score] of currentScores) {
        if (score <= LOW_SCORE_THRESHOLD) {
          lowScoreCounts.set(dimension, (lowScoreCounts.get(dimension) ?? 0) + 1);
        }
      }

      // undefined (no prior entry) means "no preceding attempt on this problem" -> null delta.
      // An entry that exists but is empty means the preceding attempt had no scores either,
      // which must also produce a null delta (not fall through to an earlier attempt).
      const previousScores = lastScoresByProblem.get(attempt.problemId);
      const deltas: DimensionDelta[] = ALL_DIMENSIONS.map((dimension) => {
        const currentScore = currentScores.get(dimension) ?? null;
        const previousScore = previousScores?.get(dimension) ?? null;
        const delta = currentScore !== null && previousScore !== null ? currentScore - previousScore : null;
        return { dimension, previousScore, currentScore, delta };
      });

      summaries.push({
        attemptId: attempt.id,
        problemId: attempt.problemId,
        submittedAt: attempt.getSubmission()!.submittedAt.toISOString(),
        deltas,
      });

      lastScoresByProblem.set(attempt.problemId, currentScores);
    }

    const recurringWeaknesses: RecurringWeakness[] = ALL_DIMENSIONS.map((dimension) => ({
      dimension,
      lowScoreCount: lowScoreCounts.get(dimension) ?? 0,
    })).filter((w) => w.lowScoreCount >= RECURRING_WEAKNESS_MIN_COUNT);

    // Newest first for display — a history feed reads top-down as "most recent first".
    return { attempts: summaries.reverse(), recurringWeaknesses };
  }
}
