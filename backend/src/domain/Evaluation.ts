import type { Feedback } from './Feedback.js';

export type EvaluationState = 'Pending' | 'Running' | 'Completed' | 'Failed';

export class Evaluation {
  private state: EvaluationState = 'Pending';
  private feedback: Feedback | null = null;
  private failureReason: string | null = null;

  constructor(
    readonly id: string,
    readonly attemptId: string,
    readonly evaluatorId: string,
    readonly rubricVersion: string,
    readonly createdAt: Date,
  ) {}

  getState(): EvaluationState {
    return this.state;
  }

  markRunning(): void {
    if (this.state !== 'Pending') {
      throw new Error(`cannot start running from state ${this.state}`);
    }
    this.state = 'Running';
  }

  complete(feedback: Feedback): void {
    if (this.state !== 'Running') {
      throw new Error(`cannot complete from state ${this.state}`);
    }
    this.feedback = feedback;
    this.state = 'Completed';
  }

  fail(reason: string): void {
    if (this.state !== 'Pending' && this.state !== 'Running') {
      throw new Error(`cannot fail from state ${this.state}`);
    }
    this.failureReason = reason;
    this.state = 'Failed';
  }

  markInterrupted(): void {
    if (this.state !== 'Running') return;
    this.failureReason = 'interrupted';
    this.state = 'Failed';
  }

  getFeedback(): Feedback | null {
    return this.feedback;
  }

  getFailureReason(): string | null {
    return this.failureReason;
  }
}
