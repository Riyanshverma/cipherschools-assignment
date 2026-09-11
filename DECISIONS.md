# Design Decisions — LLD Practice Platform

Running log of decisions made before implementation. Each entry records the choice,
the reasoning, and the alternatives rejected. This seeds the Design Note deliverable.

---

## 1. Submission format — structured Markdown design document

**Decision:** The learner submits a **Markdown design document** following a fixed template.
Submitted as content (paste into a pre-filled editor, or file upload).

**Why:**
- It is the authentic artifact — engineers write LLD as design docs, not as form fields.
- One encoding carries all four evidence types: prose, fenced code, and mermaid diagrams.
  Mermaid is *text*, so diagram evidence reaches the evaluator with no image pipeline —
  most of the "Combined" row of the guide's submission table at close to the cost of "Text".
- Headings give stable addresses, so feedback can cite the learner's own words at a
  specific section and line. The assignment requires feedback to point to evidence in
  the submission; Markdown makes that mechanical.
- Deterministic checks remain meaningful: required sections present, non-empty,
  substantive; diagram source parses.
- A learner practising LLD can be assumed to know Markdown. Stated as an explicit
  scoping assumption.

**Conditions attached:**
1. Markdown is the *encoding*; the **template** supplies the structure. Freeform
   Markdown would just be freeform prose with a file extension.
2. The domain accepts **content + declared format**, never a file. Upload/paste/CLI are
   transport details at the outer edge. Keeps multipart/MIME plumbing out of the domain.
3. Not called a "README". The concept is a **design document**; README is a repo
   convention and would be a naming smell in the domain.

**Rejected:** freeform text (nothing deterministic to check, no anchors for evidence);
text + code execution (compilation is a time sink); rendered diagram upload (UI-heavy,
and the guide penalises UI-heavy/logic-light).

---

## 2. Submission structure — six required sections + optional diagram

**Decision:** Required, all non-empty:
1. Requirements & Assumptions
2. Classes & Responsibilities
3. Relationships & Interactions
4. Key Behaviour & Rules (important methods, state transitions, what is enforced)
5. Edge Cases & Testability
6. Trade-offs & Extensibility

Optional: **Diagram** (mermaid). Present = extra evidence; absent = never penalised.

**Why:**
- Answers the assignment's first design question — *what must a learner provide for an
  attempt to be meaningful?*
- Sections are **not 1:1 with rubric dimensions.** Coupling/cohesion,
  encapsulation/interfaces and abstraction/patterns are *inferred from* sections 2–4;
  explanation quality is judged across the whole document. Self-reported quality is
  worthless — you never ask a learner to rate their own coupling.
- Keeps **behaviour** (§4), where LLD actually lives, and **edge cases** (§5), where
  learners are weakest.
- The template teaches the expected shape by construction, addressing the researched gap
  that learners don't know whether UML, code, or clean architecture is wanted.

**Rejected:** 4 minimal sections (drops behaviour); 8 sections mapped 1:1 to rubric
dimensions (degenerates into form-filling and invites self-assessment).

---

## 3. Domain model — Attempt (root) · Submission (value) · Evaluation (entity)

**Decision:**
- **`Attempt`** — entity, aggregate root. Belongs to learner + problem. Owns the practice
  lifecycle. Created on "start", holds the work, transitions on submit.
- **`Submission`** — **immutable value object**, not an entity. The frozen design document
  at submit time: raw content, declared format, timestamp, content hash. No identity,
  no lifecycle.
- **`Evaluation`** — entity with its **own** lifecycle. Bound to the submission it judged,
  tagged with which evaluator produced it.
- **"Try again"** creates a new `Attempt`. History = ordered attempts per (learner, problem).

**Why:**
- Dissolves the 1:1 Attempt/Submission smell with a precise answer to "do I need this
  abstraction?" — *Submission doesn't need identity; it needs to be immutable evidence.*
  Three concepts, three distinct responsibilities, each stateable in one line.
- The assignment says a learner "can **start** an attempt and work on a solution", so an
  attempt begins before submission — it is not merely a wrapper around one.

**`Evaluation` is first-class — this is how Change Test B is passed.**
The shortcut (`Attempt.feedback` as a result field) dies the moment a human reviewer is
added: a human verdict arrives hours later, may never arrive, and sits *alongside* the
AI's rather than replacing it. With Evaluation as its own record:
- rule-based evaluator = a second row; human review = a third row completing on its own schedule
- practice flow untouched in both cases
- the attempt's displayed status is **derived**, never stored twice
- single-vs-composite stops being a question: N evaluations per submission, N = 1 today

