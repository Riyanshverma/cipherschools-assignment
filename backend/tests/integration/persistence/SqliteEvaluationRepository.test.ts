import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb, runMigrations } from '../../../src/adapters/persistence/sqlite/db.js';
import { SqliteEvaluationRepository } from '../../../src/adapters/persistence/sqlite/SqliteEvaluationRepository.js';
import { Evaluation } from '../../../src/domain/Evaluation.js';
import { Feedback } from '../../../src/domain/Feedback.js';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type Dimension, type AnchorScore } from '../../../src/domain/types.js';
import type { CriterionFeedback } from '../../../src/domain/Feedback.js';

function rubric(): Rubric {
  const dimensions = ALL_DIMENSIONS.map((key) => ({
    key,
    anchors: [0, 1, 2, 3, 4].map((score) => ({ score: score as AnchorScore, label: `L${score}`, description: `D${score}` })),
  }));
  const weights = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, 1])) as Record<Dimension, number>;
  return new Rubric('v1', dimensions, weights, 'scope');
}

function minimalCriterion(): CriterionFeedback {
  return {
    criterion: 'requirementUnderstanding', score: 3, evidence: [], strength: 'ok',
    concern: null, whyItMatters: null, suggestion: null, confidence: 'high',
  };
}

describe('SqliteEvaluationRepository', () => {
  let db: Database.Database;
  let repo: SqliteEvaluationRepository;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    repo = new SqliteEvaluationRepository(db);
  });

  it('finds evaluations stranded in Running for the startup sweep', async () => {
    const running = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    running.markRunning();
    await repo.save(running);
    const pending = new Evaluation('e2', 'a1', 'rule-based', 'v1', new Date());
    await repo.save(pending);

    const stranded = await repo.findAllRunning();
    expect(stranded.map((e) => e.id)).toEqual(['e1']);
  });

  it('round-trips a Completed evaluation with feedback', async () => {
    const evaluation = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    evaluation.markRunning();
    const feedback = Feedback.build('looks solid overall', [minimalCriterion()], rubric());
    evaluation.complete(feedback);

    await repo.save(evaluation);
    const loaded = await repo.findById('e1');

    expect(loaded?.getState()).toBe('Completed');
    expect(loaded?.getFeedback()?.summary).toBe('looks solid overall');
  });

  it('round-trips a Failed evaluation with its failure reason', async () => {
    const evaluation = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    evaluation.markRunning();
    evaluation.fail('timeout');

    await repo.save(evaluation);
    const loaded = await repo.findById('e1');

    expect(loaded?.getState()).toBe('Failed');
    expect(loaded?.getFailureReason()).toBe('timeout');
  });
});
