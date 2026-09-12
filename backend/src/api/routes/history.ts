import { Router } from 'express';
import type { AttemptRepository, EvaluationRepository } from '../../domain/ports/Repository.js';
import { HistoryProjection } from '../../application/HistoryProjection.js';

/**
 * GET /learners/:id/history — per-dimension deltas vs. the learner's previous attempt on the
 * same problem, plus cross-problem recurring-weakness detection (Decision 11). All computation
 * lives in HistoryProjection (pure, no I/O); this route only fetches and hands off.
 */
export function historyRouter(attempts: AttemptRepository, evaluations: EvaluationRepository): Router {
  const router = Router();

  router.get('/learners/:id/history', async (req, res, next) => {
    try {
      const learnerAttempts = await attempts.findByLearner(req.params.id);
      const attemptsWithEvaluations = await Promise.all(
        learnerAttempts.map(async (attempt) => ({
          attempt,
          evaluations: await evaluations.findByAttemptId(attempt.id),
        })),
      );
      res.json(HistoryProjection.build(attemptsWithEvaluations));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
