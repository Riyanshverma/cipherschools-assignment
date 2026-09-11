import type { FormatAdapter } from '../../domain/ports/FormatAdapter.js';
import { DesignDocument, type Section, type CodeBlock } from '../../domain/DesignDocument.js';
import type { SectionKey, LineRange } from '../../domain/types.js';

const HEADING_LINE = /^#{1,6}\s+(.+?)\s*$/;
const FENCE_LINE = /^```(\S*)\s*$/;

/** Raw heading text examples from the plan's alias table, keyed by canonical section. */
const RAW_ALIASES: Record<SectionKey | 'diagram', string[]> = {
  requirementsAssumptions: ['Requirements & Assumptions', 'Requirements / Assumptions', 'Requirements'],
  classesResponsibilities: ['Classes & Responsibilities', 'Classes and Responsibilities'],
  relationshipsInteractions: ['Relationships & Interactions', 'Relationships'],
  keyBehaviourRules: ['Key Behaviour & Rules', 'Key Behavior and Rules', 'Behaviour & Rules'],
  edgeCasesTestability: ['Edge Cases & Testability', 'Edge Cases and Testability'],
  tradeoffsExtensibility: ['Trade-offs & Extensibility', 'Tradeoffs & Extensibility'],
  diagram: ['Diagram'],
};

/** Lowercase, unify Commonwealth/US spelling, drop the word "and", strip all non-letters. */
function normalizeHeading(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/behaviour/g, 'behavior')
    .replace(/\band\b/g, ' ')
    .replace(/[^a-z]/g, '');
}

const ALIAS_TO_KEY = new Map<string, SectionKey | 'diagram'>();
for (const [key, aliases] of Object.entries(RAW_ALIASES) as [SectionKey | 'diagram', string[]][]) {
  for (const alias of aliases) {
    ALIAS_TO_KEY.set(normalizeHeading(alias), key);
  }
}

function matchHeading(headingText: string): SectionKey | 'diagram' | null {
  return ALIAS_TO_KEY.get(normalizeHeading(headingText)) ?? null;
}

/** Finds fenced code blocks (```lang ... ```) within a slice of lines. startLine is 1-based. */
function extractCodeBlocks(lines: string[], startLine: number): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const fence = lines[i].match(FENCE_LINE);
    if (!fence) {
      i++;
      continue;
    }
    const language = fence[1] || null;
    const content: string[] = [];
    let j = i + 1;
    while (j < lines.length && !FENCE_LINE.test(lines[j])) {
      content.push(lines[j]);
      j++;
    }
    const endLine = j < lines.length ? j : lines.length - 1;
    blocks.push({
      language,
      content: content.join('\n'),
      lineRange: { start: startLine + i, end: startLine + endLine },
    });
    i = j + 1;
  }
  return blocks;
}

interface HeadingMatch {
  lineIndex: number; // 0-based
  headingText: string;
  key: SectionKey | 'diagram' | null;
}

export class MarkdownFormatAdapter implements FormatAdapter {
  readonly format = 'markdown';

  parse(rawContent: string): DesignDocument {
    const lines = rawContent.split('\n');
    const headings: HeadingMatch[] = [];
    lines.forEach((line, lineIndex) => {
      const match = line.match(HEADING_LINE);
      if (match) {
        headings.push({ lineIndex, headingText: match[1], key: matchHeading(match[1]) });
      }
    });

    const sections = new Map<SectionKey, Section>();
    const codeBlocks: CodeBlock[] = [];
    let diagramSource: string | null = null;

    headings.forEach((heading, i) => {
      if (heading.key === null) return; // unmatched heading: ignored, not collected

      const contentStart = heading.lineIndex + 1;
      const contentEnd = i + 1 < headings.length ? headings[i + 1].lineIndex : lines.length;
      const segmentLines = lines.slice(contentStart, contentEnd);
      const text = segmentLines.join('\n');
      const lineRange: LineRange = { start: heading.lineIndex + 1, end: Math.max(contentEnd, contentStart) };

      if (heading.key === 'diagram') {
        const [firstBlock] = extractCodeBlocks(segmentLines, contentStart + 1);
        diagramSource = firstBlock ? firstBlock.content : null;
        return;
      }

      sections.set(heading.key, { key: heading.key, heading: heading.headingText, text, lineRange });
      codeBlocks.push(...extractCodeBlocks(segmentLines, contentStart + 1));
    });

    return new DesignDocument(sections, codeBlocks, diagramSource);
  }
}
