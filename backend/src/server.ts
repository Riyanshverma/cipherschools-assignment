import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './api/app.js';
import { openDb, runMigrations } from './adapters/persistence/sqlite/db.js';
import { SqliteLearnerRepository } from './adapters/persistence/sqlite/SqliteLearnerRepository.js';
import { SqliteProblemRepository } from './adapters/persistence/sqlite/SqliteProblemRepository.js';
import { SqliteAttemptRepository } from './adapters/persistence/sqlite/SqliteAttemptRepository.js';
import { SqliteEvaluationRepository } from './adapters/persistence/sqlite/SqliteEvaluationRepository.js';
import { EvaluationOrchestrator } from './application/EvaluationOrchestrator.js';
import { MarkdownFormatAdapter } from './adapters/format/MarkdownFormatAdapter.js';
import { FakeEvaluator } from './adapters/evaluators/FakeEvaluator.js';
import { Rubric } from './domain/Rubric.js';
import { seedDb } from './seed/seedDb.js';
import { GLOBAL_RUBRIC_DIMENSIONS, RUBRIC_VERSION } from './seed/rubric.js';

async function main(): Promise<void> {
  const dbPath = process.env.DATABASE_PATH ?? './data/app.db';
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

  const db = openDb(dbPath);
  runMigrations(db);
  await seedDb(db);

  const learners = new SqliteLearnerRepository(db);
  const problems = new SqliteProblemRepository(db);
  const attempts = new SqliteAttemptRepository(db);
  const evaluations = new SqliteEvaluationRepository(db);

  // Placeholder evaluator for local dev — Task 16 replaces this with the real AI + rule-based
  // evaluators registered behind the Evaluator port.
  const placeholderEvaluator = new FakeEvaluator({
    kind: 'complete',
    outcome: { kind: 'completed', summary: 'Placeholder evaluation — AI evaluator not wired yet.', criteria: [] },
  });

  const orchestrator = new EvaluationOrchestrator(
    attempts,
    evaluations,
    problems,
    new Map([['markdown', new MarkdownFormatAdapter()]]),
    [placeholderEvaluator],
    (problem) => new Rubric(RUBRIC_VERSION, GLOBAL_RUBRIC_DIMENSIONS, problem.rubricWeights, problem.scopeBoundary),
    60000,
  );

  await orchestrator.sweepStrandedEvaluations();

  const app = createApp({ learners, problems, attempts, evaluations, orchestrator });
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.log(`listening on ${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
