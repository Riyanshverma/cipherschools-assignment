import { describe, it, expect, vi } from 'vitest';
import { FakeEvaluator } from '../../../src/adapters/evaluators/FakeEvaluator.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';
import { Rubric } from '../../../src/domain/Rubric.js';

const doc = new DesignDocument(new Map(), [], null);
const rubric = new Rubric('v1', [], {}, 'scope');
const context = { problemId: 'p1', requirements: 'r', scopeBoundary: 's' };

describe('FakeEvaluator', () => {
  it('reports the programmed completed outcome', async () => {
    const evaluator = new FakeEvaluator({ kind: 'complete', outcome: { kind: 'completed', summary: 'ok', criteria: [] } });
    let recorded: unknown;
    const recorder = { record: vi.fn(async (_id: string, o: unknown) => { recorded = o; }) };
    evaluator.start('e1', doc, rubric, context, recorder);
    await vi.waitFor(() => expect(recorded).toBeDefined());
    expect(recorded).toEqual({ kind: 'completed', summary: 'ok', criteria: [] });
  });

  it('never calls record() in timeout mode, so an orchestrator timeout is exercised', async () => {
    const evaluator = new FakeEvaluator({ kind: 'timeout' });
    const recorder = { record: vi.fn() };
    evaluator.start('e1', doc, rubric, context, recorder);
    await new Promise((r) => setTimeout(r, 20));
    expect(recorder.record).not.toHaveBeenCalled();
  });
});
