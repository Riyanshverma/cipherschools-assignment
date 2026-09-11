import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import OpenAI from 'openai';
import { createApp } from './api/app.js';
import { openDb, runMigrations } from './adapters/persistence/sqlite/db.js';
import { SqliteLearnerRepository } from './adapters/persistence/sqlite/SqliteLearnerRepository.js';
import { SqliteProblemRepository } from './adapters/persistence/sqlite/SqliteProblemRepository.js';
import { SqliteAttemptRepository } from './adapters/persistence/sqlite/SqliteAttemptRepository.js';
import { SqliteEvaluationRepository } from './adapters/persistence/sqlite/SqliteEvaluationRepository.js';
import { EvaluationOrchestrator } from './application/EvaluationOrchestrator.js';
import { MarkdownFormatAdapter } from './adapters/format/MarkdownFormatAdapter.js';
import { OpenAiLlmClient } from './adapters/llm/OpenAiLlmClient.js';
import { AiEvaluator } from './adapters/evaluators/AiEvaluator.js';
import { RuleBasedEvaluator } from './adapters/evaluators/RuleBasedEvaluator.js';
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

  const sdkClient = new OpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY });
  const llmClient = new OpenAiLlmClient(sdkClient, process.env.OPENAI_MODEL ?? 'gpt-5-nano');
  const evaluators = [
    new AiEvaluator(llmClient, Number(process.env.LLM_MAX_RETRIES ?? 2)),
    new RuleBasedEvaluator(),
  ];

  const orchestrator = new EvaluationOrchestrator(
    attempts,
    evaluations,
    problems,
    new Map([['markdown', new MarkdownFormatAdapter()]]),
    evaluators,
    (problem) => new Rubric(RUBRIC_VERSION, GLOBAL_RUBRIC_DIMENSIONS, problem.rubricWeights, problem.scopeBoundary),
    Number(process.env.LLM_TIMEOUT_MS ?? 60000),
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
