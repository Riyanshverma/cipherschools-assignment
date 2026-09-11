import type Database from 'better-sqlite3';
import { Attempt, type AttemptState } from '../../../domain/Attempt.js';
import { Submission } from '../../../domain/Submission.js';
import { DesignDocument, type Section, type CodeBlock } from '../../../domain/DesignDocument.js';
import { REQUIRED_SECTION_KEYS } from '../../../domain/types.js';
import type { AttemptRepository } from '../../../domain/ports/Repository.js';

interface DesignDocumentJSON {
  sections: Section[];
  codeBlocks: CodeBlock[];
  diagramSource: string | null;
}

// DesignDocument keeps its `sections` map private, exposing only getSection(key) — and
// SectionKey is a closed union whose every member is listed in REQUIRED_SECTION_KEYS, so
// walking that fixed list via the public getter reaches every section without needing
// access to the private map.
function documentToJSON(doc: DesignDocument): DesignDocumentJSON {
  const sections = REQUIRED_SECTION_KEYS.map((key) => doc.getSection(key)).filter((s): s is Section => s !== undefined);
  return {
    sections,
    codeBlocks: doc.getCodeBlocks(),
    diagramSource: doc.getDiagramSource(),
  };
}

function documentFromJSON(json: DesignDocumentJSON): DesignDocument {
  return new DesignDocument(new Map(json.sections.map((s) => [s.key, s])), json.codeBlocks, json.diagramSource);
}

interface AttemptRow {
  id: string;
  learner_id: string;
  problem_id: string;
  state: AttemptState;
  created_at: string;
  submission_raw_content: string | null;
  submission_format: string | null;
  submission_document_json: string | null;
  submission_content_hash: string | null;
  submission_submitted_at: string | null;
}

/** Translates Attempt <-> the `attempts` table. No business rules live here. */
export class SqliteAttemptRepository implements AttemptRepository {
  constructor(private readonly db: Database.Database) {}

  async save(attempt: Attempt): Promise<void> {
    const submission = attempt.getSubmission();
    this.db
      .prepare(
        `INSERT INTO attempts (
           id, learner_id, problem_id, state, created_at,
           submission_raw_content, submission_format, submission_document_json,
           submission_content_hash, submission_submitted_at
         ) VALUES (
           @id, @learnerId, @problemId, @state, @createdAt,
           @rawContent, @format, @documentJson, @contentHash, @submittedAt
         )
         ON CONFLICT(id) DO UPDATE SET
           state = excluded.state,
           submission_raw_content = excluded.submission_raw_content,
           submission_format = excluded.submission_format,
           submission_document_json = excluded.submission_document_json,
           submission_content_hash = excluded.submission_content_hash,
           submission_submitted_at = excluded.submission_submitted_at`,
      )
      .run({
        id: attempt.id,
        learnerId: attempt.learnerId,
        problemId: attempt.problemId,
        state: attempt.getState(),
        createdAt: attempt.createdAt.toISOString(),
        rawContent: submission?.rawContent ?? null,
        format: submission?.format ?? null,
        documentJson: submission ? JSON.stringify(documentToJSON(submission.document)) : null,
        contentHash: submission?.contentHash ?? null,
        submittedAt: submission ? submission.submittedAt.toISOString() : null,
      });
  }

  async findById(id: string): Promise<Attempt | null> {
    const row = this.db.prepare('SELECT * FROM attempts WHERE id = ?').get(id) as AttemptRow | undefined;
    return row ? this.toDomain(row) : null;
  }

  async findByLearnerAndProblem(learnerId: string, problemId: string): Promise<Attempt[]> {
    const rows = this.db
      .prepare('SELECT * FROM attempts WHERE learner_id = ? AND problem_id = ?')
      .all(learnerId, problemId) as AttemptRow[];
    return rows.map((row) => this.toDomain(row));
  }

  async findByLearner(learnerId: string): Promise<Attempt[]> {
    const rows = this.db.prepare('SELECT * FROM attempts WHERE learner_id = ?').all(learnerId) as AttemptRow[];
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: AttemptRow): Attempt {
    const attempt = new Attempt(row.id, row.learner_id, row.problem_id, new Date(row.created_at));
    if (row.state === 'Submitted' && row.submission_raw_content !== null) {
      const document = documentFromJSON(JSON.parse(row.submission_document_json!) as DesignDocumentJSON);
      // Submission's only public factory is create() — contentHash is a pure sha256 of
      // rawContent, so recomputing it here reproduces the exact stored hash losslessly.
      const submission = Submission.create(
        row.submission_raw_content,
        row.submission_format!,
        document,
        new Date(row.submission_submitted_at!),
      );
      attempt.submit(submission);
    }
    return attempt;
  }
}
