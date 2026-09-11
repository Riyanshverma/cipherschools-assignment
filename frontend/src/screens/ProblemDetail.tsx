import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listProblems, startAttempt, submitAttempt, type Problem, type SubmitOutcome } from '../api/client';

const LEARNER_ID_KEY = 'lld.learnerId';

// Six-section Markdown template, headings only — decision 2 SectionKeys / MarkdownFormatAdapter canon.
const TEMPLATE = `# Requirements & Assumptions

# Classes & Responsibilities

# Relationships & Interactions

# Key Behaviour & Rules

# Edge Cases & Testability

# Trade-offs & Extensibility
`;

type Rejection = Extract<SubmitOutcome, { kind: 'rejected' }>;

export function ProblemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const learnerId = localStorage.getItem(LEARNER_ID_KEY);

  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [content, setContent] = useState(TEMPLATE);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  useEffect(() => {
    listProblems()
      .then(setProblems)
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  const problem = problems?.find((p) => p.id === id) ?? null;

  async function handleStart() {
    if (!learnerId || !id) return;
    setStarting(true);
    setActionError(null);
    try {
      const res = await startAttempt(learnerId, id);
      setAttemptId(res.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit() {
    if (!attemptId) return;
    setSubmitting(true);
    setActionError(null);
    setRejection(null);
    setConflictMessage(null);
    try {
      const outcome = await submitAttempt(attemptId, content, 'markdown');
      if (outcome.kind === 'accepted' || outcome.kind === 'idempotentReplay') {
        navigate(`/attempts/${outcome.attemptId}`);
      } else if (outcome.kind === 'rejected') {
        setRejection(outcome);
      } else {
        setConflictMessage(outcome.message);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!learnerId) {
    return (
      <div className="screen">
        <p className="error">
          No learner profile found. <Link to="/">Go back to the problem list</Link> to create one.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="screen">
        <p className="error">Failed to load problem: {loadError}</p>
      </div>
    );
  }

  if (!problems) {
    return (
      <div className="screen">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="screen">
        <p className="error">
          Problem not found. <Link to="/">Go back to the problem list</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="screen">
      <p>
        <Link to="/">← All problems</Link>
      </p>
      <h1>{problem.title}</h1>

      <section className="card">
        <h2>Requirements</h2>
        <p className="pre">{problem.requirements}</p>
      </section>

      <section className="card">
        <h2>Scope Boundary</h2>
        <p className="pre">{problem.scopeBoundary}</p>
      </section>

      <section className="card">
        <h2>Your Design</h2>
        <textarea
          className="ta"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          spellCheck={false}
        />
        <div className="row">
          <button className="btn" onClick={handleStart} disabled={starting || !!attemptId}>
            {attemptId ? 'Attempt started' : starting ? 'Starting…' : 'Start Attempt'}
          </button>
          <button className="btn" onClick={handleSubmit} disabled={!attemptId || submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
        {actionError && <p className="error">{actionError}</p>}
        {conflictMessage && <p className="error">{conflictMessage}</p>}
        {rejection && (
          <div className="error">
            <p>Submission rejected — fix these sections and submit again:</p>
            {rejection.missingSections.length > 0 && <p>Missing: {rejection.missingSections.join(', ')}</p>}
            {rejection.emptySections.length > 0 && <p>Empty: {rejection.emptySections.join(', ')}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
