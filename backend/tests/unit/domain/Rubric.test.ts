import { describe, it, expect } from 'vitest';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type Dimension, type AnchorScore } from '../../../src/domain/types.js';

function fullRubric() {
  const dimensions = ALL_DIMENSIONS.map((key) => ({
    key,
    anchors: [0, 1, 2, 3, 4].map((score) => ({ score: score as AnchorScore, label: `L${score}`, description: `D${score}` })),
  }));
  const weights = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, 1])) as Record<Dimension, number>;
  return new Rubric('v1', dimensions, weights, 'no event buses');
}

describe('Rubric', () => {
  it('aggregates a full set of 8 scores', () => {
    const scores = new Map<Dimension, AnchorScore>(ALL_DIMENSIONS.map((d) => [d, 2 as AnchorScore]));
    expect(fullRubric().aggregate(scores)).toEqual({ total: 16, maxPossible: 32 });
  });

  it('returns null when not all 8 dimensions are scored (partial/abstained evaluation)', () => {
    const scores = new Map<Dimension, AnchorScore>([
      ['requirementUnderstanding', 3], ['edgeCasesTestability', 2], ['explanationQuality', 4],
    ]);
    expect(fullRubric().aggregate(scores)).toBeNull();
  });

  it('looks up the anchor description for a dimension and score', () => {
    const anchor = fullRubric().getAnchor('extensibility', 3);
    expect(anchor.score).toBe(3);
  });
});
