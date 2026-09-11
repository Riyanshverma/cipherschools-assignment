import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb, runMigrations } from '../../../src/adapters/persistence/sqlite/db.js';
import { SqliteAttemptRepository } from '../../../src/adapters/persistence/sqlite/SqliteAttemptRepository.js';
import { Attempt } from '../../../src/domain/Attempt.js';
import { Submission } from '../../../src/domain/Submission.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';

describe('SqliteAttemptRepository', () => {
  let db: Database.Database;
  let repo: SqliteAttemptRepository;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    repo = new SqliteAttemptRepository(db);
  });

  it('round-trips a Draft attempt', async () => {
    const attempt = new Attempt('a1', 'learner1', 'problem1', new Date('2026-09-11T00:00:00Z'));
    await repo.save(attempt);
    const loaded = await repo.findById('a1');
    expect(loaded?.getState()).toBe('Draft');
  });

  it('round-trips a Submitted attempt with its submission content and document', async () => {
    const attempt = new Attempt('a1', 'learner1', 'problem1', new Date());
    const sections = new Map();
    sections.set('requirementsAssumptions', { key: 'requirementsAssumptions', heading: 'h', text: 'text', lineRange: { start: 1, end: 1 } });
    const doc = new DesignDocument(sections, [], null);
    attempt.submit(Submission.create('raw markdown', 'markdown', doc, new Date()));
    await repo.save(attempt);
    const loaded = await repo.findById('a1');
    expect(loaded?.getState()).toBe('Submitted');
    expect(loaded?.getSubmission()?.rawContent).toBe('raw markdown');
    expect(loaded?.getSubmission()?.document.getSection('requirementsAssumptions')?.text).toBe('text');
  });
});
