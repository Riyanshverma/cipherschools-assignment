import type { Evaluator, EvaluationRecorder, ProblemContext, EvaluationOutcome } from '../../domain/ports/Evaluator.js';
import type { DesignDocument } from '../../domain/DesignDocument.js';
import type { Rubric } from '../../domain/Rubric.js';

export type FakeMode = { kind: 'complete'; outcome: EvaluationOutcome } | { kind: 'timeout' };

const TRIVIAL_PASSING_OUTCOME: EvaluationOutcome = { kind: 'completed', summary: 'ok', criteria: [] };

/**
 * Real, deterministic third Evaluator adapter — no network/LLM calls.
 * Lets tests program outcomes ('complete') or exercise an orchestrator's
 * own timeout logic ('timeout', which never calls recorder.record).
 */
export class FakeEvaluator implements Evaluator {
  readonly id = 'fake';

  constructor(private mode: FakeMode = { kind: 'complete', outcome: TRIVIAL_PASSING_OUTCOME }) {}

  setMode(mode: FakeMode): void {
    this.mode = mode;
  }

  start(
    evaluationId: string,
    _document: DesignDocument,
    _rubric: Rubric,
    _context: ProblemContext,
    recorder: EvaluationRecorder,
  ): void {
    if (this.mode.kind === 'timeout') return;
    const outcome = this.mode.outcome;
    queueMicrotask(() => {
      void recorder.record(evaluationId, outcome);
    });
  }
}
