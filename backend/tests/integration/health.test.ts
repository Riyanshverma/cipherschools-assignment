import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/app.js';
import { openDb, runMigrations } from '../../src/adapters/persistence/sqlite/db.js';
import { SqliteLearnerRepository } from '../../src/adapters/persistence/sqlite/SqliteLearnerRepository.js';
import { SqliteProblemRepository } from '../../src/adapters/persistence/sqlite/SqliteProblemRepository.js';
import { SqliteAttemptRepository } from '../../src/adapters/persistence/sqlite/SqliteAttemptRepository.js';
import { SqliteEvaluationRepository } from '../../src/adapters/persistence/sqlite/SqliteEvaluationRepository.js';
import { EvaluationOrchestrator } from '../../src/application/EvaluationOrchestrator.js';
import { MarkdownFormatAdapter } from '../../src/adapters/format/MarkdownFormatAdapter.js';
import { globalRubric } from '../../src/seed/rubric.js';

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const db = openDb(':memory:');
    runMigrations(db);
    const attempts = new SqliteAttemptRepository(db);
    const evaluations = new SqliteEvaluationRepository(db);
    const problems = new SqliteProblemRepository(db);
    const orchestrator = new EvaluationOrchestrator(
      attempts, evaluations, problems, new Map([['markdown', new MarkdownFormatAdapter()]]),
      [], () => globalRubric, 60000,
    );
    const app = createApp({
      learners: new SqliteLearnerRepository(db),
      problems,
      attempts,
      evaluations,
      orchestrator,
    });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
