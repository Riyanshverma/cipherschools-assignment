import type { DesignDocument } from '../../domain/DesignDocument.js';
import type { Rubric } from '../../domain/Rubric.js';
import { REQUIRED_SECTION_KEYS, type AnchorScore, type Dimension } from '../../domain/types.js';
import type {
  Evaluator, EvaluationOutcome, EvaluationRecorder, ProblemContext, RawCriterionFeedback,
} from '../../domain/ports/Evaluator.js';

// The 3 dimensions decision 10 deems genuinely deterministic; the remaining 5
// (class responsibilities, coupling/cohesion, encapsulation, abstraction, extensibility)
// require design judgment and are always abstained here — never heuristically guessed.
const SCORED_DIMENSIONS: readonly Dimension[] = [
  'requirementUnderstanding', 'edgeCasesTestability', 'explanationQuality',
];

const REASONING_MARKERS = ['because', 'so that', 'trade-off', 'however', 'in order to'];

function scoreRequirementUnderstanding(doc: DesignDocument): AnchorScore {
  const length = (doc.getSection('requirementsAssumptions')?.text ?? '').trim().length;
  if (length < 50) return 0;
  if (length < 150) return 1;
  if (length < 300) return 2;
  if (length < 600) return 3;
  return 4;
}

function countEdgeCaseMarkers(text: string): number {
  const bulletLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-') || line.startsWith('*'));
  if (bulletLines.length > 0) return bulletLines.length;

  // No bullet markers — fall back to counting sentences as the edge-case unit.
  return text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0).length;
}

function scoreEdgeCasesTestability(doc: DesignDocument): AnchorScore {
  const text = doc.getSection('edgeCasesTestability')?.text ?? '';
  const markers = countEdgeCaseMarkers(text);
  if (markers === 0) return 0;
  if (markers === 1) return 1;
  if (markers === 2) return 2;
  if (markers <= 4) return 3;
  return 4;
}

function wholeDocumentText(doc: DesignDocument): string {
  return REQUIRED_SECTION_KEYS
    .map((key) => doc.getSection(key)?.text ?? '')
    .join('\n');
}

function scoreExplanationQuality(doc: DesignDocument): AnchorScore {
  const text = wholeDocumentText(doc).toLowerCase();
  const markerCount = REASONING_MARKERS.reduce(
    (count, marker) => count + (text.includes(marker) ? 1 : 0),
    0,
  );
  // Deliberately coarse per decision 10: skip buckets 1 and 3.
  if (markerCount === 0) return 0;
  if (markerCount === 1) return 2;
  return 4;
}

function buildScoredCriterion(criterion: Dimension, score: AnchorScore, basis: string): RawCriterionFeedback {
  return {
    criterion, score, evidence: [], strength: basis,
    concern: null, whyItMatters: null, suggestion: null, confidence: 'high',
  };
}

function buildAbstainedCriterion(criterion: Dimension): RawCriterionFeedback {
  return {
    criterion, score: null, evidence: [], strength: null,
    concern: null, whyItMatters: null, suggestion: null, confidence: 'none',
  };
}

/**
 * Deterministic evaluator. Scores 3 rubric dimensions with cheap, explainable
 * heuristics (length/coverage, marker counting, reasoning-marker presence) and
 * abstains on the 5 that require actual design judgment — see decision 10.
 */
export class RuleBasedEvaluator implements Evaluator {
  readonly id = 'rule-based';

  start(
    evaluationId: string, document: DesignDocument, rubric: Rubric,
    _context: ProblemContext, recorder: EvaluationRecorder,
  ): void {
    const criteria: RawCriterionFeedback[] = rubric.getDimensions().map((dimension) => {
      if (!SCORED_DIMENSIONS.includes(dimension)) return buildAbstainedCriterion(dimension);

      switch (dimension) {
        case 'requirementUnderstanding':
          return buildScoredCriterion(
            dimension, scoreRequirementUnderstanding(document),
            'Scored by length/coverage of the requirements & assumptions section.',
          );
        case 'edgeCasesTestability':
          return buildScoredCriterion(
            dimension, scoreEdgeCasesTestability(document),
            'Scored by counting distinct edge-case markers in the edge cases section.',
          );
        case 'explanationQuality':
          return buildScoredCriterion(
            dimension, scoreExplanationQuality(document),
            'Scored by presence of reasoning markers (e.g. "because", "trade-off") in the document.',
          );
        default:
          return buildAbstainedCriterion(dimension);
      }
    });

    const outcome: EvaluationOutcome = {
      kind: 'completed',
      summary: 'Rule-based evaluation: scored 3 deterministic dimensions, abstained on 5 requiring design judgment.',
      criteria,
    };

    // Fire-and-forget per the Evaluator port: report asynchronously, not as a
    // synchronous return value.
    queueMicrotask(() => {
      void recorder.record(evaluationId, outcome);
    });
  }
}
