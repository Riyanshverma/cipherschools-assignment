/**
 * Thin fetch wrappers over the backend API — one function per route. No business logic,
 * no response transformation beyond JSON parsing and typing (Decision 13: plain UI).
 *
 * Types below are copied field-for-field from the backend route handlers and domain types
 * (backend/src/api/routes/*.ts, backend/src/application/EvaluationOrchestrator.ts,
 * backend/src/domain/ports/Evaluator.ts, backend/src/domain/Feedback.ts) — not guessed from
 * the plan's summary table.
 */

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000';

// ---- shared domain shapes (backend/src/domain/types.ts) ----

export type Dimension =
  | 'requirementUnderstanding' | 'classResponsibilities' | 'couplingCohesion'
  | 'encapsulationInterfaces' | 'abstractionPatterns' | 'extensibility'
  | 'edgeCasesTestability' | 'explanationQuality';

export type SectionKey =
  | 'requirementsAssumptions' | 'classesResponsibilities' | 'relationshipsInteractions'
  | 'keyBehaviourRules' | 'edgeCasesTestability' | 'tradeoffsExtensibility';

export type AnchorScore = 0 | 1 | 2 | 3 | 4;
export type Confidence = 'none' | 'low' | 'medium' | 'high';
export interface LineRange { start: number; end: number }

// ---- backend/src/domain/ports/Evaluator.ts ----

export interface Citation { sectionKey: SectionKey; quote: string; lineRange: LineRange }

// ---- backend/src/domain/Feedback.ts ----

export interface CriterionFeedback {
  criterion: Dimension;
  score: AnchorScore | null;
  evidence: Citation[];
  strength: string | null;
  concern: string | null;
  whyItMatters: string | null;
  suggestion: string | null;
  confidence: Confidence;
}

export interface AggregateScore { total: number; maxPossible: number }

export interface Feedback {
  summary: string;
  criteria: CriterionFeedback[];
  topPriorities: Dimension[];
  aggregateScore: AggregateScore | null;
}

// ---- POST /learners (backend/src/api/routes/learners.ts) ----

export interface Learner { id: string; handle: string }

// ---- GET /problems (backend/src/api/routes/problems.ts, backend/src/domain/Problem.ts) ----

export interface Problem {
  id: string;
  title: string;
  requirements: string;
  scopeBoundary: string;
  rubricWeights: Partial<Record<Dimension, number>>;
}

// ---- POST /attempts (backend/src/api/routes/attempts.ts, backend/src/domain/Attempt.ts) ----

export type AttemptState = 'Draft' | 'Submitted';
export interface StartAttemptResponse { id: string; state: AttemptState }

// ---- POST /attempts/:id/submit (SubmitOutcome, backend/src/application/EvaluationOrchestrator.ts) ----

export type SubmitOutcome =
  | { kind: 'accepted'; attemptId: string; evaluationIds: string[] }
  | { kind: 'idempotentReplay'; attemptId: string; evaluationIds: string[] }
  | { kind: 'conflict'; message: string }
  | { kind: 'rejected'; missingSections: string[]; emptySections: string[] };

// ---- GET /attempts/:id (backend/src/api/routes/attempts.ts, backend/src/domain/Evaluation.ts) ----

export type EvaluationState = 'Pending' | 'Running' | 'Completed' | 'Failed';

export interface AttemptEvaluation {
  id: string;
  evaluatorId: string;
  state: EvaluationState;
  feedback: Feedback | null;
  failureReason: string | null;
}

export interface AttemptDetail {
  id: string;
  learnerId: string;
  problemId: string;
  state: AttemptState;
  evaluations: AttemptEvaluation[];
}

// ---- POST /attempts/:id/retry-evaluation ----

export interface RetryEvaluationResponse { evaluationId: string }

// ---- GET /learners/:id/history (backend/src/api/routes/history.ts, backend/src/application/HistoryProjection.ts) ----

export interface DimensionDelta {
  dimension: Dimension;
  previousScore: number | null;
  currentScore: number | null;
  delta: number | null;
}

export interface AttemptSummary {
  attemptId: string;
  problemId: string;
  submittedAt: string; // Date, serialized to ISO string over JSON
  deltas: DimensionDelta[];
}

export interface RecurringWeakness {
  dimension: Dimension;
  lowScoreCount: number;
}

export interface HistoryResponse {
  attempts: AttemptSummary[];
  recurringWeaknesses: RecurringWeakness[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** POST /learners — get-or-create by handle. */
export function createLearner(handle: string): Promise<Learner> {
  return request<Learner>('/learners', { method: 'POST', body: JSON.stringify({ handle }) });
}

/** GET /problems — full problem list. */
export function listProblems(): Promise<Problem[]> {
  return request<Problem[]>('/problems');
}

/** POST /attempts — start a new attempt. */
export function startAttempt(learnerId: string, problemId: string): Promise<StartAttemptResponse> {
  return request<StartAttemptResponse>('/attempts', {
    method: 'POST',
    body: JSON.stringify({ learnerId, problemId }),
  });
}

/** POST /attempts/:id/submit — submit raw content for evaluation. */
export function submitAttempt(attemptId: string, rawContent: string, format: string): Promise<SubmitOutcome> {
  return request<SubmitOutcome>(`/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ rawContent, format }),
  });
}

/** GET /attempts/:id — attempt plus its evaluations. */
export function getAttempt(attemptId: string): Promise<AttemptDetail> {
  return request<AttemptDetail>(`/attempts/${attemptId}`);
}

/** POST /attempts/:id/retry-evaluation — re-run one evaluator against the existing submission. */
export function retryEvaluation(attemptId: string, evaluatorId: string): Promise<RetryEvaluationResponse> {
  return request<RetryEvaluationResponse>(`/attempts/${attemptId}/retry-evaluation`, {
    method: 'POST',
    body: JSON.stringify({ evaluatorId }),
  });
}

/** GET /learners/:id/history — per-dimension deltas + recurring weaknesses for a learner. */
export function getHistory(learnerId: string): Promise<HistoryResponse> {
  return request<HistoryResponse>(`/learners/${learnerId}/history`);
}
