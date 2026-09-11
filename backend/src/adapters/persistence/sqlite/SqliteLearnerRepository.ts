import type Database from 'better-sqlite3';
import { Learner } from '../../../domain/Learner.js';
import type { LearnerRepository } from '../../../domain/ports/Repository.js';

interface LearnerRow {
  id: string;
  handle: string;
  display_name: string;
}

/** Translates Learner <-> the `learners` table. No business rules live here. */
export class SqliteLearnerRepository implements LearnerRepository {
  constructor(private readonly db: Database.Database) {}

  async findByHandle(handle: string): Promise<Learner | null> {
    const row = this.db.prepare('SELECT * FROM learners WHERE handle = ?').get(handle) as LearnerRow | undefined;
    return row ? new Learner(row.id, row.handle, row.display_name) : null;
  }

  async save(learner: Learner): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO learners (id, handle, display_name) VALUES (@id, @handle, @displayName)
         ON CONFLICT(id) DO UPDATE SET handle = excluded.handle, display_name = excluded.display_name`,
      )
      .run({ id: learner.id, handle: learner.handle, displayName: learner.displayName });
  }
}
