import { Router } from 'express';
import type { ProblemRepository } from '../../domain/ports/Repository.js';

/** GET /problems — full problem list. */
export function problemsRouter(problems: ProblemRepository): Router {
  const router = Router();

  router.get('/problems', async (_req, res, next) => {
    try {
      res.json(await problems.findAll());
    } catch (err) {
      next(err);
    }
  });

  return router;
}
