CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  requirements TEXT NOT NULL,
  scope_boundary TEXT NOT NULL,
  rubric_weights_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  problem_id TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  submission_raw_content TEXT,
  submission_format TEXT,
  submission_document_json TEXT,
  submission_content_hash TEXT,
  submission_submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  evaluator_id TEXT NOT NULL,
  rubric_version TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  failure_reason TEXT,
  feedback_json TEXT
);
