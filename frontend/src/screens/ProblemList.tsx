import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createLearner, listProblems, type Problem } from '../api/client';

const LEARNER_ID_KEY = 'lld.learnerId';

function summarize(requirements: string, max = 140): string {
  const oneLine = requirements.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max).trimEnd()}…` : oneLine;
}

export function ProblemList() {
  const [learnerId, setLearnerId] = useState<string | null>(() => localStorage.getItem(LEARNER_ID_KEY));
  const [handle, setHandle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!learnerId) return;
    listProblems()
      .then(setProblems)
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, [learnerId]);

  async function handleCreateLearner(e: FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const learner = await createLearner(handle.trim());
      localStorage.setItem(LEARNER_ID_KEY, learner.id);
      setLearnerId(learner.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  if (!learnerId) {
    return (
      <div className="screen">
        <h1>LLD Practice Platform</h1>
        <p className="muted">Enter a handle to get started. It's stored locally and used to track your attempts.</p>
        <form onSubmit={handleCreateLearner} className="row">
          <input
            className="input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="your handle"
            disabled={creating}
            autoFocus
          />
          <button className="btn" type="submit" disabled={creating || !handle.trim()}>
            {creating ? 'Creating…' : 'Continue'}
          </button>
        </form>
        {createError && <p className="error">{createError}</p>}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="screen">
        <h1>Problems</h1>
        <p className="error">Failed to load problems: {loadError}</p>
      </div>
    );
  }

  if (!problems) {
    return (
      <div className="screen">
        <h1>Problems</h1>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>Problems</h1>
      <ul className="problem-list">
        {problems.map((p) => (
          <li key={p.id} className="card">
            <Link to={`/problems/${p.id}`} className="problem-link">
              <h2>{p.title}</h2>
              <p className="muted">{summarize(p.requirements)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
