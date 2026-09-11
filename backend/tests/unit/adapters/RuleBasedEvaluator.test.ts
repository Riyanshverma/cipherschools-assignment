import { describe, it, expect, vi } from 'vitest';
import { RuleBasedEvaluator } from '../../../src/adapters/evaluators/RuleBasedEvaluator.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type AnchorScore, type Dimension } from '../../../src/domain/types.js';
import type { EvaluationOutcome } from '../../../src/domain/ports/Evaluator.js';

function rubric() {
  const dimensions = ALL_DIMENSIONS.map((key) => ({ key, anchors: [0,1,2,3,4].map((score) => ({ score: score as AnchorScore, label: `L`, description: `D` })) }));
  const weights = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, 1])) as Record<Dimension, number>;
  return new Rubric('v1', dimensions, weights, 'scope');
}

function docWith(sections: Record<string, string>) {
  const map = new Map();
  for (const [key, text] of Object.entries(sections)) {
    map.set(key, { key, heading: key, text, lineRange: { start: 1, end: 1 } });
  }
  return new DesignDocument(map, [], null);
}

describe('RuleBasedEvaluator', () => {
  it('scores exactly 3 dimensions and abstains on the other 5', async () => {
    const evaluator = new RuleBasedEvaluator();
    const doc = docWith({
      requirementsAssumptions: 'x'.repeat(700),
      edgeCasesTestability: '- case one\n- case two\n- case three\n- case four\n- case five',
      keyBehaviourRules: 'because this matters, so that it holds, however edge cases exist',
    });
    let outcome: EvaluationOutcome | undefined;
    const recorder = { record: vi.fn(async (_id: string, o: EvaluationOutcome) => { outcome = o; }) };
    evaluator.start('eval1', doc, rubric(), { problemId: 'p1', requirements: 'r', scopeBoundary: 's' }, recorder);
    await vi.waitFor(() => expect(outcome).toBeDefined());
    expect(outcome!.kind).toBe('completed');
    const completed = outcome as Extract<EvaluationOutcome, { kind: 'completed' }>;
    const scored = completed.criteria.filter((c) => c.score !== null);
    const abstained = completed.criteria.filter((c) => c.score === null);
    expect(scored.map((c) => c.criterion).sort()).toEqual(
      ['edgeCasesTestability', 'explanationQuality', 'requirementUnderstanding'].sort(),
    );
    expect(abstained).toHaveLength(5);
    for (const a of abstained) expect(a.confidence).toBe('none');
  });

  it('scores requirementUnderstanding 0 on a near-empty section', async () => {
    const evaluator = new RuleBasedEvaluator();
    const doc = docWith({ requirementsAssumptions: 'short' });
    let outcome: EvaluationOutcome | undefined;
    const recorder = { record: vi.fn(async (_id: string, o: EvaluationOutcome) => { outcome = o; }) };
    evaluator.start('eval1', doc, rubric(), { problemId: 'p1', requirements: 'r', scopeBoundary: 's' }, recorder);
    await vi.waitFor(() => expect(outcome).toBeDefined());
    const completed = outcome as Extract<EvaluationOutcome, { kind: 'completed' }>;
    const req = completed.criteria.find((c) => c.criterion === 'requirementUnderstanding')!;
    expect(req.score).toBe(0);
  });
});