Cost today is one extra collection and an evaluator identifier. One evaluator is
implemented; the shape is already correct.

**Rejected:** Attempt → many Submission entities (creates two competing retry semantics);
dropping Attempt entirely (discards a concept the assignment names).

---

## 4. Change Test A seam — format adapter → format-neutral DesignDocument

**Decision:** A **format adapter** converts raw submitted content into a `DesignDocument`:
an ordered set of **addressed sections** (canonical key → text + line offsets), plus
extracted code blocks and an optional **diagram source** slot. Nothing downstream knows
what Markdown is.

**Change Test A answer:** register one adapter. **Domain model changes: zero.**
- Today: Markdown adapter.
- Later: a diagram-file adapter that transcribes into the same shape; a code-repo adapter
  that extracts into it. The diagram slot is filled by mermaid text today and by a
  transcribed image/drawio later — same slot.

**Sub-decisions:**
1. **Store the parsed document** alongside raw content. Raw stays canonical (immutable
   evidence, what the learner sees). Re-parsing on demand would let a future parser change
   silently drift a past evaluation's citations. What was judged must be immutable too.
2. **Validation splits in two:** *format validity* ("is this parseable?") is the
   **adapter's** job; *requirement completeness* ("all six sections present and
   substantive?") is the **domain's** job, on the parsed document — therefore already
   format-agnostic. One line: **the adapter knows the format; the domain knows the
   requirements.**
3. **Tolerant heading matching lives in the adapter** — case, punctuation, aliases,
   ordering. The domain only sees canonical section keys. Source of several required
   failure/edge tests: renamed, missing, empty section; unparseable diagram.

**Rejected:** raw text everywhere (leaks Markdown into validator, prompt builder and
citation logic); per-evaluator parsing (duplicates format knowledge *and* entangles the
two change tests — adding a format would force touching every evaluator).

**Deferred:** whether the required-section schema is global or per-problem (→ decision 8).
Either way it is **data, not hardcoded**.

---

## 5. Change Test B seam — evaluator contract is start / report-back

**Decision:** Evaluation is a **lifecycle, not a call**.
- `Evaluator.start(evaluationId, document, rubric, problemContext)` → returns nothing
- results re-enter through a single inbound path: `record(evaluationId, outcome)`

| Evaluator | `start` does | `record` happens |
|---|---|---|
| AI | fires the model call | when the response validates |
| Rule-based | computes immediately | microseconds later, same path |
| Human | creates a review task in an inbox | hours later, when a person submits it |

**Why this is not speculative:** the guide already requires that slow AI evaluation must
not block the submission request — so asynchrony is needed for the evaluator actually
being built. Given that, start/report-back costs almost nothing extra and human review
falls out for free. A justified abstraction, not a hypothetical one.

**Sub-decisions:**
1. **Fan-out at the orchestrator; the Composite pattern is explicitly rejected.** Merging
   results destroys per-evaluator attribution — you could no longer say "the AI flagged
   this, the human disagreed", which is the whole point of a human reviewer. The
   orchestrator creates N evaluation records; each completes independently.
2. **The evaluator reports an outcome; the domain owns state transitions.** The evaluator
   says "completed with this result" or "failed for this reason" and never moves the state
   machine. Follows the assignment's own split (state transitions are deterministic) and
   guarantees a misbehaving LLM cannot corrupt the lifecycle. Retry policy sits with the
   orchestrator.
3. **The rubric is passed in, not baked in.** The evaluator is rubric-agnostic mechanism;
   changing the rubric touches zero evaluator code.
4. **`problemContext` is part of the contract, deliberately.** The evaluator receives the
   problem's requirements *and its scope boundary*, so the model judges the design against
   the problem as posed. Without it the LLM tells every learner to add an event bus and a
   plugin layer, and feedback becomes actively harmful. Research-driven: AI is known to
   overcomplicate LLD prompts beyond the intended problem size.

`Evaluator` is a **port the domain owns**; AI / rule-based / human are adapters behind it.

**Rejected:** synchronous `evaluate(document) → result` (no honest implementation exists
for a human reviewer; answering Change Test B with "we'd refactor" is the failing answer);
sync contract plus async escape hatch (two contracts force the practice flow to branch on
evaluator type — exactly the rewrite the change test checks for).

---

## 6. Evaluation lifecycle — two state machines, derived display status

