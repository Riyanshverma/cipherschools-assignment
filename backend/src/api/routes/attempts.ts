import { Router } from 'express';
import { z } from 'zod';
import type { AttemptRepository, EvaluationRepository } from '../../domain/ports/Repository.js';
import type { EvaluationOrchestrator } from '../../application/EvaluationOrchestrator.js';
import { StartAttemptRequestSchema, SubmitAttemptRequestSchema } from '../validation.js';

// Task 11 only defines schemas for the request bodies that existed at the time; retry-evaluation
// needs its own tiny one — not worth a shared file for a single { evaluatorId } shape.
const RetryEvaluationRequestSchema = z.object({ evaluatorId: z.string().min(1) });

export function attemptsRouter(
  attempts: AttemptRepository,
  evaluations: EvaluationRepository,
  orchestrator: EvaluationOrchestrator,
): Router {
  const router = Router();

  router.post('/attempts', async (req, res, next) => {
    const parsed = StartAttemptRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const attempt = await orchestrator.startAttempt(parsed.data.learnerId, parsed.data.problemId);
      res.status(201).json({ id: attempt.id, state: attempt.getState() });
    } catch (err) {
      next(err);
    }
  });

  // Returns immediately once submitAttempt resolves — evaluators run fire-and-forget behind it,
  // so evaluations are still Pending/Running here, never Completed in this response.
  router.post('/attempts/:id/submit', async (req, res, next) => {
    const parsed = SubmitAttemptRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const outcome = await orchestrator.submitAttempt(req.params.id, parsed.data.rawContent, parsed.data.format);
      res.status(200).json(outcome);
    } catch (err) {
      next(err);
    }
  });

  router.get('/attempts/:id', async (req, res, next) => {
    try {
      const attempt = await attempts.findById(req.params.id);
      if (!attempt) {
        res.status(404).json({ error: `attempt not found: ${req.params.id}` });
        return;
      }
      const attemptEvaluations = await evaluations.findByAttemptId(req.params.id);
      res.json({
        id: attempt.id,
        learnerId: attempt.learnerId,
        problemId: attempt.problemId,
        state: attempt.getState(),
        evaluations: attemptEvaluations.map((evaluation) => ({
          id: evaluation.id,
          evaluatorId: evaluation.evaluatorId,
          state: evaluation.getState(),
          feedback: evaluation.getState() === 'Completed' ? evaluation.getFeedback() : null,
          failureReason: evaluation.getState() === 'Failed' ? evaluation.getFailureReason() : null,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/attempts/:id/retry-evaluation', async (req, res, next) => {
    const parsed = RetryEvaluationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const result = await orchestrator.retryEvaluation(req.params.id, parsed.data.evaluatorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
