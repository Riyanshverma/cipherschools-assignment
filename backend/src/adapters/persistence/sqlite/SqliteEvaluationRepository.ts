import type Database from 'better-sqlite3';
import { Evaluation, type EvaluationState } from '../../../domain/Evaluation.js';
import { Feedback, type CriterionFeedback } from '../../../domain/Feedback.js';
import type { AggregateScore } from '../../../domain/Rubric.js';
import type { Dimension } from '../../../domain/types.js';
import type { EvaluationRepository } from '../../../domain/ports/Repository.js';

interface FeedbackJSON {
  summary: string;
  criteria: CriterionFeedback[];
  topPriorities: Dimension[];
  aggregateScore: AggregateScore | null;
}

interface EvaluationRow {
  id: string;
  attempt_id: string;
  evaluator_id: string;
  rubric_version: string;
  state: EvaluationState;
  created_at: string;
  failure_reason: string | null;
  feedback_json: string | null;
}

/** Translates Evaluation <-> the `evaluations` table. No business rules live here. */
export class SqliteEvaluationRepository implements EvaluationRepository {
  constructor(private readonly db: Database.Database) {}

  async save(evaluation: Evaluation): Promise<void> {
    const feedback = evaluation.getFeedback();
    const feedbackJson: FeedbackJSON | null = feedback
      ? {
          summary: feedback.summary,
          criteria: feedback.criteria,
          topPriorities: feedback.topPriorities,
          aggregateScore: feedback.aggregateScore,
        }
      : null;

    this.db
      .prepare(
        `INSERT INTO evaluations (
           id, attempt_id, evaluator_id, rubric_version, state, created_at, failure_reason, feedback_json
         ) VALUES (
           @id, @attemptId, @evaluatorId, @rubricVersion, @state, @createdAt, @failureReason, @feedbackJson
         )
         ON CONFLICT(id) DO UPDATE SET
           state = excluded.state,
           failure_reason = excluded.failure_reason,
           feedback_json = excluded.feedback_json`,
      )
      .run({
        id: evaluation.id,
        attemptId: evaluation.attemptId,
        evaluatorId: evaluation.evaluatorId,
        rubricVersion: evaluation.rubricVersion,
        state: evaluation.getState(),
        createdAt: evaluation.createdAt.toISOString(),
        failureReason: evaluation.getFailureReason(),
        feedbackJson: feedbackJson ? JSON.stringify(feedbackJson) : null,
      });
  }

  async findById(id: string): Promise<Evaluation | null> {
    const row = this.db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id) as EvaluationRow | undefined;
    return row ? this.toDomain(row) : null;
  }

  async findByAttemptId(attemptId: string): Promise<Evaluation[]> {
    const rows = this.db
      .prepare('SELECT * FROM evaluations WHERE attempt_id = ?')
      .all(attemptId) as EvaluationRow[];
    return rows.map((row) => this.toDomain(row));
  }

  async findAllRunning(): Promise<Evaluation[]> {
    const rows = this.db.prepare("SELECT * FROM evaluations WHERE state = 'Running'").all() as EvaluationRow[];
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: EvaluationRow): Evaluation {
    const evaluation = new Evaluation(row.id, row.attempt_id, row.evaluator_id, row.rubric_version, new Date(row.created_at));
    switch (row.state) {
      case 'Pending':
        break;
      case 'Running':
        evaluation.markRunning();
        break;
      case 'Completed': {
        evaluation.markRunning();
        const feedbackJson = JSON.parse(row.feedback_json!) as FeedbackJSON;
        evaluation.complete(Feedback.fromJSON(feedbackJson));
        break;
      }
      case 'Failed':
        evaluation.fail(row.failure_reason ?? '');
        break;
    }
    return evaluation;
  }
}
