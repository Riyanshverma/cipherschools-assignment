import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/app.js';
import { openDb, runMigrations } from '../../src/adapters/persistence/sqlite/db.js';
import { SqliteLearnerRepository } from '../../src/adapters/persistence/sqlite/SqliteLearnerRepository.js';
import { SqliteProblemRepository } from '../../src/adapters/persistence/sqlite/SqliteProblemRepository.js';
import { SqliteAttemptRepository } from '../../src/adapters/persistence/sqlite/SqliteAttemptRepository.js';
import { SqliteEvaluationRepository } from '../../src/adapters/persistence/sqlite/SqliteEvaluationRepository.js';
import { EvaluationOrchestrator } from '../../src/application/EvaluationOrchestrator.js';
import { MarkdownFormatAdapter } from '../../src/adapters/format/MarkdownFormatAdapter.js';
import { FakeEvaluator } from '../../src/adapters/evaluators/FakeEvaluator.js';
import { seedDb } from '../../src/seed/seedDb.js';
import { globalRubric } from '../../src/seed/rubric.js';

const VALID_MARKDOWN = `
# Requirements & Assumptions
text
# Classes & Responsibilities
text
# Relationships & Interactions
text
# Key Behaviour & Rules
text
# Edge Cases & Testability
text
# Trade-offs & Extensibility
text
`;

describe('practice loop (fake evaluator)', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = openDb(':memory:');
    runMigrations(db);
    seedDb(db);
    const learners = new SqliteLearnerRepository(db);
    const problems = new SqliteProblemRepository(db);
    const attempts = new SqliteAttemptRepository(db);
    const evaluations = new SqliteEvaluationRepository(db);
    const fake = new FakeEvaluator({ kind: 'complete', outcome: { kind: 'completed', summary: 'looks fine', criteria: [] } });
    const orchestrator = new EvaluationOrchestrator(
      attempts, evaluations, problems, new Map([['markdown', new MarkdownFormatAdapter()]]),
      [fake], () => globalRubric, 60000,
    );
    app = createApp({ learners, problems, attempts, evaluations, orchestrator });
  });

  it('runs choose problem -> start -> submit -> poll -> feedback end to end', async () => {
    const learnerRes = await request(app).post('/learners').send({ handle: 'e2e-learner' });
    expect(learnerRes.status).toBe(201);

    const problemsRes = await request(app).get('/problems');
    expect(problemsRes.body.length).toBeGreaterThanOrEqual(3);
    const problemId = problemsRes.body[0].id;

    const attemptRes = await request(app).post('/attempts').send({ learnerId: learnerRes.body.id, problemId });
    expect(attemptRes.body.state).toBe('Draft');

    const submitRes = await request(app).post(`/attempts/${attemptRes.body.id}/submit`).send({ rawContent: VALID_MARKDOWN, format: 'markdown' });
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.kind).toBe('accepted');

    // poll until the fake evaluator's recorded outcome lands
    let statusRes;
    for (let i = 0; i < 10; i++) {
      statusRes = await request(app).get(`/attempts/${attemptRes.body.id}`);
      if (statusRes.body.evaluations[0].state === 'Completed') break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(statusRes!.body.evaluations[0].state).toBe('Completed');
    expect(statusRes!.body.evaluations[0].feedback.summary).toBe('looks fine');
  });

  it('submit returns immediately with evaluation Pending or Running, not Completed', async () => {
    // A real HTTP round-trip (even over loopback) crosses a macrotask boundary, and Node always
    // fully drains the microtask queue before the next macrotask — so a 'complete'-mode
    // FakeEvaluator (which resolves via queueMicrotask) would have *already* recorded its
    // outcome by the time a follow-up GET's response lands, deterministically defeating this
    // assertion regardless of route/orchestrator correctness. Use a 'timeout' mode evaluator
    // instead (as Task 10's own orchestrator unit test does for this exact property): it never
    // calls record(), so the evaluation deterministically stays Pending/Running to observe.
    const db = openDb(':memory:');
    runMigrations(db);
    seedDb(db);
    const learners = new SqliteLearnerRepository(db);
    const problems = new SqliteProblemRepository(db);
    const attempts = new SqliteAttemptRepository(db);
    const evaluations = new SqliteEvaluationRepository(db);
    const neverCompletes = new FakeEvaluator({ kind: 'timeout' });
    const orchestrator = new EvaluationOrchestrator(
      attempts, evaluations, problems, new Map([['markdown', new MarkdownFormatAdapter()]]),
      [neverCompletes], () => globalRubric, 60000,
    );
    const timingApp = createApp({ learners, problems, attempts, evaluations, orchestrator });

    const learnerRes = await request(timingApp).post('/learners').send({ handle: 'timing-learner' });
    const problemsRes = await request(timingApp).get('/problems');
    const attemptRes = await request(timingApp).post('/attempts').send({ learnerId: learnerRes.body.id, problemId: problemsRes.body[0].id });
    const submitRes = await request(timingApp).post(`/attempts/${attemptRes.body.id}/submit`).send({ rawContent: VALID_MARKDOWN, format: 'markdown' });
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.kind).toBe('accepted');
    const immediateStatus = await request(timingApp).get(`/attempts/${attemptRes.body.id}`);
    expect(['Pending', 'Running']).toContain(immediateStatus.body.evaluations[0].state);
  });
});
