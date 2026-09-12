# LLD Practice Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. TDD sub-skill (superpowers:test-driven-development)
> governs every task with a "Write failing test" step.

**Goal:** Build a working end-to-end LLD Practice Platform prototype (problem selection →
practice → submit → AI + rule-based feedback → history) demonstrating a real domain model
behind four ports, per DECISIONS.md's 15 locked decisions.

**Architecture:** Monolith, TypeScript end to end. Plain TS domain classes (Learner, Problem,
Attempt, Submission, Evaluation, Rubric, Feedback) behind four ports — `Evaluator`,
`FormatAdapter`, four `*Repository` interfaces, `LlmClient` — with adapters for Markdown
parsing, rule-based/AI/fake evaluation, SQLite persistence, and an OpenAI-compatible LLM call.
Express 5 HTTP API; React + Vite four-screen UI with zero business rules; in-process background
evaluation execution with polled status (no broker).

**Tech Stack:** TypeScript, Express 5, Zod, better-sqlite3 (no ORM), Vitest, React + Vite,
`openai` SDK.

**Spec:** `DECISIONS.md` (15 locked decisions — do not re-litigate), `cipherschool-assignment.md`
(source of truth for requirements), `chatGPT-understanding.md §1-14` (research context; §15-17
unverified, excluded).

## Global Constraints

- No ORM — hand-written mappers between domain objects and SQLite rows (decision 15.1).
- Domain reads like Java that compiles with `tsc`: real classes, private fields, explicit
  `interface` ports. No anemic objects, no bags of exported functions (decision 15).
- Four ports only: `Evaluator`, `FormatAdapter`, `Repository` (as 4 focused interfaces),
  `LlmClient`. No fifth port, no speculative abstraction beyond these.
- `Evaluator.start()` returns `void` / fires-and-forgets; results re-enter through
  `EvaluationRecorder.record(evaluationId, outcome)` — never a synchronous `evaluate()` call
  (decision 5).
- The evaluator reports outcomes; only the domain (`Evaluation` entity, driven by the
  orchestrator) moves state machines (decision 5.2).
- Rubric passed into `Evaluator.start()`, never baked into an evaluator (decision 5.3).
- No provider fallback chain — one configured `LlmClient` (OpenAI `gpt-5-nano`, per the
  completed provider probe in DECISIONS.md §15) (decision 15.4).
- AI request shape is fixed and non-negotiable: `max_completion_tokens` (not `max_tokens`),
  `reasoning_effort: "minimal"`, no `temperature` field, `response_format: { type:
  "json_schema", json_schema: { strict: true, ... } }` (decision 15, provider probe).
- No test ever calls the live LLM. The fake evaluator is a real third adapter, not scaffolding
  (decision 14).
- No authentication — identity is a declared handle (decision 12). Do not add sessions/passwords.
- Rule-based evaluator scores exactly 3 dimensions and abstains on 5 — abstention is a returned
  value, never a guess (decision 10).
- An evaluation where not all 8 dimensions were scored exposes **no aggregate score**
  (`Rubric.aggregate` returns `null`) (decision 14 sub-decision).
- UI is a thin client: zero business rules, zero validation logic beyond what Zod/HTML give for
  free. Every rule lives in the domain and is exercised through the API in tests (decision 13).
- `ui-ux-pro-max` skill is NOT invoked until Phase 6 (UI tasks) — the user enables it then.
- Reserve the last ~2 hours before the 10:35am deadline for write-ups (Phase 8). If time is
  short, cut Phase 6 polish or the rule-based evaluator (decision 10's stated most-cuttable
  item) — never the write-ups.
- From the moment Task 13 (fake-evaluator end-to-end loop) passes, the practice loop must keep
  running end to end after every subsequent task. If a task would break it, that task is not
  done until the loop is verified again.

---

## Phase 2 — Scaffold

### Task 1: Git init + monorepo scaffold

**Files:**
- Create: `package.json` (root, npm workspaces)
- Create: `.gitignore` (verify `.env`, `node_modules`, `data/*.db`, `dist` already covered)
- Create: `backend/package.json`
- Create: `frontend/` (placeholder, filled in Phase 6)
- Create: `README.md` (stub — filled in Phase 8)

**Interfaces:** none (pure scaffolding).

- [ ] **Step 1: Initialize git and root workspace**

```bash
cd /Users/riyanshverma/Desktop/my-projects/cipherschools-assignment
git init
```

Root `package.json`:

```json
{
  "name": "lld-practice-platform",
  "private": true,
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "test": "npm run test --workspace backend",
    "dev:backend": "npm run dev --workspace backend"
  }
}
```

- [ ] **Step 2: Verify `.gitignore` covers `.env`, `node_modules`, `backend/data/*.db`, `dist/`**

Read existing `.gitignore`, add any missing entries. Never commit `backend/.env`.

- [ ] **Step 3: Commit**

```bash
git add package.json .gitignore README.md
git commit -m "chore: init repo and workspace scaffold"
```

---

### Task 2: Backend TypeScript + Vitest + Express skeleton

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/src/api/app.ts`
- Create: `backend/src/server.ts`
- Test: `backend/tests/integration/health.test.ts`

**Interfaces:**
- Produces: `createApp(): express.Express` from `backend/src/api/app.ts` — every later route
  task imports and extends this factory function, never a standalone `express()` call.

- [ ] **Step 1: Install dependencies**

```bash
cd backend
npm init -y
npm pkg set type=module
npm install express zod better-sqlite3 openai
npm install -D typescript vitest @types/express @types/node @types/better-sqlite3 tsx supertest @types/supertest
```

- [ ] **Step 2: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "declaration": false
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', globals: false },
});
```

- [ ] **Step 4: Write failing test for app factory**

`backend/tests/integration/health.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/app.js';

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 5: Run test, verify it fails**

Run: `npm run test --workspace backend`
Expected: FAIL — `app.ts` does not exist.

- [ ] **Step 6: Implement `createApp`**

`backend/src/api/app.ts`:

```ts
import express from 'express';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  return app;
}
```

`backend/src/server.ts`:

```ts
import { createApp } from './api/app.js';

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => console.log(`listening on ${port}`));
```

Add to `backend/package.json` scripts: `"test": "vitest run"`, `"dev": "tsx watch src/server.ts"`.

- [ ] **Step 7: Run test, verify it passes**

Run: `npm run test --workspace backend`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/vitest.config.ts backend/src backend/tests
git commit -m "chore: backend TS + Express + Vitest skeleton"
```

---

## Phase 3 — Domain contracts, then parallel build

### Task 3: Shared domain types, ports, `DesignDocument`, `Rubric` (sequential — blocks Task 4-7)

This task defines every interface the parallel tracks (domain entities, Markdown adapter,
rule-based evaluator, fake evaluator) build against. It must land first and is small.

**Files:**
- Create: `backend/src/domain/types.ts`
- Create: `backend/src/domain/DesignDocument.ts`
- Create: `backend/src/domain/Rubric.ts`
- Create: `backend/src/domain/ports/FormatAdapter.ts`
- Create: `backend/src/domain/ports/Evaluator.ts`
- Create: `backend/src/domain/ports/Repository.ts`
- Create: `backend/src/domain/ports/LlmClient.ts`
- Test: `backend/tests/unit/domain/DesignDocument.test.ts`
- Test: `backend/tests/unit/domain/Rubric.test.ts`

**Interfaces:**
- Produces (consumed by every later task):

```ts
// backend/src/domain/types.ts
export type Dimension =
  | 'requirementUnderstanding' | 'classResponsibilities' | 'couplingCohesion'
  | 'encapsulationInterfaces' | 'abstractionPatterns' | 'extensibility'
  | 'edgeCasesTestability' | 'explanationQuality';

export const ALL_DIMENSIONS: Dimension[] = [
  'requirementUnderstanding', 'classResponsibilities', 'couplingCohesion',
  'encapsulationInterfaces', 'abstractionPatterns', 'extensibility',
  'edgeCasesTestability', 'explanationQuality',
];

export type SectionKey =
  | 'requirementsAssumptions' | 'classesResponsibilities' | 'relationshipsInteractions'
  | 'keyBehaviourRules' | 'edgeCasesTestability' | 'tradeoffsExtensibility';

export const REQUIRED_SECTION_KEYS: SectionKey[] = [
  'requirementsAssumptions', 'classesResponsibilities', 'relationshipsInteractions',
  'keyBehaviourRules', 'edgeCasesTestability', 'tradeoffsExtensibility',
];

export type AnchorScore = 0 | 1 | 2 | 3 | 4;
export type Confidence = 'none' | 'low' | 'medium' | 'high';
export interface LineRange { start: number; end: number }
```

```ts
// backend/src/domain/DesignDocument.ts
export interface Section { key: SectionKey; heading: string; text: string; lineRange: LineRange }
export interface CodeBlock { language: string | null; content: string; lineRange: LineRange }

export class DesignDocument {
  constructor(
    private readonly sections: Map<SectionKey, Section>,
    private readonly codeBlocks: CodeBlock[],
    private readonly diagramSource: string | null,
  ) {}
  getSection(key: SectionKey): Section | undefined
  missingRequiredSections(): SectionKey[]
  emptyRequiredSections(): SectionKey[]   // present but blank/whitespace-only text
  getCodeBlocks(): CodeBlock[]
  getDiagramSource(): string | null
  verifyQuote(sectionKey: SectionKey, quote: string): boolean  // quote is substring of section.text
}
```

```ts
// backend/src/domain/Rubric.ts
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
  getDimensions(): Dimension[]
  getWeight(dimension: Dimension): number
  getAnchor(dimension: Dimension, score: AnchorScore): Anchor
  // Guard: returns null unless every dimension in ALL_DIMENSIONS has a score in `scores`.
  aggregate(scores: Map<Dimension, AnchorScore>): AggregateScore | null
}
```

```ts
// backend/src/domain/ports/FormatAdapter.ts
export interface FormatAdapter {
  readonly format: string; // 'markdown'
  parse(rawContent: string): DesignDocument; // throws FormatParseError only if truly unparseable
}
export class FormatParseError extends Error {}
```

```ts
// backend/src/domain/ports/Evaluator.ts
export interface ProblemContext { problemId: string; requirements: string; scopeBoundary: string }
export interface Citation { sectionKey: SectionKey; quote: string; lineRange: LineRange }
export interface RawCriterionFeedback {
  criterion: Dimension; score: AnchorScore | null; // null = abstained
  evidence: Citation[]; strength: string | null;
  concern: string | null; whyItMatters: string | null; suggestion: string | null;
  confidence: Confidence;
}
export type EvaluationOutcome =
  | { kind: 'completed'; summary: string; criteria: RawCriterionFeedback[] }
  | { kind: 'failed'; reason: string };

export interface EvaluationRecorder {
  record(evaluationId: string, outcome: EvaluationOutcome): Promise<void>;
}
export interface Evaluator {
  readonly id: string; // 'ai' | 'rule-based' | 'fake'
  start(
    evaluationId: string, document: DesignDocument, rubric: Rubric,
    context: ProblemContext, recorder: EvaluationRecorder,
  ): void;
}
```

