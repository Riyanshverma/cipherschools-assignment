import { describe, it, expect } from 'vitest';
import { Feedback } from '../../../src/domain/Feedback.js';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type Dimension, type AnchorScore } from '../../../src/domain/types.js';
import type { CriterionFeedback } from '../../../src/domain/Feedback.js';

function rubric() {
  const dimensions = ALL_DIMENSIONS.map((key) => ({ key, anchors: [0,1,2,3,4].map((score) => ({ score: score as AnchorScore, label: `L${score}`, description: `D${score}` })) }));
  const weights = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, 1])) as Record<Dimension, number>;
  return new Rubric('v1', dimensions, weights, 'scope');
}

function criterion(overrides: Partial<CriterionFeedback>): CriterionFeedback {
  return {
    criterion: 'requirementUnderstanding', score: 3, evidence: [], strength: 'ok',
    concern: null, whyItMatters: null, suggestion: null, confidence: 'high', ...overrides,
  };
}

describe('Feedback.build', () => {
  it('throws if concern is present without whyItMatters and suggestion', () => {
    const bad = criterion({ concern: 'coupling issue', whyItMatters: null, suggestion: null });
    expect(() => Feedback.build('s', [bad], rubric())).toThrow();
  });

  it('accepts concern with both whyItMatters and suggestion present', () => {
    const ok = criterion({ concern: 'coupling issue', whyItMatters: 'breaks on change', suggestion: 'extract interface' });
    expect(() => Feedback.build('s', [ok], rubric())).not.toThrow();
  });

  it('selects up to 3 topPriorities by lowest weighted contribution among concerned criteria', () => {
    const criteria = ALL_DIMENSIONS.map((d, i) =>
      criterion({ criterion: d, score: (i % 5) as AnchorScore, concern: 'x', whyItMatters: 'y', suggestion: 'z' }));
    const fb = Feedback.build('s', criteria, rubric());
    expect(fb.topPriorities.length).toBeLessThanOrEqual(3);
  });

  it('exposes no aggregate score when fewer than 8 dimensions were scored', () => {
    const fb = Feedback.build('s', [criterion({ criterion: 'requirementUnderstanding' })], rubric());
    expect(fb.aggregateScore).toBeNull();
  });
});
