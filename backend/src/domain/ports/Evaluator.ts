import type { DesignDocument } from '../DesignDocument.js';
import type { Rubric } from '../Rubric.js';
import type { AnchorScore, Confidence, Dimension, LineRange, SectionKey } from '../types.js';

export interface ProblemContext { problemId: string; requirements: string; scopeBoundary: string }
export interface Citation { sectionKey: SectionKey; quote: string; lineRange: LineRange }
export interface RawCriterionFeedback {
  criterion: Dimension; score: AnchorScore | null; // null = abstained
  evidence: Citation[]; strength: string | null;
  concern: string | null; whyItMatters: string | null; suggestion: string | null;
  confidence: Confidence;
}
export type EvaluationOutcome =
  | { kind: 'completed'; summary: string; criteria: RawCriterionFeedback[] }
  | { kind: 'failed'; reason: string };

export interface EvaluationRecorder {
  record(evaluationId: string, outcome: EvaluationOutcome): Promise<void>;
}
export interface Evaluator {
  readonly id: string; // 'ai' | 'rule-based' | 'fake'
  start(
    evaluationId: string, document: DesignDocument, rubric: Rubric,
    context: ProblemContext, recorder: EvaluationRecorder,
  ): void;
}