```ts
// backend/src/domain/ports/Repository.ts
export interface LearnerRepository {
  findByHandle(handle: string): Promise<Learner | null>;
  save(learner: Learner): Promise<void>;
}
export interface ProblemRepository {
  findAll(): Promise<Problem[]>;
  findById(id: string): Promise<Problem | null>;
}
export interface AttemptRepository {
  save(attempt: Attempt): Promise<void>;
  findById(id: string): Promise<Attempt | null>;
  findByLearnerAndProblem(learnerId: string, problemId: string): Promise<Attempt[]>;
  findByLearner(learnerId: string): Promise<Attempt[]>;
}
export interface EvaluationRepository {
  save(evaluation: Evaluation): Promise<void>;
  findById(id: string): Promise<Evaluation | null>;
  findByAttemptId(attemptId: string): Promise<Evaluation[]>;
  findAllRunning(): Promise<Evaluation[]>;
}
```

```ts
// backend/src/domain/ports/LlmClient.ts
export interface LlmClient {
  completeJson(params: {
    systemPrompt: string; userPrompt: string;
    jsonSchema: object; schemaName: string; maxCompletionTokens: number;
  }): Promise<unknown>; // raw parsed JSON; caller Zod-validates
}
```

- [ ] **Step 1: Write failing tests for `DesignDocument` and `Rubric`**

`backend/tests/unit/domain/DesignDocument.test.ts`:

```ts
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
```

`backend/tests/unit/domain/Rubric.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type Dimension, type AnchorScore } from '../../../src/domain/types.js';

function fullRubric() {
  const dimensions = ALL_DIMENSIONS.map((key) => ({
    key,
    anchors: [0, 1, 2, 3, 4].map((score) => ({ score: score as AnchorScore, label: `L${score}`, description: `D${score}` })),
  }));
  const weights = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, 1])) as Record<Dimension, number>;
  return new Rubric('v1', dimensions, weights, 'no event buses');
}

describe('Rubric', () => {
  it('aggregates a full set of 8 scores', () => {
    const scores = new Map<Dimension, AnchorScore>(ALL_DIMENSIONS.map((d) => [d, 2 as AnchorScore]));
    expect(fullRubric().aggregate(scores)).toEqual({ total: 16, maxPossible: 32 });
  });

  it('returns null when not all 8 dimensions are scored (partial/abstained evaluation)', () => {
    const scores = new Map<Dimension, AnchorScore>([
      ['requirementUnderstanding', 3], ['edgeCasesTestability', 2], ['explanationQuality', 4],
    ]);
    expect(fullRubric().aggregate(scores)).toBeNull();
  });

  it('looks up the anchor description for a dimension and score', () => {
    const anchor = fullRubric().getAnchor('extensibility', 3);
    expect(anchor.score).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test --workspace backend -- DesignDocument Rubric`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement `types.ts`, `DesignDocument.ts`, `Rubric.ts`, and the four port files**
      exactly as specified in the Interfaces block above. `aggregate()` guard: `if
      (ALL_DIMENSIONS.some(d => !scores.has(d))) return null;` then weighted sum with
      `maxPossible = 4 * sum(weights)`.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test --workspace backend -- DesignDocument Rubric`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/types.ts backend/src/domain/DesignDocument.ts backend/src/domain/Rubric.ts backend/src/domain/ports backend/tests/unit/domain
git commit -m "feat(domain): shared types, ports, DesignDocument, Rubric"
```

---

### Task 4 (parallel-A): `Learner`, `Problem`, `Submission`, `Attempt`, `Evaluation`, `Feedback`, `CitationVerifier`

Dispatch as an independent subagent once Task 3 is committed. No dependency on Task 5 or 6.

**Files:**
- Create: `backend/src/domain/Learner.ts`
- Create: `backend/src/domain/Problem.ts`
- Create: `backend/src/domain/Submission.ts`
- Create: `backend/src/domain/Attempt.ts`
- Create: `backend/src/domain/Evaluation.ts`
- Create: `backend/src/domain/Feedback.ts`
- Create: `backend/src/domain/CitationVerifier.ts`
- Test: `backend/tests/unit/domain/Attempt.test.ts`
- Test: `backend/tests/unit/domain/Evaluation.test.ts`
- Test: `backend/tests/unit/domain/CitationVerifier.test.ts`
- Test: `backend/tests/unit/domain/Feedback.test.ts`

**Interfaces:**
- Consumes: `DesignDocument`, `Rubric`, `AggregateScore`, `Dimension`, `AnchorScore`,
  `Confidence`, `Citation`, `RawCriterionFeedback` from Task 3.
- Produces (consumed by Task 8 orchestrator and Task 9 repositories):

```ts
// Submission.ts
export class Submission {
  private constructor(
    readonly rawContent: string, readonly format: string,
    readonly document: DesignDocument, readonly contentHash: string, readonly submittedAt: Date,
  ) {}
  static create(rawContent: string, format: string, document: DesignDocument, now: Date): Submission;
  // contentHash = sha256 hex of rawContent, via node:crypto
}

// Attempt.ts
export type AttemptState = 'Draft' | 'Submitted';
export type SubmitResult =
  | { kind: 'accepted' } | { kind: 'idempotentReplay' } | { kind: 'conflict'; message: string };

export class Attempt {
  private state: AttemptState = 'Draft';
  private submission: Submission | null = null;
  constructor(readonly id: string, readonly learnerId: string, readonly problemId: string, readonly createdAt: Date) {}
  getState(): AttemptState;
  getSubmission(): Submission | null;
  submit(submission: Submission): SubmitResult;
  // Draft -> set submission, state=Submitted, return {kind:'accepted'}
  // Submitted, same contentHash -> {kind:'idempotentReplay'}, no mutation
  // Submitted, different contentHash -> {kind:'conflict', message:'this attempt is already submitted — start a new attempt.'}
}

// Evaluation.ts
export type EvaluationState = 'Pending' | 'Running' | 'Completed' | 'Failed';
export class Evaluation {
  private state: EvaluationState = 'Pending';
  private feedback: Feedback | null = null;
  private failureReason: string | null = null;
  constructor(
    readonly id: string, readonly attemptId: string, readonly evaluatorId: string,
    readonly rubricVersion: string, readonly createdAt: Date,
  ) {}
  getState(): EvaluationState;
  markRunning(): void;        // Pending -> Running; throws if not Pending
  complete(feedback: Feedback): void; // Running -> Completed; throws if not Running
  fail(reason: string): void;         // Pending|Running -> Failed
  markInterrupted(): void;            // Running -> Failed('interrupted'); no-op if not Running
  getFeedback(): Feedback | null;
  getFailureReason(): string | null;
}

// Feedback.ts
export interface CriterionFeedback {
  criterion: Dimension; score: AnchorScore | null; evidence: Citation[];
  strength: string | null; concern: string | null; whyItMatters: string | null;
  suggestion: string | null; confidence: Confidence;
}
export class Feedback {
  private constructor(
    readonly summary: string, readonly criteria: CriterionFeedback[],
    readonly topPriorities: Dimension[], readonly aggregateScore: AggregateScore | null,
  ) {}
  static build(summary: string, criteria: CriterionFeedback[], rubric: Rubric): Feedback;
  // 1. Enforce nullable-as-a-group: concern present => whyItMatters & suggestion present (throw on violation)
  // 2. aggregateScore = rubric.aggregate(map of criterion->score, skipping nulls)
  // 3. topPriorities = up to 3 dimensions with a non-null concern, sorted ascending by (score * rubric.getWeight(dim))
}

// CitationVerifier.ts
export class CitationVerifier {
  static verify(criteria: RawCriterionFeedback[], document: DesignDocument): CriterionFeedback[];
  // per criterion: keep only citations where document.verifyQuote(c.sectionKey, c.quote) is true;
  // if any citation was dropped, downgrade confidence one step: high->medium->medium->low->low->none->none
}
```

- [ ] **Step 1: Write failing tests for `Attempt` (state machine + idempotency three-case rule)**

`backend/tests/unit/domain/Attempt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Attempt } from '../../../src/domain/Attempt.js';
import { Submission } from '../../../src/domain/Submission.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';

function submission(content = 'design doc content') {
  return Submission.create(content, 'markdown', new DesignDocument(new Map(), [], null), new Date());
}

describe('Attempt', () => {
  it('starts in Draft', () => {
    const a = new Attempt('a1', 'learner1', 'problem1', new Date());
    expect(a.getState()).toBe('Draft');
  });

  it('accepts submission from Draft', () => {
    const a = new Attempt('a1', 'learner1', 'problem1', new Date());
    const result = a.submit(submission());
    expect(result).toEqual({ kind: 'accepted' });
    expect(a.getState()).toBe('Submitted');
  });

  it('treats identical resubmit as idempotent replay, not a second acceptance', () => {
    const a = new Attempt('a1', 'learner1', 'problem1', new Date());
    const s = submission('same content');
    a.submit(s);
    const result = a.submit(Submission.create('same content', 'markdown', new DesignDocument(new Map(), [], null), new Date()));
    expect(result).toEqual({ kind: 'idempotentReplay' });
  });

  it('rejects a different submission on an already-submitted attempt', () => {
    const a = new Attempt('a1', 'learner1', 'problem1', new Date());
    a.submit(submission('content A'));
    const result = a.submit(submission('content B'));
    expect(result.kind).toBe('conflict');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test --workspace backend -- Attempt.test`
Expected: FAIL — `Attempt.ts` does not exist.

- [ ] **Step 3: Implement `Submission.ts` and `Attempt.ts`** per the Interfaces block (use
      `node:crypto` `createHash('sha256')` for `contentHash`).

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test --workspace backend -- Attempt.test`
Expected: PASS

- [ ] **Step 5: Write failing tests for `Evaluation` state machine**

`backend/tests/unit/domain/Evaluation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Evaluation } from '../../../src/domain/Evaluation.js';
import { Feedback } from '../../../src/domain/Feedback.js';

function fakeFeedback(): Feedback {
  // built via Feedback.build with an empty rubric-agnostic minimal case in Task 4's Feedback test;
  // reuse the same helper here once Feedback.build exists.
  return Feedback.build('summary', [], { aggregate: () => null } as any);
}

