import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getAttempt,
  type AttemptDetail,
  type AttemptEvaluation,
  type CriterionFeedback,
  type Feedback,
} from '../api/client';

const POLL_MS = 2000;

function label(camel: string): string {
  const withSpaces = camel.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function isTerminal(state: string): boolean {
  return state === 'Completed' || state === 'Failed';
}

export function Result() {
  const { id } = useParams<{ id: string }>();
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function poll() {
      try {
        const detail = await getAttempt(id!);
        if (cancelled) return;
        setAttempt(detail);
        setError(null);
        const stillWorking = detail.evaluations.some((e) => !isTerminal(e.state));
        if (stillWorking) {
          timerRef.current = setTimeout(poll, POLL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        // A fetch error (network blip, transient 5xx) is not a terminal evaluation state —
        // keep whatever was last successfully rendered and keep polling, same as the happy path.
        setError(err instanceof Error ? err.message : String(err));
        timerRef.current = setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id]);

  if (!attempt) {
    return (
      <div className="screen">
        {error ? (
          <p className="error">Failed to load attempt: {error}</p>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    );
  }

  const ai = attempt.evaluations.find((e) => e.evaluatorId === 'ai') ?? null;
  const rule = attempt.evaluations.find((e) => e.evaluatorId === 'rule-based') ?? null;
  const others = attempt.evaluations.filter((e) => e.evaluatorId !== 'ai' && e.evaluatorId !== 'rule-based');

  return (
    <div className="screen">
      <p>
        <Link to="/">← All problems</Link>
      </p>
      <h1>Attempt Result</h1>

      {error && <p className="muted">Having trouble reaching the server, retrying…</p>}

      <EvaluationPanel title="AI Evaluation" evaluation={ai} kind="ai" />
      <EvaluationPanel title="Automated Checks (rule-based)" evaluation={rule} kind="rule" />
      {others.map((e) => (
        <EvaluationPanel key={e.id} title={e.evaluatorId} evaluation={e} kind="ai" />
      ))}
    </div>
  );
}

function EvaluationPanel({
  title,
  evaluation,
  kind,
}: {
  title: string;
  evaluation: AttemptEvaluation | null;
  kind: 'ai' | 'rule';
}) {
  if (!evaluation) {
    return (
      <section className={`panel panel-${kind}`}>
        <h2>{title}</h2>
        <p className="muted">No evaluation registered.</p>
      </section>
    );
  }

  return (
    <section className={`panel panel-${kind}`}>
      <h2>
        {title} <span className={`status-pill status-${evaluation.state.toLowerCase()}`}>{evaluation.state}</span>
      </h2>

      {evaluation.state === 'Failed' && (
        <p className="error">Evaluation failed: {evaluation.failureReason ?? 'no reason recorded'}</p>
      )}

      {(evaluation.state === 'Pending' || evaluation.state === 'Running') && (
        <p className="muted">Evaluating… this refreshes automatically every {POLL_MS / 1000}s.</p>
      )}

      {evaluation.state === 'Completed' && evaluation.feedback && (
        <FeedbackView feedback={evaluation.feedback} kind={kind} />
      )}
    </section>
  );
}

function FeedbackView({ feedback, kind }: { feedback: Feedback; kind: 'ai' | 'rule' }) {
  const criteria = kind === 'rule' ? feedback.criteria.filter((c) => c.score !== null) : feedback.criteria;
  const omitted = kind === 'rule' ? feedback.criteria.length - criteria.length : 0;

  return (
    <div>
      <p>{feedback.summary}</p>

      {feedback.aggregateScore && (
        <p className="muted">
          Aggregate score: {feedback.aggregateScore.total} / {feedback.aggregateScore.maxPossible}
        </p>
      )}

      {feedback.topPriorities.length > 0 && (
        <div className="priorities">
          <strong>Top priorities:</strong>
          <ul>
            {feedback.topPriorities.map((p) => (
              <li key={p}>{label(p)}</li>
            ))}
          </ul>
        </div>
      )}

      {omitted > 0 && (
        <p className="muted">
          {omitted} of {feedback.criteria.length} criteria aren't rule-assessable and are omitted below.
        </p>
      )}

      <div className="criteria-grid">
        {criteria.map((c) => (
          <CriterionCard key={c.criterion} criterion={c} />
        ))}
      </div>
    </div>
  );
}

function CriterionCard({ criterion }: { criterion: CriterionFeedback }) {
  return (
    <div className="criterion">
      <div className="criterion-header">
        <strong>{label(criterion.criterion)}</strong>
        <span className="score">{criterion.score ?? '—'}/4</span>
      </div>
      <p className="muted">confidence: {criterion.confidence}</p>
      {criterion.strength && (
        <p>
          <strong>Strength:</strong> {criterion.strength}
        </p>
      )}
      {criterion.concern && (
        <p>
          <strong>Concern:</strong> {criterion.concern}
        </p>
      )}
      {criterion.whyItMatters && (
        <p>
          <strong>Why it matters:</strong> {criterion.whyItMatters}
        </p>
      )}
      {criterion.suggestion && (
        <p>
          <strong>Suggestion:</strong> {criterion.suggestion}
        </p>
      )}
      {criterion.evidence.length > 0 && (
        <div className="evidence">
          {criterion.evidence.map((e, i) => (
            <blockquote key={i} className="evidence-quote">
              “{e.quote}” <span className="muted">— {label(e.sectionKey)}</span>
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}
