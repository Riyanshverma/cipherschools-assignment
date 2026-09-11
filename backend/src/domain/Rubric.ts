import { ALL_DIMENSIONS, type Dimension, type AnchorScore } from './types.js';

export interface Anchor { score: AnchorScore; label: string; description: string }
export interface DimensionDef { key: Dimension; anchors: Anchor[] }
export interface AggregateScore { total: number; maxPossible: number }

export class Rubric {
  constructor(
    readonly version: string,
    private readonly dimensions: DimensionDef[],
    private readonly weights: Partial<Record<Dimension, number>>,
    readonly scopeBoundary: string,
  ) {}

  getDimensions(): Dimension[] {
    return this.dimensions.map((d) => d.key);
  }

  getWeight(dimension: Dimension): number {
    return this.weights[dimension] ?? 1;
  }

  getAnchor(dimension: Dimension, score: AnchorScore): Anchor {
    const dimensionDef = this.dimensions.find((d) => d.key === dimension);
    if (!dimensionDef) throw new Error(`Unknown dimension: ${dimension}`);
    const anchor = dimensionDef.anchors.find((a) => a.score === score);
    if (!anchor) throw new Error(`No anchor for dimension ${dimension} at score ${score}`);
    return anchor;
  }

  aggregate(scores: Map<Dimension, AnchorScore>): AggregateScore | null {
    if (ALL_DIMENSIONS.some((d) => !scores.has(d))) return null;
    let total = 0;
    let maxPossible = 0;
    for (const dimension of ALL_DIMENSIONS) {
      const weight = this.getWeight(dimension);
      total += (scores.get(dimension) as AnchorScore) * weight;
      maxPossible += 4 * weight;
    }
    return { total, maxPossible };
  }
}