describe('Evaluation', () => {
  it('starts Pending', () => {
    const e = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    expect(e.getState()).toBe('Pending');
  });

  it('moves Pending -> Running -> Completed', () => {
    const e = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    e.markRunning();
    expect(e.getState()).toBe('Running');
    e.complete(fakeFeedback());
    expect(e.getState()).toBe('Completed');
  });

  it('rejects complete() from Pending (must go through Running)', () => {
    const e = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    expect(() => e.complete(fakeFeedback())).toThrow();
  });

  it('stores failure reason and moves to Failed', () => {
    const e = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    e.markRunning();
    e.fail('timeout');
    expect(e.getState()).toBe('Failed');
    expect(e.getFailureReason()).toBe('timeout');
  });

  it('markInterrupted sweeps a stranded Running evaluation to Failed', () => {
    const e = new Evaluation('e1', 'a1', 'ai', 'v1', new Date());
    e.markRunning();
    e.markInterrupted();
    expect(e.getState()).toBe('Failed');
    expect(e.getFailureReason()).toBe('interrupted');
  });
});
```

- [ ] **Step 6: Run test, verify it fails; implement `Feedback.ts` (minimal `build` first, see
      Step 9) and `Evaluation.ts`; run again to verify pass.**

- [ ] **Step 7: Write failing tests for `Feedback.build` (nullable-group invariant + topPriorities)**

`backend/tests/unit/domain/Feedback.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Feedback } from '../../../src/domain/Feedback.js';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type Dimension, type AnchorScore } from '../../../src/domain/types.js';
import type { CriterionFeedback } from '../../../src/domain/Feedback.js';

function rubric() {
  const dimensions = ALL_DIMENSIONS.map((key) => ({ key, anchors: [0,1,2,3,4].map((score) => ({ score: score as AnchorScore, label: `L${score}`, description: `D${score}` })) }));
  const weights = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, 1])) as Record<Dimension, number>;
  return new Rubric('v1', dimensions, weights, 'scope');
}

function criterion(overrides: Partial<CriterionFeedback>): CriterionFeedback {
  return {
    criterion: 'requirementUnderstanding', score: 3, evidence: [], strength: 'ok',
    concern: null, whyItMatters: null, suggestion: null, confidence: 'high', ...overrides,
  };
}

describe('Feedback.build', () => {
  it('throws if concern is present without whyItMatters and suggestion', () => {
    const bad = criterion({ concern: 'coupling issue', whyItMatters: null, suggestion: null });
    expect(() => Feedback.build('s', [bad], rubric())).toThrow();
  });

  it('accepts concern with both whyItMatters and suggestion present', () => {
    const ok = criterion({ concern: 'coupling issue', whyItMatters: 'breaks on change', suggestion: 'extract interface' });
    expect(() => Feedback.build('s', [ok], rubric())).not.toThrow();
  });

  it('selects up to 3 topPriorities by lowest weighted contribution among concerned criteria', () => {
    const criteria = ALL_DIMENSIONS.map((d, i) =>
      criterion({ criterion: d, score: (i % 5) as AnchorScore, concern: 'x', whyItMatters: 'y', suggestion: 'z' }));
    const fb = Feedback.build('s', criteria, rubric());
    expect(fb.topPriorities.length).toBeLessThanOrEqual(3);
  });

  it('exposes no aggregate score when fewer than 8 dimensions were scored', () => {
    const fb = Feedback.build('s', [criterion({ criterion: 'requirementUnderstanding' })], rubric());
    expect(fb.aggregateScore).toBeNull();
  });
});
```

- [ ] **Step 8: Run tests, verify they fail**

Run: `npm run test --workspace backend -- Feedback.test`
Expected: FAIL

- [ ] **Step 9: Implement `Feedback.ts`** per the Interfaces block.

- [ ] **Step 10: Run tests, verify they pass**

Run: `npm run test --workspace backend -- Feedback.test Evaluation.test`
Expected: PASS

- [ ] **Step 11: Write failing tests for `CitationVerifier`**

`backend/tests/unit/domain/CitationVerifier.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CitationVerifier } from '../../../src/domain/CitationVerifier.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';
import type { RawCriterionFeedback } from '../../../src/domain/ports/Evaluator.js';

function docWithSection(text: string) {
  const sections = new Map();
  sections.set('classesResponsibilities', { key: 'classesResponsibilities', heading: 'h', text, lineRange: { start: 1, end: 1 } });
  return new DesignDocument(sections, [], null);
}

describe('CitationVerifier', () => {
  it('keeps a citation whose quote is present in the document', () => {
    const raw: RawCriterionFeedback[] = [{
      criterion: 'classResponsibilities', score: 3,
      evidence: [{ sectionKey: 'classesResponsibilities', quote: 'ParkingLot owns spots', lineRange: { start: 1, end: 1 } }],
      strength: 'ok', concern: null, whyItMatters: null, suggestion: null, confidence: 'high',
    }];
    const result = CitationVerifier.verify(raw, docWithSection('ParkingLot owns spots and tickets.'));
    expect(result[0].evidence).toHaveLength(1);
    expect(result[0].confidence).toBe('high');
  });

  it('drops a fabricated quote and downgrades confidence', () => {
    const raw: RawCriterionFeedback[] = [{
      criterion: 'classResponsibilities', score: 3,
      evidence: [{ sectionKey: 'classesResponsibilities', quote: 'this text does not exist', lineRange: { start: 1, end: 1 } }],
      strength: 'ok', concern: null, whyItMatters: null, suggestion: null, confidence: 'high',
    }];
    const result = CitationVerifier.verify(raw, docWithSection('ParkingLot owns spots.'));
    expect(result[0].evidence).toHaveLength(0);
    expect(result[0].confidence).toBe('medium');
  });
});
```

- [ ] **Step 12: Run test, verify it fails; implement `CitationVerifier.ts`; run again to verify
      pass.**

- [ ] **Step 13: Implement `Learner.ts` and `Problem.ts`** (plain data-holding entities — no
      state machine):

```ts
// Learner.ts
export class Learner {
  constructor(readonly id: string, readonly handle: string, readonly displayName: string) {}
}

// Problem.ts
import type { Dimension } from './types.js';
export class Problem {
  constructor(
    readonly id: string, readonly title: string, readonly requirements: string,
    readonly scopeBoundary: string, readonly rubricWeights: Partial<Record<Dimension, number>>,
  ) {}
}
```

No dedicated test file required — covered indirectly once seeded and used through the API in
Task 12's integration test (trivial value holders; YAGNI on unit tests for pure constructors).

- [ ] **Step 14: Commit**

```bash
git add backend/src/domain/Learner.ts backend/src/domain/Problem.ts backend/src/domain/Submission.ts backend/src/domain/Attempt.ts backend/src/domain/Evaluation.ts backend/src/domain/Feedback.ts backend/src/domain/CitationVerifier.ts backend/tests/unit/domain
git commit -m "feat(domain): Attempt/Evaluation lifecycle, Feedback, CitationVerifier, Learner, Problem"
```

---

### Task 5 (parallel-B): Markdown `FormatAdapter`

Dispatch as an independent subagent alongside Task 4 and Task 6. Depends only on Task 3.

**Files:**
- Create: `backend/src/adapters/format/MarkdownFormatAdapter.ts`
- Test: `backend/tests/unit/adapters/MarkdownFormatAdapter.test.ts`

**Interfaces:**
- Consumes: `FormatAdapter`, `DesignDocument`, `Section`, `CodeBlock`, `SectionKey`,
  `REQUIRED_SECTION_KEYS` from Task 3.
- Produces: `MarkdownFormatAdapter implements FormatAdapter`, `format = 'markdown'`, registered
  later in Task 8's adapter registry by import.

Heading-to-key tolerant matching table (case-insensitive, punctuation-insensitive, common
aliases):

| Canonical key | Matches headings like |
|---|---|
| `requirementsAssumptions` | "Requirements & Assumptions", "Requirements / Assumptions", "Requirements" |
| `classesResponsibilities` | "Classes & Responsibilities", "Classes and Responsibilities" |
| `relationshipsInteractions` | "Relationships & Interactions", "Relationships" |
| `keyBehaviourRules` | "Key Behaviour & Rules", "Key Behavior and Rules", "Behaviour & Rules" |
| `edgeCasesTestability` | "Edge Cases & Testability", "Edge Cases and Testability" |
| `tradeoffsExtensibility` | "Trade-offs & Extensibility", "Tradeoffs & Extensibility" |
| `diagram` (optional) | "Diagram" |

- [ ] **Step 1: Write failing tests covering tolerant headings, missing/empty/renamed sections,
      code block extraction, and unparseable mermaid (accepted with empty diagram slot)**

`backend/tests/unit/adapters/MarkdownFormatAdapter.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test --workspace backend -- MarkdownFormatAdapter`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `MarkdownFormatAdapter.ts`**

Algorithm: split on lines starting with `#`/`##` heading markers, normalize each heading
(lowercase, strip punctuation, collapse whitespace), match against an alias table (see table
above) to a canonical `SectionKey`; unmatched headings are ignored (not required, not
collected — future sections a learner adds are simply not addressed). Within the diagram
section, extract the first fenced code block's content verbatim as `diagramSource` (no mermaid
syntax validation — decision 4 explicitly makes this the domain's non-job). Elsewhere, extract
all fenced code blocks (` ```lang ... ``` `) into `codeBlocks` with line ranges.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test --workspace backend -- MarkdownFormatAdapter`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/adapters/format backend/tests/unit/adapters/MarkdownFormatAdapter.test.ts
git commit -m "feat(adapters): Markdown format adapter with tolerant heading matching"
```

---

### Task 6 (parallel-C): Rule-based `Evaluator`

Dispatch as an independent subagent alongside Task 4 and Task 5. Depends only on Task 3.

**Files:**
- Create: `backend/src/adapters/evaluators/RuleBasedEvaluator.ts`
- Test: `backend/tests/unit/adapters/RuleBasedEvaluator.test.ts`

**Interfaces:**
- Consumes: `Evaluator`, `EvaluationRecorder`, `RawCriterionFeedback`, `DesignDocument`,
  `Rubric`, `ProblemContext` from Task 3.
- Produces: `RuleBasedEvaluator implements Evaluator`, `id = 'rule-based'`.

Scoring rules (decision 10 — scores 3, abstains on 5):

| Dimension | Rule |
|---|---|
| `requirementUnderstanding` | Score by length/coverage heuristic on §1 text: <50 chars → 0, <150 → 1, <300 → 2, <600 → 3, else 4 |
| `edgeCasesTestability` | Score by counting distinct edge-case markers (lines starting with `-`/`*`, or sentences) in §5: 0 markers → 0, 1 → 1, 2 → 2, 3-4 → 3, 5+ → 4 |
| `explanationQuality` | Score by presence of reasoning markers ("because", "so that", "trade-off", "however", "in order to") across the whole document: 0 markers → 0, 1 → 2, 2+ → 4 (skip 1 and 3 — coarse, deliberately simple) |
| all other 5 dimensions | `score: null`, `confidence: 'none'`, `strength: null`, evidence `[]` — abstain |

- [ ] **Step 1: Write failing tests for the scoring heuristics and the abstention contract**