**Decision:** State lives in two small, separate machines.
- **`Attempt`:** `Draft → Submitted` (terminal)
- **`Evaluation`:** `Pending → Running → Completed | Failed`
- **Learner-facing status is derived** from the attempt plus its evaluations — never stored twice.

The guide's suggested chain `Submitted → Evaluating → Completed/Failed` mixes two concerns:
`Submitted` is a fact about the *attempt*; the rest are facts about an *evaluation*. With one
evaluator the derived status reproduces that chain exactly; with two, "AI complete, human
pending" is expressible with no schema change.

**Execution mechanics:**
1. **Submit ordering (guide requirement):** validate → **persist attempt + submission** →
   create `Evaluation(Pending)` → hand to executor → **return immediately**. Evidence is
   durable before any evaluator runs, so an evaluator crash cannot lose the learner's work.
2. **In-process background execution + polled status.** No broker, no infra; satisfies
   "do not block the main submission request". Rejected: synchronous in-request (blocks
   10–30s, bad demo); a real queue (the assignment warns against a distributed-systems project).
   → Yields the HLD answer owed by guide §10: *the first component to extract is the
   evaluation worker — the only part with a different resource profile and failure mode.*
3. **Crash recovery:** on startup, sweep evaluations stranded in `Running` →
   `Failed("interrupted")`. The honest cost of in-process execution, handled in a few lines.
4. **Timeout:** an evaluator that never reports back transitions to `Failed`.
5. **Retry after failure creates a *new* `Evaluation`** against the same submission rather
   than resetting the old one. Failed evaluations stay visible; audit trail preserved;
   consistent with Evaluation being an entity.

**Rejected:** a single state machine on `Attempt` — breaks with two evaluators (if the AI
finished and the human has not, whose status is the attempt in?), forcing exactly the
practice-flow rewrite Change Test B forbids.

---

## 7. Idempotency — the attempt *is* the key

**Decision:** Because attempts are created at "start", before submission, the client already
holds an `attemptId` when it submits. **No separate idempotency key is needed.**
`Draft → Submitted` is a one-way terminal transition, so *"one attempt has at most one
submission"* is an aggregate invariant enforced in the domain.

The `Draft` state from decision 6 pays for itself here — idempotency falls out of it.

**The three-case rule:**

| Situation | Behaviour |
|---|---|
| Attempt in `Draft` | Submit. Create submission + evaluation. |
| Already `Submitted`, **identical** content hash | **Idempotent replay** — return existing attempt + evaluation status. Not an error. |
| Already `Submitted`, **different** content | **Reject:** "this attempt is already submitted — start a new attempt." A real conflict. |

**Content hash still earns its place** — not as the dedupe key, but to bind each evaluation to
exactly the bytes it judged, to distinguish replay from conflict above, and to cheaply power
an "unchanged since attempt #N" signal.

**Retry-after-failed-evaluation is unaffected:** it creates a new `Evaluation` and never
touches attempt state. The two mechanisms guard different things and cannot collide.

**Rejected:** client-supplied idempotency keys (infrastructure, not domain; the assignment
frames duplicate handling as deterministic domain logic); content hash as dedupe key
(wrongly blocks deliberate retries, ambiguous across attempts).

---

## 8. Rubric — global dimensions, per-problem weights and scope

**Decision:** One shared set of the guide's eight dimensions (requirement understanding ·
class responsibilities · coupling/cohesion · encapsulation & interfaces ·
abstraction/patterns · extensibility · edge cases & testability · explanation quality),
plus a **per-problem weight map** and **per-problem expectations + scope boundary**.

**Why:** the dimensions are properties of good LLD, not of parking lots — they are universal.
What varies is what matters most per problem (Vending Machine → state handling; Parking Lot →
allocation policy and extensibility; Elevator → scheduling and edge cases). Authoring cost is
a handful of numbers per problem.

This also gives `problemContext` (decision 5) a home: the scope boundary that stops the LLM
from telling every learner to add an event bus is **data a problem author sets**, not a string
buried in a prompt.

**Sub-decisions:**
1. **Scale 0–4 with named, described anchors** (`0 Missing · 1 Weak · 2 Adequate · 3 Strong ·
   4 Exemplary`), each defined in rubric text. Not 0–10 — LLMs are noisy at that granularity
   and it is false precision. Giving the model a definition rather than a vibe is the single
   biggest lever on consistency, which is guide §7's goal.
