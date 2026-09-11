import type { Dimension } from './types.js';

export class Problem {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly requirements: string,
    readonly scopeBoundary: string,
    readonly rubricWeights: Partial<Record<Dimension, number>>,
  ) {}
}