`backend/tests/unit/adapters/RuleBasedEvaluator.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { RuleBasedEvaluator } from '../../../src/adapters/evaluators/RuleBasedEvaluator.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type AnchorScore, type Dimension } from '../../../src/domain/types.js';
import type { EvaluationOutcome } from '../../../src/domain/ports/Evaluator.js';

function rubric() {
  const dimensions = ALL_DIMENSIONS.map((key) => ({ key, anchors: [0,1,2,3,4].map((score) => ({ score: score as AnchorScore, label: `L`, description: `D` })) }));
  const weights = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, 1])) as Record<Dimension, number>;
  return new Rubric('v1', dimensions, weights, 'scope');
}

function docWith(sections: Record<string, string>) {
  const map = new Map();
  for (const [key, text] of Object.entries(sections)) {
    map.set(key, { key, heading: key, text, lineRange: { start: 1, end: 1 } });
  }
  return new DesignDocument(map, [], null);
}

describe('RuleBasedEvaluator', () => {
  it('scores exactly 3 dimensions and abstains on the other 5', async () => {
    const evaluator = new RuleBasedEvaluator();
    const doc = docWith({
      requirementsAssumptions: 'x'.repeat(700),
      edgeCasesTestability: '- case one\n- case two\n- case three\n- case four\n- case five',
      keyBehaviourRules: 'because this matters, so that it holds, however edge cases exist',
    });
    let outcome: EvaluationOutcome | undefined;
    const recorder = { record: vi.fn(async (_id: string, o: EvaluationOutcome) => { outcome = o; }) };
    evaluator.start('eval1', doc, rubric(), { problemId: 'p1', requirements: 'r', scopeBoundary: 's' }, recorder);
    await vi.waitFor(() => expect(outcome).toBeDefined());
    expect(outcome!.kind).toBe('completed');
    const completed = outcome as Extract<EvaluationOutcome, { kind: 'completed' }>;
    const scored = completed.criteria.filter((c) => c.score !== null);
    const abstained = completed.criteria.filter((c) => c.score === null);
    expect(scored.map((c) => c.criterion).sort()).toEqual(
      ['edgeCasesTestability', 'explanationQuality', 'requirementUnderstanding'].sort(),
    );
    expect(abstained).toHaveLength(5);
    for (const a of abstained) expect(a.confidence).toBe('none');
  });

  it('scores requirementUnderstanding 0 on a near-empty section', async () => {
    const evaluator = new RuleBasedEvaluator();
    const doc = docWith({ requirementsAssumptions: 'short' });
    let outcome: EvaluationOutcome | undefined;
    const recorder = { record: vi.fn(async (_id: string, o: EvaluationOutcome) => { outcome = o; }) };
    evaluator.start('eval1', doc, rubric(), { problemId: 'p1', requirements: 'r', scopeBoundary: 's' }, recorder);
    await vi.waitFor(() => expect(outcome).toBeDefined());
    const completed = outcome as Extract<EvaluationOutcome, { kind: 'completed' }>;
    const req = completed.criteria.find((c) => c.criterion === 'requirementUnderstanding')!;
    expect(req.score).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test --workspace backend -- RuleBasedEvaluator`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `RuleBasedEvaluator.ts`** per the scoring table above. `start()` runs
      the heuristics synchronously, then calls `recorder.record(evaluationId, outcome)` — wrap
      in `queueMicrotask` or resolve via an immediately-resolved promise so the call is async
      from the caller's perspective (matches the port's fire-and-forget contract) but still
      "microseconds later" per decision 5's table.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test --workspace backend -- RuleBasedEvaluator`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/adapters/evaluators/RuleBasedEvaluator.ts backend/tests/unit/adapters/RuleBasedEvaluator.test.ts
git commit -m "feat(adapters): rule-based evaluator scoring 3 dimensions, abstaining on 5"
```

---

### Task 7 (parallel-D): Fake `Evaluator`

Dispatch alongside Tasks 4-6. Depends only on Task 3. Small — the test adapter decision 14
requires as a real third registered evaluator, not scaffolding.

**Files:**
- Create: `backend/src/adapters/evaluators/FakeEvaluator.ts`
- Test: `backend/tests/unit/adapters/FakeEvaluator.test.ts`

**Interfaces:**
- Produces:

```ts
export type FakeMode = { kind: 'complete'; outcome: EvaluationOutcome } | { kind: 'timeout' };

export class FakeEvaluator implements Evaluator {
  readonly id = 'fake';
  constructor(private mode: FakeMode = { kind: 'complete', outcome: /* trivial passing outcome */ }) {}
  setMode(mode: FakeMode): void; // lets a test reprogram behaviour per-call
  start(evaluationId: string, document: DesignDocument, rubric: Rubric, context: ProblemContext, recorder: EvaluationRecorder): void;
  // 'complete' -> recorder.record(evaluationId, this.mode.outcome) immediately (async microtask)
  // 'timeout'  -> never calls recorder.record; lets the orchestrator's timeout fire
}
```

- [ ] **Step 1: Write failing test**

`backend/tests/unit/adapters/FakeEvaluator.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { FakeEvaluator } from '../../../src/adapters/evaluators/FakeEvaluator.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';
import { Rubric } from '../../../src/domain/Rubric.js';

const doc = new DesignDocument(new Map(), [], null);
const rubric = new Rubric('v1', [], {}, 'scope');
const context = { problemId: 'p1', requirements: 'r', scopeBoundary: 's' };

