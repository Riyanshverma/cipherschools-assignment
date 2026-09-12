# LLD Practice Platform

A 2-day take-home prototype: a learner picks an LLD problem, works in a structured
Markdown template, submits, and gets per-criterion feedback from two evaluators (a real
AI evaluator and a real rule-based evaluator) running side by side, with a history view
that tracks per-dimension improvement across attempts.

Full design rationale (15 decisions, with alternatives considered and rejected) lives in
[`DECISIONS.md`](DECISIONS.md). A concise write-up of the MVP, classes, evaluation
approach, and trade-offs lives in [`docs/design-note.md`](docs/design-note.md). Research
behind the product direction lives in [`docs/research-note.md`](docs/research-note.md).

## How to run

Requires Node.js and npm.

```bash
# from the repo root
npm install --workspace backend
npm install --workspace frontend
```

Copy `backend/.env.example` to `backend/.env` and fill in `OPENAI_API_KEY` (the primary
provider — see `DECISIONS.md` §15 for why TensorMux was probed and rejected). Everything
else in `.env.example` has a sane default.

```bash
# terminal 1 — backend (Express API + SQLite, seeds 5 problems + a demo learner on first run)
npm run dev --workspace backend

# terminal 2 — frontend (Vite dev server)
npm run dev --workspace frontend
```

Open the frontend's printed URL (typically `http://localhost:5173`). The backend listens
on `http://localhost:3000` by default; the frontend's `VITE_API_BASE` env var can override
this if you're not running both on their default ports.

## How to run tests

```bash
npm run test --workspace backend
```

63 tests across unit (domain, adapters) and integration (SQLite repositories, the full
HTTP practice loop) layers. No test ever calls a live LLM — a deterministic fake evaluator
stands in wherever a test needs to exercise the `Evaluator` port without touching the
network.

## Key decisions (see `DECISIONS.md` for full reasoning)

- Domain reads like real OOP that happens to compile with `tsc`: plain classes, private
  fields, explicit ports (`Evaluator`, `FormatAdapter`, `Repository`, `LlmClient`) — no
  ORM, no anemic objects.
- Evaluation is a lifecycle (`start` / report-back via `record`), not a synchronous call
  — the same contract that lets an AI evaluator, a rule-based evaluator, and a future
  human reviewer all sit behind one port with no branching in the practice flow.
- Two evaluators run permanently, in parallel, on every submission (not a fallback
  chain): a real AI evaluator (OpenAI `gpt-5-nano`) scoring all 8 rubric dimensions with
  evidence citations, and a real rule-based evaluator scoring the 3 dimensions that are
  genuinely checkable deterministically and explicitly abstaining on the rest.
- A submission is a format-neutral parsed `DesignDocument`; the Markdown parser is the
  only place that knows what Markdown is. Requirement completeness (missing/empty
  sections) is a domain check on that parsed shape, not a parser concern.

## Limitations (stated deliberately)

- **No authentication** — identity is a declared handle, persisted client-side. Not a
  secure session; the assignment doesn't evaluate authentication, and history only needs
  a stable identity, not a verified one.
- **In-process background evaluation, not a message broker** — evaluators run as
  fire-and-forget async work inside the API process, with a startup sweep recovering
  evaluations stranded mid-run by a crash. The first component worth extracting if this
  needed to scale is the evaluation worker itself (see `docs/design-note.md`'s HLD line)
  — it's the only part with a different resource profile and failure mode than the rest
  of the monolith.
- **The rule-based evaluator scores only 3 of 8 rubric dimensions** and abstains,
  visibly, on the rest — by design, not as a lesser stand-in for the AI evaluator. An
  evaluation with any abstained dimension never shows a total score, so a partial result
  is never presented as complete.
- **History deltas compare only to the immediately preceding attempt on the same
  problem**, not a smoothed multi-attempt trend — a scope decision for a 2-day prototype.

## AI usage

See [`AI_USAGE.md`](AI_USAGE.md) for 3–5 meaningful AI-assisted decisions made during this
build — what was suggested, what was accepted or rejected, and why.