2. **The domain computes the total; the LLM never does.** The model returns per-criterion
   judgements only. Inverts the assignment's named anti-pattern.
3. **`Rubric` is first-class with behaviour** — owns dimensions, anchors, weights, and
   `aggregate(criterionScores) → Score`. A responsibility, not a config bag.
4. **Rubric version stored on each `Evaluation`.** One field; without it, history comparisons
   across a rubric change silently lie.
5. **A total exists but is derived and secondary.** A deterministically-derived weighted score
   is not the anti-pattern; an LLM-invented one is. The number tracks progress; the
   per-criterion feedback does the teaching and stays primary in the UI.

**Consequence:** shared dimensions make recurring-weakness detection across attempts free —
it is just grouping criterion scores by dimension (→ decision 11).

**Rejected:** uniform global weights (claims a Vending Machine and a Parking Lot deserve
identical priorities); fully per-problem rubrics with differing dimensions (authoring-heavy,
and makes cross-problem history meaningless).

---

## 9. Feedback contract — verifiable citations, domain-owned prioritisation

**Decision — per-criterion shape:**

| Field | Notes |
|---|---|
| `criterion` | dimension key |
| `score` | 0–4, anchored |
| `evidence[]` | **structured citations**, not prose |
| `strength` | what this criterion got right |
| `concern` | nullable |
| `whyItMatters` | required when `concern` present |
| `suggestion` | required when `concern` present |
| `confidence` | model's own certainty |

**Two deviations from the guide's suggested shape, both justified:**
1. **`whyItMatters`.** "Move pricing out of `ParkingLot`" is an instruction; "adding a pricing
   rule would force you to modify `ParkingLot`" is a lesson. The rationale is the part that
   transfers to the next problem — the product thesis. The fields answer the learner's four
   questions exactly: *what did I do* (evidence) → *what's wrong* (concern) → *why it matters*
   → *what now* (suggestion).
2. **`strength`, with concern/whyItMatters/suggestion nullable as a group.** Purely critical
   feedback does not get used, and a 4-scoring criterion has nothing to complain about.
   Nullable-as-a-group is enforced deterministically: concern present ⇒ the other two must be.

**Evidence is a verifiable citation** — `{ sectionKey, quote, lineRange }` pointing into the
parsed `DesignDocument` from decision 4. **The domain deterministically verifies each quote
actually appears in the submitted document.** Fabricated quotes are caught. This is a
deterministic check *on an AI output*, and the most direct possible enforcement of the
requirement that feedback point to evidence in the candidate's solution.
On verification failure: **drop the citation and down-rank that criterion's confidence** — do
not fail the whole evaluation. A hallucinated quote should not destroy seven good criteria.

**Evaluation-level fields:** `summary` (from the model) and **`topPriorities` (2–3), computed
by the domain** by lowest weighted contribution. Eight criteria is too many to act on, and the
goal is improving the *next* attempt. Prioritisation is arithmetic, so the LLM does not do it.

**Ownership, in one line:**
> **LLM owns per-criterion judgement. Domain owns the aggregate, the prioritisation, and the verification.**

**`Feedback` is an immutable value object held by `Evaluation`.** `Evaluation` is the process
record (state, evaluator, rubric version, timings, failure reason); `Feedback` is the immutable
result payload. Mirrors `Submission` inside `Attempt` exactly — entity owns lifecycle, value
object holds immutable content. Feedback does not need identity; it needs to be immutable.

**Known cost:** eight criteria × eight fields is a large structured response — slower, more
chances of malformed output. Mitigated by schema validation and the decision 6 failure path.

---

## 10. LLM failure policy — a real second evaluator, not a fallback branch

**Decision:** Build a **real rule-based evaluator** (not a stub) as a registered evaluator
behind the same `start` / `record` contract from decision 5, **always running alongside the AI
evaluator — N = 2 permanently.** No fallback branch, no conditional, no "offline mode".

> Resilience emerges from the evaluator model rather than from a special fallback mechanism.

If the AI evaluation fails, the learner still receives the rule-based evaluation — because it
was already running, not because a recovery path fired.

**Why this over a fallback:** a fallback is a branch that exists only for a failure, is hard to
test, and proves nothing about the design. A second permanently-registered evaluator is the
**live demonstration of Change Test B** — it converts *"my design would accommodate another
evaluator"* into *"here it is, running."*

**Scope — roughly one hour.** It scores **3** of the eight dimensions and **explicitly abstains
on 5**:

| Dimension | Rule-based |
|---|---|
| Requirement understanding | scored (coverage of stated requirements in §1) |
| Edge cases & testability | scored (presence/among §5 content, specificity) |
| Quality of explanation | scored (structure, depth, reasoning markers) |
| Class responsibilities | **abstains** |
| Coupling / cohesion | **abstains** |
| Encapsulation & interfaces | **abstains** |
| Abstraction / patterns | **abstains** |
| Extensibility | **abstains** |

**The abstention is the feature.** Abstaining with confidence = none / "not rule-assessable"
answers the assignment's question *which parts of evaluation should be deterministic and which
benefit from an LLM* by demonstration rather than by assertion — and gives the `confidence`
field a visible purpose.

**Display:** the AI evaluation is the **headline**; rule-based appears as a secondary
"automated checks" panel. **Never merged** — this is the per-evaluator attribution protected by
rejecting Composite in decision 5.

**No-API-key handling: not built.** The reviewer will be given a working key at submission. A
no-key detection branch, config-driven mode switching, an offline banner, and offline-mode
documentation are all **cut**. Shipping a key removes only one of four failure modes (rate
limits, quota exhaustion, key expiry by review day, provider outage all remain), and those are
covered by the above without any special-casing.

**Reliability policy around the AI evaluator:**
- **Strict schema validation** — invalid output is never partially applied.
- **2 retries** on schema-validation failures and transient errors only, short backoff.
- **Timeout covers the whole evaluation**, not each attempt.
- **Low temperature** for consistency (guide §7's goal).
- **Failure reasons are stored and shown**, not swallowed.
- **A separate deterministic fake evaluator exists for tests.** Tests never touch the network;
  the fake forces `Failed`, timeout and malformed-output paths on demand.

**Risk note:** this is the **single most cuttable item** in the plan. If time runs short, the
rule-based evaluator is what gets dropped — the seam and the write-up survive without it.

---

## 11. History semantics — deltas and recurring weakness, not a list of scores

**Decision:** The history view provides three things:
1. the learner's attempts on a problem, ordered;
2. **per-dimension delta vs. that learner's previous attempt on the same problem**;
3. a **recurring-weakness signal across all attempts and all problems** — dimensions
   persistently scoring low.

**Why:** the assignment states history must exist so the product *"supports improvement, not
just one-time solving."* A list of past attempts satisfies the letter of that; deltas and
recurring weaknesses satisfy the intent. The researched gap in existing tools is precisely that
they score an attempt and never close the loop across attempts.

**Why it is nearly free:** decision 8 gave every problem the **same eight dimensions**. Deltas
and recurrence are then pure grouping and arithmetic over stored criterion scores —
**domain-computed, zero LLM involvement.** Rubric version (decision 8, sub-decision 4) keeps
comparisons honest across a rubric change.

This is the clearest available shot at the 15% product-thinking weight, at very low cost.

**Rejected:** a bare attempt list (meets the requirement, demonstrates no product thinking);
LLM-generated cross-attempt narrative (unverifiable, slow, and re-introduces the "unconstrained
question" anti-pattern).

---

## 12. Identity — declared handle, no auth

**Decision:** Name/handle-based session. The learner types a handle; the system gets or creates
a `Learner` (id + display name only) and persists it client-side. No passwords, no tokens,
no sessions table. ~15 minutes of work.

**Why:** authentication is not an evaluated dimension anywhere in the assignment, and history
(decision 11) only needs a stable learner identity, not a secure one. Spending time here buys
zero marks and costs marks elsewhere.

**README limitation to state plainly:**
> There is no authentication. Identity is a declared handle. The seam is an identity provider
> at the edge; no domain code assumes otherwise.

Stating the limitation deliberately is itself evidence of engineering judgement (10% weight);
silently omitting auth is not.

**Rejected:** real auth (time sink, unscored); hardcoded single learner (kills the multi-learner
framing of history for no saving).

---

## 13. Interface surface — HTTP API + deliberately plain web UI

**Decision:** An HTTP API with a thin web UI of exactly **four screens**:

| # | Screen | Contents |
|---|---|---|
| 1 | Problem list | 3–5 problems |
| 2 | Problem detail | requirements + editor **pre-filled with the six-section template** |
| 3 | Result | polls status, then per-criterion feedback with evidence citations, top priorities, secondary automated-checks panel |
| 4 | History | attempts, per-dimension deltas, recurring weakness |

**The defusing framing, stated in the README and design note:**
> **The UI is a thin client over the API. It contains zero business rules.**

Every rule — validation, state transitions, aggregation, prioritisation, citation verification —
lives in the domain and is exercised by tests **through the API**, never through the UI. This is
the direct answer to the named anti-pattern *"lots of UI with weak practice logic."*

**Explicitly excluded:** component library, design system, animations, responsive polish.

**Seeded demo learner** with 2–3 prior attempts (~15 min). History, deltas and recurring-weakness
detection are the differentiating features; without seed data the reviewer would have to complete
three manual attempts to see them exist. With it, they are visible in the first thirty seconds.

**Design-phase note:** the user has a `ui-ux-pro-max` skill intended for the UI implementation
phase. *Not currently installed on this machine* (absent from `~/.claude/skills/` and the plugin
cache as of 2026-09-11) — it must be enabled before it can be invoked. When used, it is bound by
this decision: **plain UI, zero business rules.** Its scope is legibility of feedback
(per-criterion cards, evidence quotes, score deltas), not visual ambition.

**Rejected:** CLI-only (fastest, but the assignment asks for a demonstrable learner journey and
a CLI undersells the feedback surface); rich SPA (directly triggers the UI-heavy penalty).

---

## 14. Test strategy — domain units + API integration, fake evaluator, no network

**Decision:** Two layers only. Target ~25–30 tests, ~2 hours.

**Framing:** Testing & reliability is 5% of the grade, so the goal is **not coverage**. It is
making the design's claims verifiable — the failure paths asserted in decisions 6, 9 and 10 are
worth more as executing tests than as prose.

**Unit — pure domain, no I/O:**
- `Rubric.aggregate()` arithmetic and anchor handling
- `Attempt` state transitions; the "at most one submission" aggregate invariant
- the three-case idempotency rule (decision 7)
- Markdown adapter → `DesignDocument`: tolerant headings, section addressing, code and
  diagram extraction
- citation verification: quote present → kept; quote absent → dropped + confidence down-ranked
- `topPriorities` selection by lowest weighted contribution
- delta and recurring-weakness computation (decision 11)

**Integration — through the real HTTP API, in-process, against a real store:**
- the full loop: start attempt → submit → poll → feedback rendered
- **submit returns immediately with the evaluation `Pending`** — guide §10's requirement
  asserted rather than claimed
- all failure paths below

**The fake evaluator is a third adapter behind the port from decision 5** (AI · rule-based ·
fake), not test scaffolding bolted on. Deterministic, instant, programmable to force `Failed`,
timeout, or malformed output. **The test suite is therefore itself the evidence for Change
Test B:** adding an evaluator required registering a class and nothing else. State this in the
design note.

**Hard rule: no test ever calls the LLM.** Non-deterministic, slow, costs money, and would fail
in CI on the reviewer's machine.

**Failure / edge cases covered (13):**

| Source | Case | Expected |
|---|---|---|
| d4 | renamed section heading | adapter matches it |
| d4 | missing required section | rejected; attempt stays `Draft` |
| d4 | empty / whitespace-only section | rejected |
| d4 | unparseable mermaid | submission accepted, diagram slot empty |
| d6 | evaluator reports failure | `Failed` + reason stored and shown |
| d6 | evaluator never reports | timeout → `Failed` |
| d6 | stale `Running` on restart | swept to `Failed("interrupted")` |
| d6 | retry after failed evaluation | **new** `Evaluation`; attempt state untouched |
| d10 | malformed output, then valid on retry | `Completed` — proves the 2 retries work |
| d10 | malformed after 2 retries | `Failed`; nothing partially applied |
| d9 | fabricated evidence quote | citation dropped, confidence down-ranked, still `Completed` |
| d7 | identical resubmit | idempotent replay; **no second evaluation created** |
| d7 | different content on submitted attempt | rejected — "start a new attempt" |

**Sub-decision — partial evaluations have no total.** The rule-based evaluator abstains on 5 of
8 dimensions (decision 10). Abstained dimensions contribute nothing and **an evaluation with
abstentions exposes no aggregate score at all** — the panel shows only its three scores. A
partial score presented as a total is a lie, and the absence reinforces that the AI evaluation
is the headline. Implemented as a guard in `Rubric.aggregate()`.

**Rejected:** domain unit tests only (nothing proves the loop runs end-to-end, and the working
prototype is a separately graded deliverable resting on the same code); full pyramid with
browser/e2e tests (tests a UI we deliberately declared free of business rules — decision 13).

---

## 15. Tech stack — TypeScript end to end

**Decision:** Chosen *last*, derived from decisions 1–14 rather than from preference (guide §1
explicitly warns against starting here).

| Layer | Choice |
|---|---|
| Language | TypeScript, end to end |
| API | **Express 5** |
| Domain | plain TS classes — no framework types, no decorators |
| Validation | **Zod** — LLM response schema *and* API request bodies |
| Persistence | **SQLite behind a `Repository` port**, hand-written mappers, **no ORM** |
| Tests | Vitest |
| UI | React + Vite, four plain screens (decision 13) |
| LLM | `openai` SDK against an OpenAI-compatible endpoint |

**Why TypeScript:**
- **Zod does double duty** — it validates the model's structured response (decision 10, the most
  failure-prone part of the build) and the API's request bodies. One schema vocabulary.
- One language across domain, API and UI, so decision 13's four screens and their polling cost
  hours rather than half a day.
- Native `async`/`await` makes decision 6's fire-and-return a few lines with no framework ceremony.

**Known weakness and its mitigation:** structural typing makes interfaces cheap, and a reviewer
could read TypeScript as weak OOP on an LLD assignment. Mitigated by writing the domain as
**real classes with private fields and explicit ports** — `interface Evaluator`,
`interface FormatAdapter`, `interface Repository`, `interface LlmClient`. No anemic objects, no
bags of exported functions. *The domain must read like Java that happens to compile with `tsc`.*

**Express over Fastify** — the user's call, on debuggability under deadline. Costs nothing here:
Fastify's main edge is schema-based serialization, which Zod already owns. **Express 5** chosen
over 4 so async errors reach the error handler without a try/catch wrapper in every
lifecycle-touching route.

**Sub-decisions:**
1. **No ORM.** Hand-written mappers between domain objects and rows. Non-negotiable: decision 3's
   `Submission` and decision 9's `Feedback` are immutable value objects, and an ORM entity is the
   opposite of that. A persistence-ignorant domain is a point to *make*, not concede. (This is
   also why Spring/JPA was rejected — JPA actively fights decision 3.)
2. **SQLite behind a `Repository` port.** File-based, zero setup, survives restart — which
   decision 6's startup sweep requires to mean anything. If native-module install friction appears
   on the reviewer's machine, a JSON-file adapter is a ~20-minute swap, and the swap would
   demonstrate the port pattern a third time.
3. **`LlmClient` is a fourth port.** Two available providers — **TensorMux**
   (`https://api.tensormux.com/v1`, model `glm-4-7-flash`, OpenAI-compatible; 50M tokens / 9 days)
   and **GPT-5 nano** (stock OpenAI) — differ only by `baseURL` + `model` + key, all env-supplied.
   Switching providers is configuration, not code. Unlike a speculative abstraction, this port has
   **two working configurations to prove it**.
4. **No provider fallback chain.** Consistent with decision 10: resilience comes from the evaluator
   model, not from recovery branches. A "try A, else B" chain would be an untested path guarding a
   failure the always-running rule-based evaluator already covers. One port, one configured provider.

**Both providers confirmed (from user-supplied console screenshots):**

| | TensorMux | OpenAI |
|---|---|---|
| Base URL | `https://api.tensormux.com/v1` | `https://api.openai.com/v1` (stock) |
| Model id | `glm-4-7-flash` | `gpt-5-nano` |
| SDK | `openai` npm, swapped `baseURL` | `openai` npm, default |
| Budget | 50M tokens / 9 days from 2026-09-11 | unknown |

**Provider probe — run 2026-09-11, against a live realistic payload (8-criterion nested schema
matching decision 9's contract exactly: `summary` + `criteria[]`, each criterion carrying
`evidence[]` of `{sectionKey, quote, lineRange{start,end}}`, `strength`, nullable
`concern`/`whyItMatters`/`suggestion`, `confidence` enum — `additionalProperties: false`
throughout, every field in `required[]`, exactly as real strict-mode schemas must be shaped).
Three rounds of calls were made directly against both `/chat/completions` endpoints (raw
`fetch`, mirroring what the `openai` SDK sends). Full transcripts are not retained beyond this
summary; the two questions below are answered from direct observation, not assumption.

**Q1 — does TensorMux honour strict `json_schema`, or silently downgrade?**
Neither. **It times out.** Two independent calls with the realistic compliant strict schema
(one 2-criterion, one full 8-criterion) both returned **`504` after ~121s** — a hard gateway
timeout, not a downgrade. A *separate* call using a deliberately non-compliant strict schema
(missing `additionalProperties: false`, an optional field outside `required[]` — a schema real
OpenAI strict mode would reject outright) returned `200` in 14s with **no validation error**,
confirming the proxy isn't running real strict-mode validation when it does respond — it is
simply inconsistent, and unusably slow on the schema shape this project actually needs. A plain
`json_object` (loose) call against the same prompt succeeded in 23s. **Verdict: TensorMux cannot
reliably return the decision 9 response shape at all.** This is worse than the anticipated
"downgrades to loose JSON" risk — it's disqualifying, not just a consistency tax.

**Q2 — does `gpt-5-nano` need `max_completion_tokens`, and does it reject custom `temperature`?**
Both confirmed:
- `max_tokens` → `400 unsupported_parameter`, error names `max_completion_tokens` as the
  replacement.
- `temperature: 0.2` → `400 unsupported_value`: *"Only the default (1) value is supported."*
  **Decision 10's low-temperature consistency lever is gone for this provider**, exactly as
  anticipated — the rubric anchors (decision 8) are now the sole consistency mechanism for
  whichever provider is chosen, since the surviving provider is this one.
- **Unplanned third finding:** with `max_completion_tokens` set but no `reasoning_effort`,
  the model spent its **entire** completion-token budget on hidden reasoning tokens — confirmed
  at both 800 and 4000 tokens (`finish_reason: "length"`, `reasoning_tokens` == the full budget,
  zero visible content both times). Setting **`reasoning_effort: "minimal"`** fixed this
  completely: the full 8-criterion strict-schema response came back valid, `finish_reason:
  "stop"`, `reasoning_tokens: 0`, in 7.5s. `reasoning_effort: "low"` also worked (384 reasoning
  tokens, 9.7s) but spent tokens for no measurable quality gain in this probe. **`minimal` is
  the correct default** for the evaluator prompt; it is a required request parameter alongside
  `max_completion_tokens`, not an optional tuning knob.

**Decision: OpenAI (`gpt-5-nano`) is the primary and only configured provider.** TensorMux is
not wired in — decision 15 sub-decision 4 already rejects a provider fallback chain, so there is
no seam that would use it even if it worked. `LlmClient` still reads `baseUrl`/`model`/`apiKey`
from env per decision 15 sub-decision 3, so this is a configuration fact, not an architecture
change: the port still has two theoretically-interchangeable configurations, one of which
happens to fail its own probe.

**Required request shape for the AI evaluator (binding on the implementation):**
```
max_completion_tokens: ~2000        // not max_tokens
reasoning_effort: "minimal"         // required — omitting it burns the entire budget on reasoning
// no temperature field — omit entirely, default (1) is the only accepted value
response_format: { type: "json_schema", json_schema: { strict: true, schema, name } }
```

**Latency and token measurements (sets decision 6's timeout):** one full 8-criterion evaluation
against a realistic ~1300-character design document completed in **7.5s** end-to-end
(`reasoning_effort: "minimal"`), using **1,768 total tokens** (633 prompt + 1,135 completion, 0
wasted on reasoning). `LLM_TIMEOUT_MS=60000` (already in `.env.example`) comfortably covers this
plus decision 10's 2 retries with room to spare, and is left unchanged.

**Rejected:** Python + FastAPI/Pydantic (Pydantic is the best tool in existence for the schema
problem, but costs a second language at the UI boundary and needs care around in-process
background work); Java + Spring Boot (most native-looking for an LLD submission and closest to the
reviewer's likely mental model, but the highest-risk path in the hours available, and JPA
undermines decision 3).

**Production wiring verification — Phase 5, Task 15, run 2026-09-12.** With `AiEvaluator` and
`RuleBasedEvaluator` registered as the permanent evaluator pair in `server.ts` (real SQLite,
real `OpenAI` client, no fakes), a design-document submission was evaluated end to end against
the real live API through the actual HTTP routes (not a unit test): the AI evaluation reached
`Completed` with a real `aggregateScore` of `{"total":25,"maxPossible":40}`, and the rule-based
evaluation reached `Completed` in the same run with correct partial scoring (3 of 8 dimensions
scored, 5 correctly abstained). This confirms the required request shape above is reachable
end-to-end through the real production wiring path, not only provable in Task 13's isolated,
fully-mocked unit test.

---

## All 15 decisions locked.

Next: design document, presented in sections for approval, then written to
`docs/superpowers/specs/`. No code until that is signed off.