describe('FakeEvaluator', () => {
  it('reports the programmed completed outcome', async () => {
    const evaluator = new FakeEvaluator({ kind: 'complete', outcome: { kind: 'completed', summary: 'ok', criteria: [] } });
    let recorded: unknown;
    const recorder = { record: vi.fn(async (_id: string, o: unknown) => { recorded = o; }) };
    evaluator.start('e1', doc, rubric, context, recorder);
    await vi.waitFor(() => expect(recorded).toBeDefined());
    expect(recorded).toEqual({ kind: 'completed', summary: 'ok', criteria: [] });
  });

  it('never calls record() in timeout mode, so an orchestrator timeout is exercised', async () => {
    const evaluator = new FakeEvaluator({ kind: 'timeout' });
    const recorder = { record: vi.fn() };
    evaluator.start('e1', doc, rubric, context, recorder);
    await new Promise((r) => setTimeout(r, 20));
    expect(recorder.record).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, verify it fails; implement `FakeEvaluator.ts`; run again to verify pass.**

- [ ] **Step 3: Commit**

```bash
git add backend/src/adapters/evaluators/FakeEvaluator.ts backend/tests/unit/adapters/FakeEvaluator.test.ts
git commit -m "feat(adapters): fake evaluator — third registered adapter for deterministic tests"
```

---

## Phase 4 — Wire the loop (fake evaluator, end to end)

### Task 8: SQLite schema + Repository implementations

**Files:**
- Create: `backend/src/adapters/persistence/sqlite/db.ts`
- Create: `backend/src/adapters/persistence/sqlite/schema.sql`
- Create: `backend/src/adapters/persistence/sqlite/SqliteLearnerRepository.ts`
- Create: `backend/src/adapters/persistence/sqlite/SqliteProblemRepository.ts`
- Create: `backend/src/adapters/persistence/sqlite/SqliteAttemptRepository.ts`
- Create: `backend/src/adapters/persistence/sqlite/SqliteEvaluationRepository.ts`
- Test: `backend/tests/integration/persistence/SqliteAttemptRepository.test.ts`
- Test: `backend/tests/integration/persistence/SqliteEvaluationRepository.test.ts`

**Interfaces:**
- Consumes: all four `*Repository` interfaces (Task 3), `Learner`, `Problem`, `Attempt`,
  `Submission`, `Evaluation`, `Feedback` (Task 4).
- Produces: four `Sqlite*Repository` classes, each `implements` its port interface, each
  constructed with a `better-sqlite3` `Database` instance from `db.ts`'s `openDb(path: string):
  Database`.

`schema.sql` tables: `learners(id, handle, display_name)`, `problems(id, title, requirements,
scope_boundary, rubric_weights_json)`, `attempts(id, learner_id, problem_id, state, created_at,
submission_raw_content, submission_format, submission_document_json, submission_content_hash,
submission_submitted_at)`, `evaluations(id, attempt_id, evaluator_id, rubric_version, state,
created_at, failure_reason, feedback_json)`. Mapping `DesignDocument`/`Feedback` to/from JSON
columns is the hand-written mapper — no ORM (decision 15.1). Store `DesignDocument` as JSON
(`{ sections: [...], codeBlocks: [...], diagramSource }`) and reconstruct via `new
DesignDocument(new Map(sections.map(s => [s.key, s])), codeBlocks, diagramSource)` on read
(exposing a small `static fromJSON`/`toJSON` pair on `DesignDocument` if that keeps the mapper
file thin — otherwise map inline in the repository).

- [ ] **Step 1: Write failing integration test for `SqliteAttemptRepository` round-trip
      (including submitted state with a `Submission`) and the "at most one submission" invariant
      surviving persistence**

`backend/tests/integration/persistence/SqliteAttemptRepository.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb, runMigrations } from '../../../src/adapters/persistence/sqlite/db.js';
import { SqliteAttemptRepository } from '../../../src/adapters/persistence/sqlite/SqliteAttemptRepository.js';
import { Attempt } from '../../../src/domain/Attempt.js';
import { Submission } from '../../../src/domain/Submission.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';

describe('SqliteAttemptRepository', () => {
  let db: Database.Database;
  let repo: SqliteAttemptRepository;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    repo = new SqliteAttemptRepository(db);
  });

  it('round-trips a Draft attempt', async () => {
    const attempt = new Attempt('a1', 'learner1', 'problem1', new Date('2026-09-11T00:00:00Z'));
    await repo.save(attempt);
    const loaded = await repo.findById('a1');
    expect(loaded?.getState()).toBe('Draft');
  });

  it('round-trips a Submitted attempt with its submission content and document', async () => {
    const attempt = new Attempt('a1', 'learner1', 'problem1', new Date());
    const sections = new Map();
    sections.set('requirementsAssumptions', { key: 'requirementsAssumptions', heading: 'h', text: 'text', lineRange: { start: 1, end: 1 } });
    const doc = new DesignDocument(sections, [], null);
    attempt.submit(Submission.create('raw markdown', 'markdown', doc, new Date()));
    await repo.save(attempt);
    const loaded = await repo.findById('a1');
    expect(loaded?.getState()).toBe('Submitted');
    expect(loaded?.getSubmission()?.rawContent).toBe('raw markdown');
    expect(loaded?.getSubmission()?.document.getSection('requirementsAssumptions')?.text).toBe('text');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test --workspace backend -- SqliteAttemptRepository`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement `db.ts`, `schema.sql`, `SqliteAttemptRepository.ts`**. `db.ts`:

```ts
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

export function openDb(path: string): Database.Database {
  return new Database(path);
}
export function runMigrations(db: Database.Database): void {
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf-8'));
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test --workspace backend -- SqliteAttemptRepository`
Expected: PASS

- [ ] **Step 5: Write failing test for `SqliteEvaluationRepository`, including
      `findAllRunning()` for the crash-recovery sweep**

`backend/tests/integration/persistence/SqliteEvaluationRepository.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb, runMigrations } from '../../../src/adapters/persistence/sqlite/db.js';
import { SqliteEvaluationRepository } from '../../../src/adapters/persistence/sqlite/SqliteEvaluationRepository.js';
import { Evaluation } from '../../../src/domain/Evaluation.js';

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
    // build via same pattern as Feedback.test.ts's minimal criterion, then evaluation.complete(feedback), save, reload, assert state + feedback.summary
  });
});
```

- [ ] **Step 6: Run test, verify it fails; implement `SqliteEvaluationRepository.ts`,
      `SqliteLearnerRepository.ts`, `SqliteProblemRepository.ts`; run again to verify pass.**

- [ ] **Step 7: Commit**

```bash
git add backend/src/adapters/persistence backend/tests/integration/persistence
git commit -m "feat(persistence): SQLite repositories behind the Repository port, no ORM"
```

---

### Task 9: Seed data — 3-5 problems

**Files:**
- Create: `backend/src/seed/problems.ts`
- Create: `backend/src/seed/rubric.ts`
- Create: `backend/src/seed/seedDb.ts`

**Interfaces:**
- Consumes: `Problem`, `Rubric`, `DimensionDef` (Task 3, Task 4).
- Produces: `SEED_PROBLEMS: Problem[]` (5 problems: Parking Lot, Elevator System, Vending
  Machine, Movie Ticket Booking, Rate Limiter), `GLOBAL_RUBRIC_DIMENSIONS: DimensionDef[]` (the
  8 dimensions with 0-4 named anchors, per decision 8.1 — `0 Missing, 1 Weak, 2 Adequate, 3
  Strong, 4 Exemplary`, each with a one-line description), `seedDb(db): void` (idempotent
  insert-if-absent for problems and a demo learner with 2-3 prior attempts, per decision 13).

This is data authoring, not TDD'd logic (ponytail: no test needed for a static data table —
its correctness is exercised through the integration test in Task 12). Per-problem
`rubricWeights` differ per decision 8 (e.g. Vending Machine weights `classResponsibilities` and
`abstractionPatterns` higher for state handling; Parking Lot weights `extensibility` and
`abstractionPatterns` higher for allocation policy; Elevator weights `edgeCasesTestability` and
`extensibility` higher for scheduling).

- [ ] **Step 1: Write `problems.ts`, `rubric.ts` with concrete content for all 5 problems and 8
      dimension anchor descriptions** (author real requirements text — 2-4 sentences per
      problem — and a scope boundary sentence per problem, e.g. Parking Lot: *"Single facility,
      no multi-level pricing federation, no external payment gateway integration required."*).

- [ ] **Step 2: Write `seedDb.ts`** — inserts the 5 problems if the `problems` table is empty;
      inserts a demo learner (`handle: 'demo'`) with 2-3 prior `Attempt`s + `Evaluation`s across
      2 problems if the `learners` table has no `demo` row, so History (Task 20) has content in
      the first thirty seconds per decision 13.

- [ ] **Step 3: Commit**

```bash
git add backend/src/seed
git commit -m "feat(seed): 5 LLD problems, 8-dimension rubric, demo learner with prior attempts"
```

---

### Task 10: `EvaluationOrchestrator` (application service)

**Files:**
- Create: `backend/src/application/EvaluationOrchestrator.ts`
- Test: `backend/tests/unit/application/EvaluationOrchestrator.test.ts`

**Interfaces:**
- Consumes: all four repositories, `FormatAdapter`, `Evaluator[]`, `CitationVerifier`,
  `Feedback`, `Attempt`, `Evaluation`, `Rubric` (Tasks 3, 4, 8).
- Produces (consumed by Task 12's API routes):

```ts
export type SubmitOutcome =
  | { kind: 'accepted'; attemptId: string; evaluationIds: string[] }
  | { kind: 'idempotentReplay'; attemptId: string; evaluationIds: string[] }
  | { kind: 'conflict'; message: string }
  | { kind: 'rejected'; missingSections: string[]; emptySections: string[] };

export class EvaluationOrchestrator implements EvaluationRecorder {
  constructor(
    private readonly attempts: AttemptRepository, private readonly evaluations: EvaluationRepository,
    private readonly problems: ProblemRepository, private readonly formatAdapters: Map<string, FormatAdapter>,
    private readonly evaluators: Evaluator[], private readonly rubricFor: (problem: Problem) => Rubric,
    private readonly timeoutMs: number,
  ) {}

  async startAttempt(learnerId: string, problemId: string): Promise<Attempt>;
  async submitAttempt(attemptId: string, rawContent: string, format: string): Promise<SubmitOutcome>;
  async retryEvaluation(attemptId: string, evaluatorId: string): Promise<{ evaluationId: string }>;
  async record(evaluationId: string, outcome: EvaluationOutcome): Promise<void>; // EvaluationRecorder
  async sweepStrandedEvaluations(): Promise<void>;
}
```

Internal timer map: `private timers = new Map<string, NodeJS.Timeout>()`. `submitAttempt`, for
each evaluator, after persisting `Evaluation(Pending)`: `evaluation.markRunning(); await
evaluations.save(evaluation); this.timers.set(evaluation.id, setTimeout(() =>
this.record(evaluation.id, { kind: 'failed', reason: 'timeout' }), this.timeoutMs));
evaluator.start(evaluation.id, document, rubric, context, this);`. `record()` clears the timer
first (`clearTimeout`), then applies `CitationVerifier.verify` + `Feedback.build` for `completed`
outcomes before calling `evaluation.complete(...)`, or `evaluation.fail(reason)` for `failed`
outcomes — then persists.

- [ ] **Step 1: Write failing test for the full submit→record happy path using two fake
      evaluators, asserting `submitAttempt` returns before either evaluator's `record` call
      lands (i.e., it does not block)**

`backend/tests/unit/application/EvaluationOrchestrator.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvaluationOrchestrator } from '../../../src/application/EvaluationOrchestrator.js';
import { FakeEvaluator } from '../../../src/adapters/evaluators/FakeEvaluator.js';
import { MarkdownFormatAdapter } from '../../../src/adapters/format/MarkdownFormatAdapter.js';
import { Attempt } from '../../../src/domain/Attempt.js';
import { Problem } from '../../../src/domain/Problem.js';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type AnchorScore, type Dimension } from '../../../src/domain/types.js';

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

function inMemoryRepos() {
  const attemptsStore = new Map<string, Attempt>();
  const evaluationsStore = new Map<string, any>();
  return {
    attempts: {
      save: vi.fn(async (a: Attempt) => attemptsStore.set(a.id, a)),
      findById: vi.fn(async (id: string) => attemptsStore.get(id) ?? null),
      findByLearnerAndProblem: vi.fn(async () => []),
      findByLearner: vi.fn(async () => []),
    },
    evaluations: {
      save: vi.fn(async (e: any) => evaluationsStore.set(e.id, e)),
      findById: vi.fn(async (id: string) => evaluationsStore.get(id) ?? null),
      findByAttemptId: vi.fn(async (attemptId: string) => [...evaluationsStore.values()].filter((e) => e.attemptId === attemptId)),
      findAllRunning: vi.fn(async () => [...evaluationsStore.values()].filter((e) => e.getState() === 'Running')),
    },
  };
}

