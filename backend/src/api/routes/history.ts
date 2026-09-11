import { Router } from 'express';
import type { AttemptRepository } from '../../domain/ports/Repository.js';

/**
 * GET /learners/:id/history — stub: raw attempt list only. Task 20 adds per-dimension deltas
 * and recurring-weakness detection on top of this; not built here (out of scope for Task 12).
 */
export function historyRouter(attempts: AttemptRepository): Router {
  const router = Router();

  router.get('/learners/:id/history', async (req, res, next) => {
    try {
      const learnerAttempts = await attempts.findByLearner(req.params.id);
      res.json(
        learnerAttempts.map((attempt) => ({
          id: attempt.id,
          problemId: attempt.problemId,
          state: attempt.getState(),
          createdAt: attempt.createdAt,
        })),
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}
