import type { DesignDocument } from '../DesignDocument.js';

export interface FormatAdapter {
  readonly format: string; // 'markdown'
  parse(rawContent: string): DesignDocument; // throws FormatParseError only if truly unparseable
}

export class FormatParseError extends Error {}
