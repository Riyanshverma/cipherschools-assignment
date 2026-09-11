import type { Submission } from './Submission.js';

export type AttemptState = 'Draft' | 'Submitted';
export type SubmitResult =
  | { kind: 'accepted' }
  | { kind: 'idempotentReplay' }
  | { kind: 'conflict'; message: string };

export class Attempt {
  private state: AttemptState = 'Draft';
  private submission: Submission | null = null;

  constructor(
    readonly id: string,
    readonly learnerId: string,
    readonly problemId: string,
    readonly createdAt: Date,
  ) {}

  getState(): AttemptState {
    return this.state;
  }

  getSubmission(): Submission | null {
    return this.submission;
  }

  submit(submission: Submission): SubmitResult {
    if (this.state === 'Draft') {
      this.submission = submission;
      this.state = 'Submitted';
      return { kind: 'accepted' };
    }

    if (this.submission?.contentHash === submission.contentHash) {
      return { kind: 'idempotentReplay' };
    }

    return { kind: 'conflict', message: 'this attempt is already submitted — start a new attempt.' };
  }
}
