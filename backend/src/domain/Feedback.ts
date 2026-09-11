import type { AggregateScore, Rubric } from './Rubric.js';
import type { AnchorScore, Confidence, Dimension } from './types.js';
import type { Citation } from './ports/Evaluator.js';

export interface CriterionFeedback {
  criterion: Dimension;
  score: AnchorScore | null;
  evidence: Citation[];
  strength: string | null;
  concern: string | null;
  whyItMatters: string | null;
  suggestion: string | null;
  confidence: Confidence;
}

export class Feedback {
  private constructor(
    readonly summary: string,
    readonly criteria: CriterionFeedback[],
    readonly topPriorities: Dimension[],
    readonly aggregateScore: AggregateScore | null,
  ) {}

  static build(summary: string, criteria: CriterionFeedback[], rubric: Rubric): Feedback {
    for (const c of criteria) {
      if (c.concern !== null && (c.whyItMatters === null || c.suggestion === null)) {
        throw new Error(`criterion "${c.criterion}" has a concern but is missing whyItMatters or suggestion`);
      }
    }

    const scores = new Map<Dimension, AnchorScore>();
    for (const c of criteria) {
      if (c.score !== null) scores.set(c.criterion, c.score);
    }
    const aggregateScore = rubric.aggregate(scores);

    const topPriorities = criteria
      .filter((c) => c.concern !== null)
      .sort((a, b) => (a.score ?? 0) * rubric.getWeight(a.criterion) - (b.score ?? 0) * rubric.getWeight(b.criterion))
      .slice(0, 3)
      .map((c) => c.criterion);

    return new Feedback(summary, criteria, topPriorities, aggregateScore);
  }
}
