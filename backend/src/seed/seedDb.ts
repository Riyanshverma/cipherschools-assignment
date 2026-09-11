import type Database from 'better-sqlite3';
import { SEED_PROBLEMS } from './problems.js';
import { GLOBAL_RUBRIC_DIMENSIONS, RUBRIC_VERSION } from './rubric.js';
import { SqliteLearnerRepository } from '../adapters/persistence/sqlite/SqliteLearnerRepository.js';
import { SqliteAttemptRepository } from '../adapters/persistence/sqlite/SqliteAttemptRepository.js';
import { SqliteEvaluationRepository } from '../adapters/persistence/sqlite/SqliteEvaluationRepository.js';
import { Learner } from '../domain/Learner.js';
import { Attempt } from '../domain/Attempt.js';
import { Submission } from '../domain/Submission.js';
import { DesignDocument } from '../domain/DesignDocument.js';
import { Evaluation } from '../domain/Evaluation.js';
import { Feedback, type CriterionFeedback } from '../domain/Feedback.js';
import { Rubric } from '../domain/Rubric.js';
import { ALL_DIMENSIONS, REQUIRED_SECTION_KEYS, type AnchorScore, type Dimension } from '../domain/types.js';
import type { Problem } from '../domain/Problem.js';

/** `problems` has no `save()` on its port (read-only from the app's point of view), so this
 * seeds it directly — `INSERT OR IGNORE` on the primary key keeps re-runs idempotent. */
function seedProblems(db: Database.Database): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO problems (id, title, requirements, scope_boundary, rubric_weights_json)
     VALUES (@id, @title, @requirements, @scopeBoundary, @weights)`,
  );
  for (const problem of SEED_PROBLEMS) {
    insert.run({
      id: problem.id,
      title: problem.title,
      requirements: problem.requirements,
      scopeBoundary: problem.scopeBoundary,
      weights: JSON.stringify(problem.rubricWeights),
    });
  }
}

/** A minimal but valid submission document — every required section present and non-empty. */
function demoDocument(): DesignDocument {
  const sections = new Map(
    REQUIRED_SECTION_KEYS.map((key) => [
      key,
      { key, heading: key, text: `Demo ${key} content for the seeded attempt.`, lineRange: { start: 1, end: 1 } },
    ]),
  );
  return new DesignDocument(sections, [], null);
}

/** Builds a plausible Completed Feedback for a demo attempt from a fixed per-dimension score map. */
function demoFeedback(rubric: Rubric, scores: Record<Dimension, AnchorScore>): Feedback {
  const criteria: CriterionFeedback[] = ALL_DIMENSIONS.map((criterion) => {
    const score = scores[criterion];
    const weak = score <= 1;
    return {
      criterion,
      score,
      evidence: [],
      strength: weak ? null : 'Handles this dimension reasonably well.',
      concern: weak ? 'Needs more depth here.' : null,
      whyItMatters: weak ? 'This dimension is central to a maintainable design.' : null,
      suggestion: weak ? 'Revisit this dimension with more detail and examples.' : null,
      confidence: 'medium',
    };
  });
  return Feedback.build('Seeded demo evaluation for prior-attempt history.', criteria, rubric);
}

interface DemoAttemptSeed {
  attemptId: string;
  evaluationId: string;
  problem: Problem;
  daysAgo: number;
  scores: Record<Dimension, AnchorScore>;
}

async function seedDemoLearner(db: Database.Database): Promise<void> {
  const learnerRepo = new SqliteLearnerRepository(db);
  const attemptRepo = new SqliteAttemptRepository(db);
  const evaluationRepo = new SqliteEvaluationRepository(db);

  let demo = await learnerRepo.findByHandle('demo');
  if (!demo) {
    demo = new Learner('demo-learner', 'demo', 'Demo Learner');
    await learnerRepo.save(demo);
  }

  const existingAttempts = await attemptRepo.findByLearner(demo.id);
  if (existingAttempts.length > 0) return; // already seeded on a prior run

  const parkingLot = SEED_PROBLEMS.find((p) => p.id === 'parking-lot')!;
  const vendingMachine = SEED_PROBLEMS.find((p) => p.id === 'vending-machine')!;

  // Two attempts on Parking Lot (showing improvement over time) plus one on Vending Machine,
  // so both delta-tracking and recurring-weakness detection (Task 20) have real data: both
  // early attempts are weak on abstractionPatterns, and the later parking-lot attempt improves.
  const seeds: DemoAttemptSeed[] = [
    {
      attemptId: 'demo-attempt-1',
      evaluationId: 'demo-eval-1',
      problem: parkingLot,
      daysAgo: 15,
      scores: {
        requirementUnderstanding: 3, classResponsibilities: 2, couplingCohesion: 2,
        encapsulationInterfaces: 2, abstractionPatterns: 1, extensibility: 1,
        edgeCasesTestability: 2, explanationQuality: 2,
      },
    },
    {
      attemptId: 'demo-attempt-2',
      evaluationId: 'demo-eval-2',
      problem: vendingMachine,
      daysAgo: 8,
      scores: {
        requirementUnderstanding: 3, classResponsibilities: 3, couplingCohesion: 2,
        encapsulationInterfaces: 2, abstractionPatterns: 1, extensibility: 2,
        edgeCasesTestability: 2, explanationQuality: 3,
      },
    },
    {
      attemptId: 'demo-attempt-3',
      evaluationId: 'demo-eval-3',
      problem: parkingLot,
      daysAgo: 2,
      scores: {
        requirementUnderstanding: 4, classResponsibilities: 3, couplingCohesion: 3,
        encapsulationInterfaces: 3, abstractionPatterns: 3, extensibility: 3,
        edgeCasesTestability: 3, explanationQuality: 3,
      },
    },
  ];

  for (const seed of seeds) {
    const createdAt = new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000);

    const attempt = new Attempt(seed.attemptId, demo.id, seed.problem.id, createdAt);
    attempt.submit(Submission.create(
      `# ${seed.problem.title} — demo submission\n\nSeeded prior attempt for demo history.`,
      'markdown',
      demoDocument(),
      createdAt,
    ));
    await attemptRepo.save(attempt);

    const rubric = new Rubric(RUBRIC_VERSION, GLOBAL_RUBRIC_DIMENSIONS, seed.problem.rubricWeights, seed.problem.scopeBoundary);
    const evaluation = new Evaluation(seed.evaluationId, seed.attemptId, 'fake', RUBRIC_VERSION, createdAt);
    evaluation.markRunning();
    evaluation.complete(demoFeedback(rubric, seed.scores));
    await evaluationRepo.save(evaluation);
  }
}

/** Idempotent: safe to call on every startup. Seeds the 5 problems and a demo learner with
 * prior attempts if (and only if) they aren't already present. */
export async function seedDb(db: Database.Database): Promise<void> {
  seedProblems(db);
  await seedDemoLearner(db);
}
