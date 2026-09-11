import type { DesignDocument } from '../../domain/DesignDocument.js';
import type { Rubric } from '../../domain/Rubric.js';
import type { LlmClient } from '../../domain/ports/LlmClient.js';
import type {
  Evaluator, EvaluationRecorder, ProblemContext, RawCriterionFeedback,
} from '../../domain/ports/Evaluator.js';
import { FeedbackResponseSchema, FEEDBACK_JSON_SCHEMA } from './feedbackSchema.js';
import { buildPrompt } from './promptBuilder.js';

const MAX_COMPLETION_TOKENS = 4000;
const SCHEMA_NAME = 'Feedback';

/**
 * Real, LLM-backed Evaluator. Never abstains (score is always 0-4, confidence
 * is never 'none' — those are rule-based-only concepts). Retries on a
 * malformed response (failed Zod validation) or a thrown LlmClient error, up
 * to `1 + maxRetries` total attempts, before reporting failure.
 */
export class AiEvaluator implements Evaluator {
  readonly id = 'ai';

  constructor(private readonly llmClient: LlmClient, private readonly maxRetries: number) {}

  start(
    evaluationId: string, document: DesignDocument, rubric: Rubric,
    context: ProblemContext, recorder: EvaluationRecorder,
  ): void {
    // Fire-and-forget per the Evaluator port — report asynchronously via recorder.
    void this.run(evaluationId, document, rubric, context, recorder);
  }

  private async run(
    evaluationId: string, document: DesignDocument, rubric: Rubric,
    context: ProblemContext, recorder: EvaluationRecorder,
  ): Promise<void> {
    const { systemPrompt, userPrompt } = buildPrompt(document, rubric, context);
    const totalAttempts = 1 + this.maxRetries;

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      try {
        const raw = await this.llmClient.completeJson({
          systemPrompt, userPrompt,
          jsonSchema: FEEDBACK_JSON_SCHEMA, schemaName: SCHEMA_NAME,
          maxCompletionTokens: MAX_COMPLETION_TOKENS,
        });
        const parsed = FeedbackResponseSchema.safeParse(raw);
        if (parsed.success) {
          const criteria: RawCriterionFeedback[] = parsed.data.criteria.map((c) => ({
            criterion: c.criterion, score: c.score, evidence: c.evidence, strength: c.strength,
            concern: c.concern, whyItMatters: c.whyItMatters, suggestion: c.suggestion,
            confidence: c.confidence,
          }));
          await recorder.record(evaluationId, { kind: 'completed', summary: parsed.data.summary, criteria });
          return;
        }
      } catch {
        // Thrown LlmClient errors count toward the same retry budget as a validation failure.
      }
    }

    await recorder.record(evaluationId, { kind: 'failed', reason: 'invalid AI response after retries' });
  }
}
