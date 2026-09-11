import { describe, it, expect } from 'vitest';
import { MarkdownFormatAdapter } from '../../../src/adapters/format/MarkdownFormatAdapter.js';

const adapter = new MarkdownFormatAdapter();

const fullDoc = `
# Requirements & Assumptions
We assume single-floor parking.

# Classes & Responsibilities
ParkingLot owns spot allocation.

# Relationships & Interactions
ParkingLot has many Spots.

# Key Behaviour & Rules
A Spot transitions Free -> Occupied on park().

# Edge Cases & Testability
Full lot rejects new vehicles.

# Trade-offs & Extensibility
Pricing could move behind a strategy.

# Diagram
\`\`\`mermaid
classDiagram
  ParkingLot --> Spot
\`\`\`
`;

describe('MarkdownFormatAdapter', () => {
  it('parses all six required sections plus optional diagram', () => {
    const doc = adapter.parse(fullDoc);
    expect(doc.missingRequiredSections()).toEqual([]);
    expect(doc.getDiagramSource()).toContain('classDiagram');
  });

  it('tolerantly matches a renamed heading ("Requirements" alone)', () => {
    const renamed = fullDoc.replace('# Requirements & Assumptions', '# Requirements');
    const doc = adapter.parse(renamed);
    expect(doc.missingRequiredSections()).not.toContain('requirementsAssumptions');
  });

  it('reports a missing required section', () => {
    const missing = fullDoc.replace(/# Trade-offs & Extensibility[\s\S]*$/, '');
    const doc = adapter.parse(missing);
    expect(doc.missingRequiredSections()).toContain('tradeoffsExtensibility');
  });

  it('reports a whitespace-only section as empty, not missing', () => {
    const blanked = fullDoc.replace('A Spot transitions Free -> Occupied on park().', '   ');
    const doc = adapter.parse(blanked);
    expect(doc.emptyRequiredSections()).toContain('keyBehaviourRules');
  });

  it('extracts fenced code blocks with language', () => {
    const withCode = fullDoc.replace(
      'ParkingLot owns spot allocation.',
      'ParkingLot owns spot allocation.\n```ts\nclass ParkingLot {}\n```',
    );
    const doc = adapter.parse(withCode);
    expect(doc.getCodeBlocks()[0].language).toBe('ts');
  });

  it('accepts the submission with an empty diagram slot when mermaid is unparseable garbage', () => {
    const badMermaid = fullDoc.replace('classDiagram\n  ParkingLot --> Spot', '@@@ not mermaid @@@');
    const doc = adapter.parse(badMermaid);
    expect(doc.missingRequiredSections()).toEqual([]); // submission still accepted
    expect(doc.getDiagramSource()).toBe('@@@ not mermaid @@@'); // stored as-is; not domain's job to validate mermaid syntax
  });
});
