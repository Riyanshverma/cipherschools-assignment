import { REQUIRED_SECTION_KEYS, type SectionKey, type LineRange } from './types.js';

export interface Section { key: SectionKey; heading: string; text: string; lineRange: LineRange }
export interface CodeBlock { language: string | null; content: string; lineRange: LineRange }

export class DesignDocument {
  constructor(
    private readonly sections: Map<SectionKey, Section>,
    private readonly codeBlocks: CodeBlock[],
    private readonly diagramSource: string | null,
  ) {}

  getSection(key: SectionKey): Section | undefined {
    return this.sections.get(key);
  }

  missingRequiredSections(): SectionKey[] {
    return REQUIRED_SECTION_KEYS.filter((key) => !this.sections.has(key));
  }

  emptyRequiredSections(): SectionKey[] {
    return REQUIRED_SECTION_KEYS.filter((key) => {
      const section = this.sections.get(key);
      return section !== undefined && section.text.trim() === '';
    });
  }

  getCodeBlocks(): CodeBlock[] {
    return this.codeBlocks;
  }

  getDiagramSource(): string | null {
    return this.diagramSource;
  }

  verifyQuote(sectionKey: SectionKey, quote: string): boolean {
    const section = this.sections.get(sectionKey);
    if (!section) return false;
    return section.text.includes(quote);
  }
}
