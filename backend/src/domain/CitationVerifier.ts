import type { DesignDocument } from './DesignDocument.js';
import type { RawCriterionFeedback } from './ports/Evaluator.js';
import type { CriterionFeedback } from './Feedback.js';
import type { Confidence } from './types.js';

const CONFIDENCE_ORDER: Confidence[] = ['none', 'low', 'medium', 'high'];

function downgrade(confidence: Confidence): Confidence {
  const index = CONFIDENCE_ORDER.indexOf(confidence);
  return CONFIDENCE_ORDER[Math.max(0, index - 1)];
}

export class CitationVerifier {
  static verify(criteria: RawCriterionFeedback[], document: DesignDocument): CriterionFeedback[] {
    return criteria.map((c) => {
      const verifiedEvidence = c.evidence.filter(
        (citation) => document.verifyQuote(citation.sectionKey, citation.quote),
      );
      const anyDropped = verifiedEvidence.length < c.evidence.length;
      return {
        ...c,
        evidence: verifiedEvidence,
        confidence: anyDropped ? downgrade(c.confidence) : c.confidence,
      };
    });
  }
}
