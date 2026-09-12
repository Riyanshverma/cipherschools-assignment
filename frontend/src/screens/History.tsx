import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getHistory,
  listProblems,
  type AttemptSummary,
  type DimensionDelta,
  type Problem,
  type RecurringWeakness,
} from '../api/client';

function label(camel: string): string {
  const withSpaces = camel.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function History() {
  const { id } = useParams<{ id: string }>();
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null);
  const [weaknesses, setWeaknesses] = useState<RecurringWeakness[]>([]);
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // best-effort — only used to show a problem title instead of a raw id; falls back cleanly.
    listProblems()
      .then(setProblems)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    getHistory(id)
      .then((res) => {
        setAttempts(res.attempts);
        setWeaknesses(res.recurringWeaknesses);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [id]);

  if (error) {
    return (
      <div className="screen">
        <p className="error">Failed to load history: {error}</p>
      </div>
    );
  }

  if (!attempts) {
    return (
      <div className="screen">
        <h1>History</h1>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <p>
        <Link to="/">← All problems</Link>
      </p>
      <h1>History</h1>

      {weaknesses.length > 0 && (
        <section className="callout callout-warning">
          <h2>Recurring weakness{weaknesses.length > 1 ? 'es' : ''}</h2>
          <p className="muted">Scored 1/4 or lower in 2 or more attempts — worth deliberate practice.</p>
          <ul className="weakness-list">
            {weaknesses.map((w) => (
              <li key={w.dimension} className="weakness-item">
                <strong>{label(w.dimension)}</strong>
                <span className="muted"> — low in {w.lowScoreCount} attempts</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {attempts.length === 0 ? (
        <p className="muted">No submitted attempts yet.</p>
      ) : (
        <ul className="history-list">
          {attempts.map((a) => (
            <li key={a.attemptId} className="card">
              <div className="history-item-header">
                <div>
                  <strong>{problems?.find((p) => p.id === a.problemId)?.title ?? a.problemId}</strong>
                  <p className="muted">{formatDate(a.submittedAt)}</p>
                </div>
                <Link to={`/attempts/${a.attemptId}`} className="btn">
                  View result
                </Link>
              </div>
              <div className="delta-grid">
                {a.deltas.map((d) => (
                  <DeltaBadge key={d.dimension} delta={d} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: DimensionDelta }) {
  const direction = delta.delta === null ? 'none' : delta.delta > 0 ? 'up' : delta.delta < 0 ? 'down' : 'flat';
  const symbol = { up: '▲', down: '▼', flat: '●', none: '—' }[direction];
  const text =
    delta.currentScore === null
      ? 'not scored'
      : delta.delta === null
        ? `${delta.currentScore}/4`
        : `${delta.currentScore}/4 (${delta.delta > 0 ? '+' : ''}${delta.delta})`;

  return (
    <div className={`delta-badge delta-${direction}`}>
      <span className="delta-label">{label(delta.dimension)}</span>
      <span className="delta-value">
        {symbol} {text}
      </span>
    </div>
  );
}