describe('EvaluationOrchestrator', () => {
  it('returns immediately after submit, with evaluations left Pending/Running (not blocking on evaluator completion)', async () => {
    const repos = inMemoryRepos();
    const problem = new Problem('p1', 'Parking Lot', 'reqs', 'no event bus', {});
    const problems = { findAll: vi.fn(), findById: vi.fn(async () => problem) };
    const dimensions = ALL_DIMENSIONS.map((key) => ({ key, anchors: [0,1,2,3,4].map((s) => ({ score: s as AnchorScore, label: 'L', description: 'D' })) }));
    const weights = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, 1])) as Record<Dimension, number>;
    const rubric = new Rubric('v1', dimensions, weights, 'no event bus');

    const slowFake = new FakeEvaluator({ kind: 'timeout' }); // never resolves within the test's lifetime
    const orchestrator = new EvaluationOrchestrator(
      repos.attempts as any, repos.evaluations as any, problems as any,
      new Map([['markdown', new MarkdownFormatAdapter()]]), [slowFake], () => rubric, 60000,
    );

    const attempt = await orchestrator.startAttempt('learner1', 'p1');
    const outcome = await orchestrator.submitAttempt(attempt.id, VALID_MARKDOWN, 'markdown');

    expect(outcome.kind).toBe('accepted');
    if (outcome.kind === 'accepted') {
      const evaluation = await repos.evaluations.findById(outcome.evaluationIds[0]);
      expect(evaluation.getState()).toBe('Running'); // orchestrator marked it Running before firing start(), not stuck Pending
    }
  });

  it('rejects submission missing a required section, leaving the attempt in Draft', async () => {
    const repos = inMemoryRepos();
    const problem = new Problem('p1', 'Parking Lot', 'reqs', 'scope', {});
    const problems = { findAll: vi.fn(), findById: vi.fn(async () => problem) };
    const orchestrator = new EvaluationOrchestrator(
      repos.attempts as any, repos.evaluations as any, problems as any,
      new Map([['markdown', new MarkdownFormatAdapter()]]), [], () => new Rubric('v1', [], {}, 's'), 60000,
    );
    const attempt = await orchestrator.startAttempt('learner1', 'p1');
    const incomplete = VALID_MARKDOWN.replace(/# Trade-offs & Extensibility[\s\S]*$/, '');
    const outcome = await orchestrator.submitAttempt(attempt.id, incomplete, 'markdown');
    expect(outcome.kind).toBe('rejected');
    const reloaded = await repos.attempts.findById(attempt.id);
    expect(reloaded?.getState()).toBe('Draft');
  });

  it('idempotent replay on identical resubmit creates no second evaluation', async () => {
    const repos = inMemoryRepos();
    const problem = new Problem('p1', 'Parking Lot', 'reqs', 'scope', {});
    const problems = { findAll: vi.fn(), findById: vi.fn(async () => problem) };
    const fake = new FakeEvaluator({ kind: 'timeout' });
    const orchestrator = new EvaluationOrchestrator(
      repos.attempts as any, repos.evaluations as any, problems as any,
      new Map([['markdown', new MarkdownFormatAdapter()]]), [fake], () => new Rubric('v1', [], {}, 's'), 60000,
    );
    const attempt = await orchestrator.startAttempt('learner1', 'p1');
    await orchestrator.submitAttempt(attempt.id, VALID_MARKDOWN, 'markdown');
    const second = await orchestrator.submitAttempt(attempt.id, VALID_MARKDOWN, 'markdown');
    expect(second.kind).toBe('idempotentReplay');
    const evaluations = await repos.evaluations.findByAttemptId(attempt.id);
    expect(evaluations).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test --workspace backend -- EvaluationOrchestrator`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `EvaluationOrchestrator.ts`** per the Interfaces block and the timer
      logic described above. `startAttempt` generates an id (`crypto.randomUUID()`), constructs
      `new Attempt(id, learnerId, problemId, new Date())`, saves, returns it. `sweepStrandedEvaluations`
      calls `evaluations.findAllRunning()`, `.markInterrupted()` on each, saves.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test --workspace backend -- EvaluationOrchestrator`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/application backend/tests/unit/application
git commit -m "feat(application): EvaluationOrchestrator — submit ordering, fan-out, timeout, idempotency"
```

---

### Task 11: Zod request/response validation schemas

**Files:**
- Create: `backend/src/api/validation.ts`

**Interfaces:**
- Produces: `StartAttemptRequestSchema`, `SubmitAttemptRequestSchema`,
  `CreateLearnerRequestSchema` (Zod schemas), each with an inferred `z.infer<>` type exported
  alongside, consumed by Task 12's routes.

```ts
import { z } from 'zod';

export const CreateLearnerRequestSchema = z.object({ handle: z.string().min(1).max(64) });
export const StartAttemptRequestSchema = z.object({ learnerId: z.string().min(1), problemId: z.string().min(1) });
export const SubmitAttemptRequestSchema = z.object({ rawContent: z.string().min(1), format: z.literal('markdown') });
```

- [ ] **Step 1: Implement `validation.ts`** as above (no test file — Zod's own behavior is
      exercised through Task 12's route integration tests; a standalone unit test would just
      re-test Zod, which is YAGNI).

- [ ] **Step 2: Commit**

```bash
git add backend/src/api/validation.ts
git commit -m "feat(api): Zod request schemas"
```

---

### Task 12: Express API routes + wiring + integration test (fake evaluator, full loop)

**This task's passing integration test is the Phase-4 milestone: the practice loop must run
end to end here, before any AI code exists.**

**Files:**
- Modify: `backend/src/api/app.ts:1-10` (extend `createApp` to accept wired dependencies)
- Create: `backend/src/api/routes/learners.ts`
- Create: `backend/src/api/routes/problems.ts`
- Create: `backend/src/api/routes/attempts.ts`
- Create: `backend/src/api/routes/history.ts`
- Modify: `backend/src/server.ts` (wire real SQLite + seed + fake evaluator for local dev)
- Test: `backend/tests/integration/practiceLoop.test.ts`

**Interfaces:**
- Consumes: `EvaluationOrchestrator`, all repositories, `Problem`, `Learner`,
  `SEED_PROBLEMS` (Tasks 3, 4, 8, 9, 10).
- Produces: `createApp(deps: AppDependencies): express.Express` where

```ts
export interface AppDependencies {
  learners: LearnerRepository; problems: ProblemRepository;
  attempts: AttemptRepository; evaluations: EvaluationRepository;
  orchestrator: EvaluationOrchestrator;
}
```

Routes:

| Method | Path | Body / Query | Response |
|---|---|---|---|
| POST | `/learners` | `{ handle }` | `{ id, handle }` — get-or-create by handle (decision 12) |
| GET | `/problems` | — | `Problem[]` |
| POST | `/attempts` | `{ learnerId, problemId }` | `{ id, state: 'Draft' }` |
| POST | `/attempts/:id/submit` | `{ rawContent, format }` | 200 with `SubmitOutcome`-shaped body; **returns immediately**, evaluations `Pending`/`Running` |
| GET | `/attempts/:id` | — | attempt + its evaluations' current state + feedback if `Completed` |
| POST | `/attempts/:id/retry-evaluation` | `{ evaluatorId }` | `{ evaluationId }` |
| GET | `/learners/:id/history` | — | attempts across problems + per-dimension deltas + recurring weakness (stub returning raw attempt list until Task 19 fills in the computation) |

- [ ] **Step 1: Write failing integration test for the full loop**

`backend/tests/integration/practiceLoop.test.ts`:

```ts
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
    const learnerRes = await request(app).post('/learners').send({ handle: 'timing-learner' });
    const problemsRes = await request(app).get('/problems');
    const attemptRes = await request(app).post('/attempts').send({ learnerId: learnerRes.body.id, problemId: problemsRes.body[0].id });
    const submitRes = await request(app).post(`/attempts/${attemptRes.body.id}/submit`).send({ rawContent: VALID_MARKDOWN, format: 'markdown' });
    const immediateStatus = await request(app).get(`/attempts/${attemptRes.body.id}`);
    expect(['Pending', 'Running']).toContain(immediateStatus.body.evaluations[0].state);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test --workspace backend -- practiceLoop`
Expected: FAIL — routes and dependency-injected `createApp` do not exist yet.

- [ ] **Step 3: Implement `AppDependencies`-accepting `createApp`, and each route file.** Each
      route file exports an `express.Router` mounted in `app.ts`; request bodies validated with
      Task 11's Zod schemas (`400` with `{ error }` on `safeParse` failure).

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test --workspace backend -- practiceLoop`
Expected: PASS

- [ ] **Step 5: Wire `server.ts` for local dev** — open real SQLite file at
      `process.env.DATABASE_PATH`, run migrations, `seedDb(db)`, construct real repositories,
      register `[new FakeEvaluator({ kind: 'complete', outcome: {...trivial...} })]` as a
      **placeholder** evaluator list (replaced with AI + rule-based in Task 16), call
      `orchestrator.sweepStrandedEvaluations()` before `listen()`.

- [ ] **Step 6: Manually verify the loop runs** — `npm run dev --workspace backend`, then
      `curl` through learner creation → problem list → start attempt → submit → poll, confirming
      real end-to-end behavior outside the test suite too.

- [ ] **Step 7: Commit**

```bash
git add backend/src/api backend/src/server.ts backend/tests/integration/practiceLoop.test.ts
git commit -m "feat(api): wire practice loop end to end behind fake evaluator"
```

---

## Phase 5 — AI evaluator behind the `Evaluator` port

### Task 13: `LlmClient` — OpenAI adapter

**Files:**
- Create: `backend/src/adapters/llm/OpenAiLlmClient.ts`
- Test: `backend/tests/unit/adapters/OpenAiLlmClient.test.ts`

**Interfaces:**
- Consumes: `LlmClient` (Task 3).
- Produces: `OpenAiLlmClient implements LlmClient`, constructed with `{ baseUrl, model,
  apiKey }` read from `process.env` in `server.ts` (never hardcoded), using the `openai` npm
  SDK's `chat.completions.create` call shaped exactly per the Global Constraints / decision 15
  probe: `max_completion_tokens`, `reasoning_effort: 'minimal'`, no `temperature`,
  `response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true,
  schema: jsonSchema } }`.

- [ ] **Step 1: Write failing test using a mocked `openai` client (no network) asserting the
      exact request shape sent**

`backend/tests/unit/adapters/OpenAiLlmClient.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { OpenAiLlmClient } from '../../../src/adapters/llm/OpenAiLlmClient.js';

describe('OpenAiLlmClient', () => {
  it('sends max_completion_tokens, reasoning_effort minimal, no temperature, strict json_schema', async () => {
    const create = vi.fn(async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }));
    const fakeSdkClient = { chat: { completions: { create } } };
    const client = new OpenAiLlmClient(fakeSdkClient as any, 'gpt-5-nano');

    await client.completeJson({
      systemPrompt: 'sys', userPrompt: 'user',
      jsonSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
      schemaName: 'Feedback', maxCompletionTokens: 2000,
    });

    const callArgs = create.mock.calls[0][0];
    expect(callArgs.max_completion_tokens).toBe(2000);
    expect(callArgs.reasoning_effort).toBe('minimal');
    expect(callArgs.temperature).toBeUndefined();
    expect(callArgs.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'Feedback', strict: true, schema: expect.any(Object) },
    });
  });

  it('parses the JSON content out of the first choice', async () => {
    const create = vi.fn(async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }));
    const client = new OpenAiLlmClient({ chat: { completions: { create } } } as any, 'gpt-5-nano');
    const result = await client.completeJson({
      systemPrompt: 's', userPrompt: 'u', jsonSchema: {}, schemaName: 'X', maxCompletionTokens: 100,
    });
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test --workspace backend -- OpenAiLlmClient`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `OpenAiLlmClient.ts`**, accepting the `openai` SDK client instance
      via constructor injection (so the unit test above never touches the network) and a
      factory function elsewhere (`server.ts`) that constructs the real `OpenAI` client from
      `.env`.

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test --workspace backend -- OpenAiLlmClient`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/adapters/llm backend/tests/unit/adapters/OpenAiLlmClient.test.ts
git commit -m "feat(adapters): OpenAI LlmClient — gpt-5-nano required request shape"
```

---

### Task 14: AI `Evaluator` — prompt builder, Zod schema, retry policy

**Files:**
- Create: `backend/src/adapters/evaluators/feedbackSchema.ts`
- Create: `backend/src/adapters/evaluators/promptBuilder.ts`
- Create: `backend/src/adapters/evaluators/AiEvaluator.ts`
- Test: `backend/tests/unit/adapters/AiEvaluator.test.ts`

**Interfaces:**
- Consumes: `LlmClient`, `Evaluator`, `EvaluationRecorder`, `DesignDocument`, `Rubric`,
  `ProblemContext`, `RawCriterionFeedback` (Tasks 3, 13).
- Produces: `AiEvaluator implements Evaluator`, `id = 'ai'`; `FeedbackResponseSchema: z.ZodType`
  matching decision 9's shape exactly (`summary`, `criteria[]` each with `criterion`, `score`,
  `evidence[]` of `{sectionKey, quote, lineRange{start,end}}`, `strength`, nullable
  `concern`/`whyItMatters`/`suggestion`, `confidence`), with a `.superRefine` enforcing the
  nullable-as-a-group rule at the schema level too (belt-and-braces with `Feedback.build`'s own
  check); `buildPrompt(document, rubric, context): { systemPrompt: string; userPrompt: string }`
  that embeds the six section texts, the rubric's 8 dimensions with named anchors, and
  `context.scopeBoundary` verbatim (decision 5.4 — bounds the model to the problem as posed).

```ts
// feedbackSchema.ts
import { z } from 'zod';
export const CitationSchema = z.object({
  sectionKey: z.enum(['requirementsAssumptions','classesResponsibilities','relationshipsInteractions','keyBehaviourRules','edgeCasesTestability','tradeoffsExtensibility']),
  quote: z.string(), lineRange: z.object({ start: z.number(), end: z.number() }),
}).strict();
export const CriterionSchema = z.object({
  criterion: z.enum(['requirementUnderstanding','classResponsibilities','couplingCohesion','encapsulationInterfaces','abstractionPatterns','extensibility','edgeCasesTestability','explanationQuality']),
  score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  evidence: z.array(CitationSchema), strength: z.string(),
  concern: z.string().nullable(), whyItMatters: z.string().nullable(), suggestion: z.string().nullable(),
  confidence: z.enum(['low','medium','high']),
}).strict().superRefine((c, ctx) => {
  const group = [c.concern, c.whyItMatters, c.suggestion];
  const anyPresent = group.some((v) => v !== null);
  const allPresent = group.every((v) => v !== null);
  if (anyPresent && !allPresent) ctx.addIssue({ code: 'custom', message: 'concern/whyItMatters/suggestion must be present or null as a group' });
});
export const FeedbackResponseSchema = z.object({
  summary: z.string(), criteria: z.array(CriterionSchema).length(8),
}).strict();
```

- [ ] **Step 1: Write failing tests for the retry policy: schema-validation failure then a
      valid retry succeeds (2 retries), and failure after exhausting retries**

`backend/tests/unit/adapters/AiEvaluator.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { AiEvaluator } from '../../../src/adapters/evaluators/AiEvaluator.js';
import { DesignDocument } from '../../../src/domain/DesignDocument.js';
import { Rubric } from '../../../src/domain/Rubric.js';
import { ALL_DIMENSIONS, type AnchorScore, type Dimension } from '../../../src/domain/types.js';
import type { EvaluationOutcome } from '../../../src/domain/ports/Evaluator.js';

function rubric() {
  const dimensions = ALL_DIMENSIONS.map((key) => ({ key, anchors: [0,1,2,3,4].map((s) => ({ score: s as AnchorScore, label: 'L', description: 'D' })) }));
  const weights = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d, 1])) as Record<Dimension, number>;
  return new Rubric('v1', dimensions, weights, 'scope');
}
const doc = new DesignDocument(new Map(), [], null);
const context = { problemId: 'p1', requirements: 'r', scopeBoundary: 's' };

function validResponse() {
  return {
    summary: 'ok',
    criteria: ALL_DIMENSIONS.map((d) => ({
      criterion: d, score: 3, evidence: [], strength: 'fine',
      concern: null, whyItMatters: null, suggestion: null, confidence: 'high',
    })),
  };
}

describe('AiEvaluator', () => {
  it('recovers from malformed output on retry and completes', async () => {
    const completeJson = vi.fn()
      .mockResolvedValueOnce({ not: 'valid' })
      .mockResolvedValueOnce(validResponse());
    const llm = { completeJson };
    const evaluator = new AiEvaluator(llm as any, 2);
    let outcome: EvaluationOutcome | undefined;
    const recorder = { record: vi.fn(async (_id: string, o: EvaluationOutcome) => { outcome = o; }) };
    evaluator.start('e1', doc, rubric(), context, recorder);
    await vi.waitFor(() => expect(outcome).toBeDefined());
    expect(outcome!.kind).toBe('completed');
    expect(completeJson).toHaveBeenCalledTimes(2);
  });

  it('fails after exhausting 2 retries on persistently malformed output, applying nothing partially', async () => {
    const completeJson = vi.fn().mockResolvedValue({ not: 'valid' });
    const llm = { completeJson };
    const evaluator = new AiEvaluator(llm as any, 2);
    let outcome: EvaluationOutcome | undefined;
    const recorder = { record: vi.fn(async (_id: string, o: EvaluationOutcome) => { outcome = o; }) };
    evaluator.start('e1', doc, rubric(), context, recorder);
    await vi.waitFor(() => expect(outcome).toBeDefined());
    expect(outcome!.kind).toBe('failed');
    expect(completeJson).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('sends the problem scope boundary in the prompt so the model is bounded to the problem as posed', async () => {
    const completeJson = vi.fn(async (params: any) => { expect(params.userPrompt).toContain('no event bus'); return validResponse(); });
    const evaluator = new AiEvaluator({ completeJson } as any, 2);
    const recorder = { record: vi.fn() };
    evaluator.start('e1', doc, rubric(), { problemId: 'p1', requirements: 'r', scopeBoundary: 'no event bus' }, recorder);
    await vi.waitFor(() => expect(completeJson).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test --workspace backend -- AiEvaluator`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `promptBuilder.ts` and `AiEvaluator.ts`.** `start()`: loop up to
      `1 + maxRetries` attempts calling `llmClient.completeJson(...)`, `FeedbackResponseSchema
      .safeParse(raw)` each time; on first success map to `RawCriterionFeedback[]` (score is
      never null from the AI path — only the rule-based evaluator abstains) and call
      `recorder.record(evaluationId, { kind: 'completed', summary, criteria })`; if every
      attempt fails validation, call `recorder.record(evaluationId, { kind: 'failed', reason:
      'invalid AI response after retries' })`. Transient `LlmClient` errors (thrown exceptions)
      count toward the same retry budget.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test --workspace backend -- AiEvaluator`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/adapters/evaluators/feedbackSchema.ts backend/src/adapters/evaluators/promptBuilder.ts backend/src/adapters/evaluators/AiEvaluator.ts backend/tests/unit/adapters/AiEvaluator.test.ts
git commit -m "feat(adapters): AI evaluator — prompt builder, strict Zod schema, 2-retry policy"
```

---

### Task 15: Register AI + rule-based evaluators as N=2 permanent in `server.ts`

**Files:**
- Modify: `backend/src/server.ts` (replace the Task 12 Step 5 placeholder fake-evaluator list)

**Interfaces:**
- Consumes: `AiEvaluator`, `RuleBasedEvaluator`, `OpenAiLlmClient` (Tasks 6, 13, 14).

- [ ] **Step 1: Wire real evaluators in `server.ts`**

```ts
import OpenAI from 'openai';
import { OpenAiLlmClient } from './adapters/llm/OpenAiLlmClient.js';
import { AiEvaluator } from './adapters/evaluators/AiEvaluator.js';
import { RuleBasedEvaluator } from './adapters/evaluators/RuleBasedEvaluator.js';

const sdkClient = new OpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY });
const llmClient = new OpenAiLlmClient(sdkClient, process.env.OPENAI_MODEL ?? 'gpt-5-nano');
const evaluators = [
  new AiEvaluator(llmClient, Number(process.env.LLM_MAX_RETRIES ?? 2)),
  new RuleBasedEvaluator(),
];
```

Pass `evaluators` into the `EvaluationOrchestrator` constructor in place of the Task 12
placeholder. The fake evaluator remains used only by tests (Tasks 4-10, 12's test file), never
by `server.ts`.

- [ ] **Step 2: Manually verify the loop still runs end to end with real evaluators** —
      `npm run dev --workspace backend`, submit a real attempt via `curl`, poll until both
      evaluations show `Completed` (or `Failed` with a stored reason — either is a valid
      manual-check outcome, since the point is exercising the real path, not guaranteeing the
      live API succeeds).

- [ ] **Step 3: Run the full test suite once more to confirm nothing broke**

Run: `npm run test --workspace backend`
Expected: PASS (all prior tests, including `practiceLoop.test.ts`, still pass — that test
constructs its own `FakeEvaluator`-based orchestrator and never touches `server.ts`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: register AI + rule-based evaluators as N=2 permanent (decision 10)"
```

---

## Phase 6 — Four screens (`ui-ux-pro-max`, enabled by user for this phase only)

> Invoke `ui-ux-pro-max` for these four tasks only. Bound by decision 13: **plain UI, zero
> business rules.** Scope is legibility of feedback (per-criterion cards, evidence quotes,
> score deltas) — not visual ambition. No component library beyond what the skill's own
> recommendation provides; no animation, no responsive polish (explicitly excluded by decision
> 13). Every validation/aggregation/state rule already lives in the backend and is already
> tested through the API — the UI only renders what the API returns and POSTs what the user
> types.

### Task 16: Frontend scaffold + API client

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/index.html`
- Create: `frontend/src/main.tsx`, `frontend/src/App.tsx`
- Create: `frontend/src/api/client.ts` — thin `fetch` wrappers matching Task 12's routes exactly
  (`createLearner`, `listProblems`, `startAttempt`, `submitAttempt`, `getAttempt`, `getHistory`)

- [ ] **Step 1: Scaffold with Vite's React-TS template**

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install react-router-dom
```

- [ ] **Step 2: Implement `api/client.ts`** — one function per route from Task 12's table,
      typed against the same response shapes the backend integration test asserts on.

- [ ] **Step 3: Commit**

```bash
git add frontend
git commit -m "chore: frontend Vite + React scaffold, typed API client"
```

---

### Task 17: Screen 1 — Problem list

**Files:** `frontend/src/screens/ProblemList.tsx`

Fetches `GET /problems`, renders title + one-line requirements summary per problem, links to
Screen 2. Handle-entry (decision 12 identity) lives here or a lightweight top-level prompt —
`POST /learners` on first visit, persist the returned id in `localStorage`.

- [ ] **Step 1: Build the screen with `ui-ux-pro-max`**, wired to the real API client.
- [ ] **Step 2: Manually verify in the browser** — run `npm run dev` in both `backend` and
      `frontend`, confirm the seeded 5 problems render.
- [ ] **Step 3: Commit.**

---

### Task 18: Screen 2 — Problem detail (editor pre-filled with the six-section template)

**Files:** `frontend/src/screens/ProblemDetail.tsx`

Shows full requirements + scope boundary; a `<textarea>` pre-filled with the six-section
Markdown template (headings only, per decision 2); "Start Attempt" calls `POST /attempts`;
"Submit" calls `POST /attempts/:id/submit` with the textarea content, then navigates to Screen 3.

- [ ] **Step 1: Build the screen with `ui-ux-pro-max`.**
- [ ] **Step 2: Manually verify** — start an attempt, edit the template, submit, confirm
      navigation to the result screen with a pending state visible immediately (not blocked).
- [ ] **Step 3: Commit.**

---

### Task 19: Screen 3 — Result (polling, per-criterion cards, evidence, top priorities, secondary panel)

**Files:** `frontend/src/screens/Result.tsx`

Polls `GET /attempts/:id` every ~2s while any evaluation is `Pending`/`Running`. Once the AI
evaluation is `Completed`, renders it as the headline: per-criterion cards (criterion, score,
strength, concern/whyItMatters/suggestion when present, evidence quotes with section reference,
confidence), `topPriorities` called out, `summary`. The rule-based evaluation renders as a
**separate, clearly-labeled "automated checks" panel below — never merged** with the AI panel
(decision 10 display rule), showing only its 3 scored dimensions plus a note that the other 5
are not rule-assessable. If an evaluation is `Failed`, show the stored failure reason plainly
(decision 6/10 — never swallowed).

- [ ] **Step 1: Build the screen with `ui-ux-pro-max`.**
- [ ] **Step 2: Manually verify** with a live submission — confirm polling stops on terminal
      states, confirm the two evaluator panels never merge, confirm a forced `Failed` (e.g. via
      temporarily setting an invalid API key) renders its reason instead of a blank state.
- [ ] **Step 3: Commit.**

---

### Task 20: `history.ts` route computation (deltas + recurring weakness) + Screen 4

**Files:**
- Modify: `backend/src/api/routes/history.ts:1-1` (replace Task 12's stub with real computation)
- Create: `backend/src/application/HistoryProjection.ts`
- Test: `backend/tests/unit/application/HistoryProjection.test.ts`
- Create: `frontend/src/screens/History.tsx`

**Interfaces:**
- Produces:

```ts
export interface DimensionDelta { dimension: Dimension; previousScore: number | null; currentScore: number | null; delta: number | null }
export interface AttemptSummary { attemptId: string; problemId: string; submittedAt: string; deltas: DimensionDelta[] }
export interface RecurringWeakness { dimension: Dimension; lowScoreCount: number }

export class HistoryProjection {
  static build(attempts: { attempt: Attempt; evaluations: Evaluation[] }[]): {
    attempts: AttemptSummary[]; recurringWeaknesses: RecurringWeakness[];
  };
  // deltas: per dimension, compare this attempt's AI-evaluation criterion score to the same
  //   dimension's score on the learner's immediately preceding attempt on the SAME problem
  // recurringWeaknesses: group all scored criteria across all attempts/problems by dimension,
  //   flag dimensions where score <= 1 in at least 2 of the learner's attempts
}
```

- [ ] **Step 1: Write failing test for delta computation and recurring-weakness detection**

`backend/tests/unit/application/HistoryProjection.test.ts` — construct two `Attempt`s on the
same problem with `Completed` `Evaluation`s carrying different `requirementUnderstanding`
scores (e.g. 1 then 3), assert the second attempt's delta for that dimension is `+2`; construct
three attempts (any problems) where `extensibility` scores `0, 1, 1`, assert `extensibility`
appears in `recurringWeaknesses` with `lowScoreCount: 3`.

- [ ] **Step 2: Run test, verify it fails; implement `HistoryProjection.ts`; run again to verify
      pass.**

- [ ] **Step 3: Wire `history.ts` route** to call `attempts.findByLearner(id)` +
      `evaluations.findByAttemptId` per attempt, pass into `HistoryProjection.build`.

- [ ] **Step 4: Build `History.tsx` with `ui-ux-pro-max`** — ordered attempt list, per-dimension
      delta badges, a recurring-weakness callout section. Verify against the seeded demo
      learner (Task 9) so it has content immediately.

- [ ] **Step 5: Manually verify in the browser** — load the demo learner's history, confirm
      deltas and recurring weakness render from real seeded data.

- [ ] **Step 6: Commit**

```bash
git add backend/src/application/HistoryProjection.ts backend/src/api/routes/history.ts backend/tests/unit/application/HistoryProjection.test.ts frontend/src/screens/History.tsx
git commit -m "feat: history deltas + recurring weakness, History screen"
```

---

## Phase 7 — Failure and edge-case tests (decision 14's 13 cases)

### Task 21: Remaining edge-case tests not already covered by earlier tasks

Cross-check against decision 14's table. Already covered by earlier tasks' own test files:
renamed/missing/empty section and unparseable mermaid (Task 5), evaluator-reports-failure and
never-reports/timeout (Task 10), stale-Running-on-restart (Task 8's `findAllRunning` +
`EvaluationOrchestrator.sweepStrandedEvaluations`), malformed-then-valid-retry and
malformed-after-2-retries (Task 14), fabricated-evidence-quote (Task 4's `CitationVerifier`),
identical-resubmit and different-content-conflict (Task 4's `Attempt` + Task 10's orchestrator
test). Remaining case needing its own explicit test:

**Files:**
- Test: `backend/tests/unit/application/EvaluationOrchestrator.retry.test.ts`

- [ ] **Step 1: Write failing test for "retry after failed evaluation creates a new Evaluation;
      attempt state untouched"**

```ts
import { describe, it, expect, vi } from 'vitest';
// ... same inMemoryRepos/rubric/problem setup pattern as Task 10's test file ...
// 1. submitAttempt with a fake evaluator programmed to fail immediately
// 2. call orchestrator.retryEvaluation(attemptId, 'fake')
// 3. assert evaluations.findByAttemptId(attemptId) now has length 2
// 4. assert attempts.findById(attemptId).getState() is still 'Submitted' (untouched)
```

- [ ] **Step 2: Run test, verify it fails; implement `retryEvaluation` in
      `EvaluationOrchestrator.ts` (create a new `Evaluation` with the same `evaluatorId` against
      the same stored submission, run through the same timer/start path as `submitAttempt`, but
      touch nothing on `Attempt`); run again to verify pass.**

- [ ] **Step 3: Run the full backend test suite and count tests against decision 14's table of
      13, confirming all 13 are represented (by file/test name mapping in a scratch note — not
      committed, just for your own verification).**

Run: `npm run test --workspace backend`
Expected: PASS — all tests, ~25-30 total per decision 14's target.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/unit/application/EvaluationOrchestrator.retry.test.ts backend/src/application/EvaluationOrchestrator.ts
git commit -m "test: retry-after-failed-evaluation creates new Evaluation, attempt untouched"
```

---

## Phase 8 — Write-ups (protected ~2 hours, do not cut)

### Task 22: Research note (1-2 pages)

**Files:** Create: `docs/research-note.md`

Content, per assignment §7 and guide §2: the learner problem (why LLD practice is hard to
self-evaluate — draw from `chatGPT-understanding.md` §9-13, §24, which are the verified
reasoning sections, not the unverified §15-17 platform list); a few existing
approaches/tools — cite only what a live lookup can currently confirm exists and is described
accurately, not the unsourced platform/repo names in `chatGPT-understanding.md` §15-17 verbatim
(do a quick real check before naming anything, per the fresh-session prompt's constraint); key
gaps found; product direction taken (decisions 1-3, 8, 11). State explicitly that §15-17 of the
research context doc were excluded as unverified.

- [ ] **Step 1: Draft the note** covering: learner problem, 2-3 researched approaches
      (verified), key gaps, product direction, in 1-2 pages.
- [ ] **Step 2: Commit**

```bash
git add docs/research-note.md
git commit -m "docs: research note"
```

---

### Task 23: Design note

**Files:** Create: `docs/design-note.md`

Content, per assignment §7: MVP explanation, user flow (the six-step practice loop), important
classes/interfaces (the domain model from Tasks 3-4 — `Attempt`, `Submission`, `Evaluation`,
`Rubric`, `Feedback`, and the four ports), evaluation approach (decisions 5, 8, 9, 10), key
trade-offs (pull directly from each decision's "Rejected:" lines — they are pre-written
trade-off statements). Must include, stated plainly per the fresh-session prompt:

- **Change Test A answer:** register one Markdown `FormatAdapter`; zero domain model changes —
  point at Task 5's adapter and Task 3's `DesignDocument` boundary as the evidence.
- **Change Test B answer:** a second evaluator (`RuleBasedEvaluator`, Task 6) is already running
  in production, N=2 permanently (Task 15) — point at it as live evidence, not a hypothetical.
- **HLD line (guide §10):** the first component to extract is the evaluation worker, because it
  is the only part with a different resource profile (LLM latency, token cost) and failure mode
  (timeouts, malformed output) than the rest of the monolith.
- **Limitation list**, stated deliberately: no authentication (declared handle, decision 12);
  in-process background execution rather than a broker (decision 6.2); rule-based evaluator
  scores only 3 of 8 dimensions and abstains on the rest (decision 10).

- [ ] **Step 1: Draft the note**, pulling structure directly from DECISIONS.md's 15 entries —
      this document mostly reorganizes already-written reasoning into the assignment's
      requested shape rather than inventing new prose.
- [ ] **Step 2: Commit**

```bash
git add docs/design-note.md
git commit -m "docs: design note"
```

---

### Task 24: README.md

**Files:** Modify: `README.md`

Content: how to run (backend `npm install && npm run dev --workspace backend`, frontend
`npm install && npm run dev --workspace frontend`, required `backend/.env` vars from
`.env.example`), how to run tests (`npm run test --workspace backend`), key decisions (link to
`DECISIONS.md`), limitations (same list as Task 23, restated for a README reader), AI usage
pointer to `AI_USAGE.md`.

- [ ] **Step 1: Write the README.**
- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README — run instructions, decisions, limitations"
```

---

### Task 25: AI_USAGE.md

**Files:** Create: `AI_USAGE.md`

3-5 meaningful AI-assisted decisions: what was suggested, what was accepted or rejected, and
why. Real candidates from this session: the provider probe result driving the primary-provider
choice (accepted — TensorMux disqualified on evidence, not preference); the
start/report-back `Evaluator` contract vs. a synchronous `evaluate()` call (accepted, because it
is the only contract with an honest human-reviewer implementation); Composite-pattern merging of
evaluator results (rejected — destroys per-evaluator attribution); the `whyItMatters` field
addition beyond the guide's suggested feedback shape (accepted, deliberate deviation with
stated reasoning); any place a plan step here got revised during actual execution (fill in once
real — do not fabricate one now).

- [ ] **Step 1: Write the note**, using real accepted/rejected decisions from DECISIONS.md's
      "Rejected:" lines plus at least one thing that changed during actual implementation
      (Phase 3-7), not purely pre-implementation planning.
- [ ] **Step 2: Commit**

```bash
git add AI_USAGE.md
git commit -m "docs: AI usage — meaningful AI-assisted decisions"
```

---

## Phase 9 — Verification and submission

### Task 26: Verification before completion

- [ ] Run **superpowers:verification-before-completion**.
- [ ] Run `npm run test --workspace backend` — full suite green.
- [ ] Manually re-run the full practice loop once more in the browser (Screens 1→2→3→4) against
      the real (non-fake) evaluators, confirming the "must still run end to end" constraint
      holds at the very end, not just after Task 12.
- [ ] Confirm `backend/.env` is not tracked by git (`git status` must not list it).
- [ ] Confirm all 8 deliverables from assignment §7 exist: research note, design note, working
      prototype, tests, README, AI_USAGE.md.
- [ ] Submit via the Google Form linked in assignment §9.

---

## Self-Review Notes (from the plan author, not a task)

- **Spec coverage:** every one of decisions 1-15 has at least one task producing the class/port
  it specifies, and every failure/edge case in decision 14's table maps to a specific test
  (enumerated in Task 21). Both change tests and the HLD line are written into Task 23
  explicitly, not left implicit.
- **Granularity note:** tasks are sized per-component rather than per-single-assertion (a
  deliberate reading of "bite-sized" for a 2-day, deadline-bound build) — each task still ends
  in an independently testable, committable deliverable, and every test step ships runnable
  code rather than a description of one.
