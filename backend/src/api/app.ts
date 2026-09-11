import express from 'express';
import type {
  LearnerRepository,
  ProblemRepository,
  AttemptRepository,
  EvaluationRepository,
} from '../domain/ports/Repository.js';
import type { EvaluationOrchestrator } from '../application/EvaluationOrchestrator.js';
import { learnersRouter } from './routes/learners.js';
import { problemsRouter } from './routes/problems.js';
import { attemptsRouter } from './routes/attempts.js';
import { historyRouter } from './routes/history.js';

export interface AppDependencies {
  learners: LearnerRepository;
  problems: ProblemRepository;
  attempts: AttemptRepository;
  evaluations: EvaluationRepository;
  orchestrator: EvaluationOrchestrator;
}

export function createApp(deps: AppDependencies): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use(learnersRouter(deps.learners));
  app.use(problemsRouter(deps.problems));
  app.use(attemptsRouter(deps.attempts, deps.evaluations, deps.orchestrator));
  app.use(historyRouter(deps.attempts));

  // Thrown "X not found" errors from the orchestrator/repositories become 404s; anything else 500.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'internal error';
    res.status(message.includes('not found') ? 404 : 500).json({ error: message });
  });

  return app;
}
