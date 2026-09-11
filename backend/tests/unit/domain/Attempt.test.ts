import { describe, it, expect } from 'vitest';
import { Attempt } from '../../../src/domain/Attempt.js';
import { Submission } from '../../../src/domain/Submission.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';

function submission(content = 'design doc content') {
  return Submission.create(content, 'markdown', new DesignDocument(new Map(), [], null), new Date());
}

describe('Attempt', () => {
  it('starts in Draft', () => {
    const a = new Attempt('a1', 'learner1', 'problem1', new Date());
    expect(a.getState()).toBe('Draft');
  });

  it('accepts submission from Draft', () => {
    const a = new Attempt('a1', 'learner1', 'problem1', new Date());
    const result = a.submit(submission());
    expect(result).toEqual({ kind: 'accepted' });
    expect(a.getState()).toBe('Submitted');
  });

  it('treats identical resubmit as idempotent replay, not a second acceptance', () => {
    const a = new Attempt('a1', 'learner1', 'problem1', new Date());
    const s = submission('same content');
    a.submit(s);
    const result = a.submit(Submission.create('same content', 'markdown', new DesignDocument(new Map(), [], null), new Date()));
    expect(result).toEqual({ kind: 'idempotentReplay' });
  });

  it('rejects a different submission on an already-submitted attempt', () => {
    const a = new Attempt('a1', 'learner1', 'problem1', new Date());
    a.submit(submission('content A'));
    const result = a.submit(submission('content B'));
    expect(result.kind).toBe('conflict');
  });
});
