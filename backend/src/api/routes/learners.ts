import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { LearnerRepository } from '../../domain/ports/Repository.js';
import { Learner } from '../../domain/Learner.js';
import { CreateLearnerRequestSchema } from '../validation.js';

/** POST /learners — get-or-create by handle. */
export function learnersRouter(learners: LearnerRepository): Router {
  const router = Router();

  router.post('/learners', async (req, res, next) => {
    const parsed = CreateLearnerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const { handle } = parsed.data;
      let learner = await learners.findByHandle(handle);
      if (!learner) {
        learner = new Learner(randomUUID(), handle, handle);
        await learners.save(learner);
      }
      res.status(201).json({ id: learner.id, handle: learner.handle });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
