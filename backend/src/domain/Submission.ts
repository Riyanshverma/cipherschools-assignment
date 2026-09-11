import { createHash } from 'node:crypto';
import type { DesignDocument } from './DesignDocument.js';

export class Submission {
  private constructor(
    readonly rawContent: string,
    readonly format: string,
    readonly document: DesignDocument,
    readonly contentHash: string,
    readonly submittedAt: Date,
  ) {}

  static create(rawContent: string, format: string, document: DesignDocument, now: Date): Submission {
    const contentHash = createHash('sha256').update(rawContent).digest('hex');
    return new Submission(rawContent, format, document, contentHash, now);
  }
}
