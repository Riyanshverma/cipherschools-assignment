# AI Usage

This project was built with Claude Code end to end — design, implementation, review, and
these write-ups. Below are five decisions where AI's suggestion was weighed against
alternatives and either accepted or rejected, with the reasoning that made the call.

## 1. Primary LLM provider — accepted, on evidence, not preference

Two candidate providers were available: TensorMux (a proxy in front of GLM-4.7-Flash) and
stock OpenAI (`gpt-5-nano`). Rather than picking one on paper, the AI ran a live provider
probe against both endpoints with the actual 8-criterion strict JSON-schema payload this
project needs, before writing any evaluator code. The probe found TensorMux returned a
`504` timeout after ~121s on the realistic strict-schema payload, and — when it did
respond to a simpler payload — did not reliably enforce strict-mode validation at all. It
also found `gpt-5-nano` (a reasoning model) required `max_completion_tokens` instead of
`max_tokens`, rejected any custom `temperature`, and silently burned its entire token
budget on hidden reasoning tokens unless `reasoning_effort: "minimal"` was explicitly set
— none of which were assumptions I could have made from documentation alone. **Accepted**
the AI's recommendation to make OpenAI the sole configured provider, specifically because
the reasoning was empirical (measured timeouts and error codes) rather than a coin flip
between two plausible-looking options.

## 2. Evaluator contract as a lifecycle, not a synchronous call — accepted

Faced with the assignment's Change Test B ("add another evaluator without rewriting the
practice flow"), the AI proposed `Evaluator.start(...)` returning nothing, with results
re-entering through a single `EvaluationRecorder.record(...)` path, rather than a simple
`evaluate(document) → result` function. The alternative (synchronous evaluate, or a
synchronous contract with an async escape hatch bolted on for slow evaluators) was
considered and **rejected**: neither has an honest implementation for a human reviewer,
who might complete a review hours later or never. The chosen contract costs nothing extra
for the two evaluators actually built (the rule-based one just calls `record()`
microseconds after `start()`) and makes a human-review adapter a real, unforced
possibility rather than a hand-wave in a design note.

## 3. A production bug the AI wrote, then a review pass caught and fixed

While building the AI evaluator's retry policy, the AI's first implementation wrapped the
LLM call, the response-schema validation, *and* the success-path `recorder.record()` call
inside one shared `try/catch`. A dedicated review pass (a second AI-driven pass, reading
the code fresh rather than trusting the first pass's own self-review) caught that this
was wrong: if `recorder.record()` itself threw — a realistic case, since it does
persistence lookups — the retry loop would misclassify a persistence failure as a
malformed AI response, burn a wasted retry against a real paid API call, and risk calling
`record()` a second time for the same evaluation on the next attempt. **Rejected** the
original structure; the fix moved the success-path `record()` call outside the try/catch
entirely, mirroring the already-correct failure-path call. This is included here
deliberately: it's evidence that a first AI-generated pass is not self-certifying, and
that a structured review step (not just "did it compile and pass its own tests") is what
actually caught a real correctness bug.

## 4. Seed-data mismatch — rejected the AI's first fix, took the cleaner one

The seed script (written early, before the real AI evaluator existed) constructed demo
evaluation rows with `evaluatorId: 'fake'` as a placeholder. Once the History feature
needed to identify "the AI evaluator's score" specifically, the AI's first fix was a
heuristic in the History computation itself: treat any evaluation that *isn't*
rule-based as "the AI one." This technically worked — in real production `evaluatorId` is
only ever `'ai'` or `'rule-based'`, so the fallback branch would be dead code outside the
seed-data case — but it permanently baked an untested workaround into the one file whose
entire job was implementing a specific, narrow rule ("only the AI evaluator's scores
participate"). **Rejected** in favor of fixing the actual mismatch at its source: the
seed script now constructs its demo data with `evaluatorId: 'ai'`, and the History
computation uses the exact, literal check the design calls for. Same outcome for the
demo, a materially cleaner and more honest piece of production logic.

## 5. A deliberate deviation from the assignment guide's suggested feedback shape

The candidate guide suggests a feedback shape of
`criterion → score → evidence → concern → suggestion → confidence`. During design, the AI
proposed adding a `whyItMatters` field between `concern` and `suggestion` — not asked for
by the guide. The reasoning offered: "move pricing out of `ParkingLot`" is an instruction
a learner can follow once and forget; "adding a pricing rule would force you to modify
`ParkingLot`" is the part of the lesson that transfers to the *next* problem, which is the
actual goal of a practice platform (as opposed to a one-shot grader). **Accepted** this
deviation deliberately, with the trade-off named explicitly in `DECISIONS.md` rather than
silently expanding the schema: it costs one more field per criterion (already a large
structured response, decision 9's stated known cost) in exchange for feedback that's
more likely to change behavior on the next attempt rather than just this one.
