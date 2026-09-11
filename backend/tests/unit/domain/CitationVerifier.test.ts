import { describe, it, expect } from 'vitest';
import { CitationVerifier } from '../../../src/domain/CitationVerifier.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';
import type { RawCriterionFeedback } from '../../../src/domain/ports/Evaluator.js';

function docWithSection(text: string) {
  const sections = new Map();
  sections.set('classesResponsibilities', { key: 'classesResponsibilities', heading: 'h', text, lineRange: { start: 1, end: 1 } });
  return new DesignDocument(sections, [], null);
}

describe('CitationVerifier', () => {
  it('keeps a citation whose quote is present in the document', () => {
    const raw: RawCriterionFeedback[] = [{
      criterion: 'classResponsibilities', score: 3,
      evidence: [{ sectionKey: 'classesResponsibilities', quote: 'ParkingLot owns spots', lineRange: { start: 1, end: 1 } }],
      strength: 'ok', concern: null, whyItMatters: null, suggestion: null, confidence: 'high',
    }];
    const result = CitationVerifier.verify(raw, docWithSection('ParkingLot owns spots and tickets.'));
    expect(result[0].evidence).toHaveLength(1);
    expect(result[0].confidence).toBe('high');
  });

  it('drops a fabricated quote and downgrades confidence', () => {
    const raw: RawCriterionFeedback[] = [{
      criterion: 'classResponsibilities', score: 3,
      evidence: [{ sectionKey: 'classesResponsibilities', quote: 'this text does not exist', lineRange: { start: 1, end: 1 } }],
      strength: 'ok', concern: null, whyItMatters: null, suggestion: null, confidence: 'high',
    }];
    const result = CitationVerifier.verify(raw, docWithSection('ParkingLot owns spots.'));
    expect(result[0].evidence).toHaveLength(0);
    expect(result[0].confidence).toBe('medium');
  });
});
