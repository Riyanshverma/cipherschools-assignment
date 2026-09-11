import type Database from 'better-sqlite3';
import { Problem } from '../../../domain/Problem.js';
import type { Dimension } from '../../../domain/types.js';
import type { ProblemRepository } from '../../../domain/ports/Repository.js';

interface ProblemRow {
  id: string;
  title: string;
  requirements: string;
  scope_boundary: string;
  rubric_weights_json: string;
}

/** Translates Problem <-> the `problems` table. No business rules live here. */
export class SqliteProblemRepository implements ProblemRepository {
  constructor(private readonly db: Database.Database) {}

  async findAll(): Promise<Problem[]> {
    const rows = this.db.prepare('SELECT * FROM problems').all() as ProblemRow[];
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<Problem | null> {
    const row = this.db.prepare('SELECT * FROM problems WHERE id = ?').get(id) as ProblemRow | undefined;
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: ProblemRow): Problem {
    const rubricWeights = JSON.parse(row.rubric_weights_json) as Partial<Record<Dimension, number>>;
    return new Problem(row.id, row.title, row.requirements, row.scope_boundary, rubricWeights);
  }
}
