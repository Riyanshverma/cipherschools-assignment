import { describe, it, expect, vi } from 'vitest';
import { AiEvaluator } from '../../../src/adapters/evaluators/AiEvaluator.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type AnchorScore, type Dimension } from '../../../src/domain/types.js';
import type { EvaluationOutcome } from '../../../src/domain/ports/Evaluator.js';

function rubric() {
  const dimensions = ALL_DIMENSIONS.map((key) => ({ key, anchors: [0,1,2,3,4].map((s) => ({ score: s as AnchorScore, label: 'L', description: 'D' })) }));
  const weights = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, 1])) as Record<Dimension, number>;
  return new Rubric('v1', dimensions, weights, 'scope');
}
const doc = new DesignDocument(new Map(), [], null);
const context = { problemId: 'p1', requirements: 'r', scopeBoundary: 's' };

function validResponse() {
  return {
    summary: 'ok',
    criteria: ALL_DIMENSIONS.map((d) => ({
      criterion: d, score: 3, evidence: [], strength: 'fine',
      concern: null, whyItMatters: null, suggestion: null, confidence: 'high',
    })),
  };
}

describe('AiEvaluator', () => {
  it('recovers from malformed output on retry and completes', async () => {
    const completeJson = vi.fn()
      .mockResolvedValueOnce({ not: 'valid' })
      .mockResolvedValueOnce(validResponse());
    const llm = { completeJson };
    const evaluator = new AiEvaluator(llm as any, 2);
    let outcome: EvaluationOutcome | undefined;
    const recorder = { record: vi.fn(async (_id: string, o: EvaluationOutcome) => { outcome = o; }) };
    evaluator.start('e1', doc, rubric(), context, recorder);
    await vi.waitFor(() => expect(outcome).toBeDefined());
    expect(outcome!.kind).toBe('completed');
    expect(completeJson).toHaveBeenCalledTimes(2);
    expect(recorder.record).toHaveBeenCalledTimes(1); // never called once per attempt — only once, after success
  });

  it('fails after exhausting 2 retries on persistently malformed output, applying nothing partially', async () => {
    const completeJson = vi.fn().mockResolvedValue({ not: 'valid' });
    const llm = { completeJson };
    const evaluator = new AiEvaluator(llm as any, 2);
    let outcome: EvaluationOutcome | undefined;
    const recorder = { record: vi.fn(async (_id: string, o: EvaluationOutcome) => { outcome = o; }) };
    evaluator.start('e1', doc, rubric(), context, recorder);
    await vi.waitFor(() => expect(outcome).toBeDefined());
    expect(outcome!.kind).toBe('failed');
    expect(completeJson).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(recorder.record).toHaveBeenCalledTimes(1); // exhausted retries record failure once, not once per attempt
  });

  it('sends the problem scope boundary in the prompt so the model is bounded to the problem as posed', async () => {
    const completeJson = vi.fn(async (params: any) => { expect(params.userPrompt).toContain('no event bus'); return validResponse(); });
    const evaluator = new AiEvaluator({ completeJson } as any, 2);
    const recorder = { record: vi.fn() };
    evaluator.start('e1', doc, rubric(), { problemId: 'p1', requirements: 'r', scopeBoundary: 'no event bus' }, recorder);
    await vi.waitFor(() => expect(completeJson).toHaveBeenCalled());
  });
});
