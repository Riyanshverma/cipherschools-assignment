import { describe, it, expect } from 'vitest';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';

function doc(overrides: Partial<Record<string, string>> = {}) {
  const sections = new Map();
  const keys = ['requirementsAssumptions','classesResponsibilities','relationshipsInteractions',
    'keyBehaviourRules','edgeCasesTestability','tradeoffsExtensibility'] as const;
  for (const k of keys) {
    if (overrides[k] === undefined || overrides[k] !== null) {
      sections.set(k, { key: k, heading: k, text: overrides[k] ?? 'some content', lineRange: { start: 1, end: 2 } });
    }
  }
  return new DesignDocument(sections, [], null);
}

describe('DesignDocument', () => {
  it('reports no missing sections when all six present', () => {
    expect(doc().missingRequiredSections()).toEqual([]);
  });

  it('reports a missing required section', () => {
    const sections = new Map();
    sections.set('requirementsAssumptions', { key: 'requirementsAssumptions', heading: 'x', text: 'y', lineRange: { start: 1, end: 1 } });
    const d = new DesignDocument(sections, [], null);
    expect(d.missingRequiredSections()).toContain('classesResponsibilities');
  });

  it('reports an empty (whitespace-only) required section', () => {
    const d = doc({ keyBehaviourRules: '   \n  ' });
    expect(d.emptyRequiredSections()).toEqual(['keyBehaviourRules']);
  });

  it('verifies a quote present in the named section', () => {
    const d = doc({ classesResponsibilities: 'ParkingLot owns allocation.' });
    expect(d.verifyQuote('classesResponsibilities', 'owns allocation')).toBe(true);
  });

  it('rejects a fabricated quote', () => {
    const d = doc({ classesResponsibilities: 'ParkingLot owns allocation.' });
    expect(d.verifyQuote('classesResponsibilities', 'does not exist anywhere')).toBe(false);
  });

  it('returns null diagram source when absent', () => {
    expect(doc().getDiagramSource()).toBeNull();
  });
});
