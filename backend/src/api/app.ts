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

  // The frontend (Vite dev server) and backend run on different origins/ports; the browser
  // blocks cross-origin requests without this. No cookies/credentials are ever sent (decision
  // 12 — identity is a declared handle, not a session), so a wildcard origin is correct here,
  // not a security shortcut.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use(learnersRouter(deps.learners));
  app.use(problemsRouter(deps.problems));
  app.use(attemptsRouter(deps.attempts, deps.evaluations, deps.orchestrator));
  app.use(historyRouter(deps.attempts, deps.evaluations));

  // Thrown "X not found" errors from the orchestrator/repositories become 404s; anything else 500.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'internal error';
    res.status(message.includes('not found') ? 404 : 500).json({ error: message });
  });

  return app;
}
