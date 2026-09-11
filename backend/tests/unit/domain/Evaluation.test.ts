import { describe, it, expect } from 'vitest';
import { Evaluation } from '../../../src/domain/Evaluation.js';
import { Feedback } from '../../../src/domain/Feedback.js';

function fakeFeedback(): Feedback {
  // built via Feedback.build with an empty rubric-agnostic minimal case in Task 4's Feedback test;
  // reuse the same helper here once Feedback.build exists.
  return Feedback.build('summary', [], { aggregate: () => null } as any);
}

describe('Evaluation', () => {
  it('starts Pending', () => {
    const e = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    expect(e.getState()).toBe('Pending');
  });

  it('moves Pending -> Running -> Completed', () => {
    const e = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    e.markRunning();
    expect(e.getState()).toBe('Running');
    e.complete(fakeFeedback());
    expect(e.getState()).toBe('Completed');
  });

  it('rejects complete() from Pending (must go through Running)', () => {
    const e = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    expect(() => e.complete(fakeFeedback())).toThrow();
  });

  it('stores failure reason and moves to Failed', () => {
    const e = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    e.markRunning();
    e.fail('timeout');
    expect(e.getState()).toBe('Failed');
    expect(e.getFailureReason()).toBe('timeout');
  });

  it('markInterrupted sweeps a stranded Running evaluation to Failed', () => {
    const e = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    e.markRunning();
    e.markInterrupted();
    expect(e.getState()).toBe('Failed');
    expect(e.getFailureReason()).toBe('interrupted');
  });
});
