# LLD Practice Platform — Assignment Understanding & Research Context

> **Prepared by ChatGPT for Claude**
>
> This README contains the understanding, explanations, examples, research references, and conclusions discussed before implementation.
>
> **Purpose:** Keep ChatGPT/Claude aligned on what the assignment means, what it expects, what is in scope, what is not, and what the important product/LLD questions are.
>
> **Important:** This document is a context/reference document. It is **not an implementation plan** and does not choose the technology stack.

---

# 1. Assignment Overview

The assignment is:

**LLD Practice Platform — 2-Day Engineering Assignment**

The core task is to:

> Research the problem briefly, define a focused MVP, and build a working prototype of an LLD practice platform.

The platform should help a learner:

```text
Choose problem
      ↓
Think / Design
      ↓
Submit
      ↓
Get Feedback
      ↓
Review
      ↓
Try Again
```

The assignment is primarily focused on the **learner journey**, rather than building an LMS or a large assessment system.

---

# 2. Actual Problem Being Solved

LLD practice is relatively easy to start but difficult to evaluate.

A learner can design something such as:

- Parking Lot
- Elevator
- Vending Machine
- or another LLD problem

and still be unsure whether:

- responsibilities are correct
- abstractions are appropriate
- relationships make sense
- the design is extensible
- the trade-offs are good

The product is therefore intended to help learners:

```text
Practice LLD
     ↓
Submit their own design
     ↓
Receive useful/explainable feedback
     ↓
Understand weaknesses
     ↓
Improve
     ↓
Try again
```

---

# 3. What the MVP Should Demonstrate

The assignment expects the MVP to demonstrate:

| Area | Expected outcome |
|---|---|
| Problem | A small set of LLD problems with clear requirements and enough context to attempt them |
| Practice | A learner can start an attempt and work on a solution using a chosen format |
| Submission | The learner can submit a solution and see its status |
| Feedback | The platform provides useful feedback on the design |
| History | The learner can see previous attempts |
| Core design | Important domain behaviour is represented with clear classes/interfaces and responsibilities |

Possible submission formats include:

- Text
- Code
- Diagram
- Combination

The assignment does **not** require supporting every format.

---

# 4. Section 4 — Main Design Questions

Section 4 is **not a list of additional features to implement**.

These questions are intended to guide the research, product decisions, and design of the prototype.

---

## 4.1 What does a learner actually need to provide for an LLD practice attempt to be meaningful?

### Meaning

If the learner is given:

> Design a Parking Lot.

What does the learner need to submit so the platform has enough evidence to evaluate the design?

Simply submitting:

```text
ParkingLot
Vehicle
Spot
Ticket
```

may not provide enough information.

A meaningful submission could contain:

```text
Requirements / Assumptions
        ↓
Classes
        ↓
Responsibilities
        ↓
Relationships
        ↓
Important methods
        ↓
Core behaviour
        ↓
Reasoning / Trade-offs
```

Other possibilities:

```text
Class diagram + explanation
```

or:

```text
Code + explanation
```

or:

```text
Diagram + code
```

The assignment presents:

- Text design
- Code
- Diagram
- Combined

as possible submission approaches.

### The actual question

> **What minimum information must a learner provide before the platform has enough evidence to judge their LLD?**

---

# 4.2 What makes feedback useful when there can be more than one valid LLD solution?

This is one of the most important questions.

There is not necessarily one perfect solution for an LLD problem.

For example:

### Design A

```text
ParkingLot
 ├── Floor
 ├── Spot
 ├── Vehicle
 └── Ticket
```

### Design B

```text
ParkingFacility
 ├── ParkingArea
 ├── ParkingSpace
 ├── Vehicle
 ├── ParkingSession
 └── AllocationPolicy
```

Both designs could potentially be valid.

Therefore, the platform should not simply compare the learner's answer with one reference solution.

The assignment suggests evaluating dimensions such as:

- Requirement understanding
- Class responsibilities
- Coupling / cohesion
- Encapsulation and interfaces
- Appropriate abstraction / patterns
- Extensibility
- Edge cases and testability
- Quality of explanation

### Bad feedback

```text
Your answer is wrong.
```

or simply:

```text
Score: 72/100
```

### Better feedback

```text
Criterion: Cohesion
Score: 6/10

Good:
You correctly modeled multiple vehicle types.

Concern:
Pricing logic is embedded inside ParkingLot.

Why it matters:
Adding a new pricing rule would require modifying ParkingLot.

Suggestion:
Separate pricing behaviour behind an abstraction.
```

Useful feedback should answer:

```text
What did I do?
      ↓
What's wrong?
      ↓
Why is it a problem?
      ↓
What should I do differently?
```

The goal is therefore to evaluate **design quality**, not simply answer similarity.

---

# 4.3 Which parts of evaluation should be deterministic, and which parts benefit from an LLM?

The platform should not rely on AI for everything.

Some things are objectively knowable.

### Deterministic evaluation

Examples:

```text
Required fields
Submission validation
Known business rules
Submission state transitions
Compilation
Tests
Duplicate handling / idempotency
```

### AI evaluation

Examples:

```text
Quality of responsibilities
Design trade-offs
SOLID / abstraction analysis
Candidate explanation
Improvement suggestions
```

Conceptually:

```text
                 Evaluation
                     |
          ┌──────────┴──────────┐
          ↓                     ↓
   Deterministic               AI
   Evaluation               Evaluation
          |                     |
          ↓                     ↓
 Required fields        Responsibilities
 Submission state       Abstractions
 Tests                  Trade-offs
 Known rules            Improvements
```

The principle is:

> **Use code where the answer is objectively knowable; use AI where interpretation or judgment is required.**

The platform should avoid an unconstrained approach such as:

```text
"Is this a good design?"
```

or:

```text
"Give this solution a score out of 100."
```

---

# 4.4 How would your design accommodate another evaluation approach or another submission format later?

This is an **extensibility question**.

Today:

```text
Submission
    ↓
AI Evaluator
```

Later, the platform might support:

```text
Submission
    ↓
RuleBasedEvaluator
```

or:

```text
Submission
    ↓
HumanReviewer
```

or:

```text
Submission
    ↓
AI + RuleBased
```

Similarly, today:

```text
TextSubmission
```

Later:

```text
TextSubmission
CodeSubmission
DiagramSubmission
```

Conceptually:

```text
             Submission
                  |
        ┌─────────┼─────────┐
        ↓         ↓         ↓
       Text      Code     Diagram


             Evaluator
                  |
        ┌─────────┼─────────┐
        ↓         ↓         ↓
        AI       Rules     Human
```

The important question is:

> **Can these variations be added without rewriting the entire practice flow?**

The future features do not necessarily need to be implemented. The design simply needs a sensible place for the variation.

---

# 4.5 What should happen if evaluation takes time or fails?

This asks what happens after:

```text
Submit
```

If AI evaluation takes time, the system should not necessarily keep the submission request waiting for the entire evaluation.

The assignment suggests a practical state flow:

```text
Submitted
    ↓
Evaluating
    ↓
Completed
```

or:

```text
Submitted
    ↓
Evaluating
    ↓
Failed
```

The submission should be stored before evaluation begins so that it is not lost if evaluation fails.

The assignment also mentions avoiding duplicate processing when the learner retries the same request.

The important point:

> Keep this practical.

The assignment explicitly says:

> Do not turn this into a distributed-systems project.

---

# 5. Section 5 — Important Distinction: LLD Focus

This section tells us **what the assignment is actually evaluating** and what should not dominate the implementation.

The assignment says this is primarily an:

> **LLD/domain-design exercise**

A simple monolith is completely acceptable.

The assignment explicitly says not to spend the majority of the time on:

- Kubernetes
- Microservices
- Multi-region deployment
- Sharding
- CDN
- Other large-scale HLD concerns

---

# 6. What LLD Focus Means

LLD is about how the software itself is structured internally.

Important areas:

```text
Classes
Objects
Responsibilities
Interfaces
Relationships
Behaviour
Patterns
Extensibility
Code-level decisions
```

---

## 6.1 Classes

Classes represent important domain concepts.

Possible examples from the assignment:

```text
Problem
Attempt
Submission
Evaluation
Rubric
Feedback
```

These are examples, not mandatory classes.

---

## 6.2 Responsibilities

Every class should have a clear responsibility.

For example:

```text
Attempt
→ manages the learner's attempt lifecycle

Submission
→ represents what the learner submitted

Evaluation
→ represents the evaluation result
```

The important question is:

> What does this class actually own?

Avoid having one giant object/service responsible for everything.

---

## 6.3 Interfaces

Interfaces define contracts between parts of the system.

For example:

```text
Evaluator
   |
   ├── AIEvaluator
   ├── RuleEvaluator
   └── HumanEvaluator
```

The important question is not:

> Can I use an interface?

The important question is:

> **Where do I expect behaviour to vary?**

---

## 6.4 Relationships

Relationships describe how domain objects interact.

For example:

```text
Problem
   |
   └── has many Attempts

Attempt
   |
   └── has Submission

Submission
   |
   └── gets Evaluation
```

Relationships should represent actual domain behaviour.

---

## 6.5 Behaviour

LLD is not just:

```text
Classes
Fields
Getters
Setters
```

It is also about:

```text
What can an object do?
What rules does it enforce?
What state transitions occur?
How do objects collaborate?
```

---

## 6.6 Patterns

Patterns can be useful when they solve an actual design problem.

Possible examples:

```text
Strategy
Factory
State
Observer
```

However, patterns should not be added simply to demonstrate pattern knowledge.

Bad:

```text
"I know Factory Pattern,
therefore I need Factory."
```

Good:

```text
Requirement:
Different evaluator behaviours may exist.

Design response:
Use an evaluator abstraction to allow the behaviour to vary.
```

The assignment values the reasoning behind an abstraction.

---

## 6.7 Extensibility

Extensibility means:

> **How easily can the design change when requirements change?**

The assignment provides two explicit change tests.

### Change Test A

Today:

```text
Text submission
```

Later:

```text
Class diagram submission
```

Question:

> How much of the domain model changes?

### Change Test B

Today:

```text
One evaluator
```

Later:

```text
Rule-based evaluator
Human review
```

Question:

> Can another evaluator be added without rewriting the practice flow?

---

# 7. What Section 5 Does NOT Want

The assignment does not want the majority of effort spent building something like:

```text
Load Balancer
       ↓
API Gateway
       ↓
10 Microservices
       ↓
Kafka
       ↓
Redis
       ↓
Kubernetes
       ↓
Multi-region
       ↓
CDN
```

A simple monolith is acceptable.

The focus should instead be:

```text
Domain model
Responsibilities
Interfaces
Behaviour
Relationships
Extensibility
Evaluation
Feedback
```

---

# 8. Tab 2 — Section 1: Start With the Learner Problem

The assignment explicitly says:

> Do not begin by choosing React, Node.js, MongoDB, an LLM, or a diagram library.

First understand why LLD practice is difficult.

The research questions are:

1. How does a learner currently practice an LLD problem?
2. How does the learner decide whether the solution is good?
3. What happens when two valid designs look very different?
4. What feedback would help the learner improve on the next attempt?
5. What evidence should the platform retain from an attempt?

---

# 9. How Does a Learner Currently Practice an LLD Problem?

A common practice flow is:

```text
Find problem
    ↓
Read requirements
    ↓
Think about entities/classes
    ↓
Design
    ↓
Write diagram/code
    ↓
Compare with solution / receive feedback
    ↓
Repeat
```

Existing platforms show different implementations of this general loop.

For example, LLDCanvas combines:

```text
Problem library
+
UML editor
+
Runnable code
+
Interview mode
+
Discussion
+
Analytics
```

LLD Arena provides:

```text
LLD problems
+
In-browser editor
+
Compilation/testing
+
UML
+
AI-graded design reports
```

GitHub LLD repositories commonly organize practice around concrete problems such as:

```text
Parking Lot
Elevator
Vending Machine
Pub/Sub
Tic-Tac-Toe
ATM
```

### Important observation

There are already many resources that provide:

```text
Problems
+
Solutions
```

The more interesting problem is:

> **How do we help the learner understand why their particular design should improve?**

---

# 10. How Does the Learner Decide Whether the Solution Is Good?

A learner may simply:

```text
Read solution
    ↓
Looks similar
    ↓
"I guess mine is correct."
```

But similarity does not necessarily mean quality.

Useful evaluation dimensions include:

```text
Responsibilities
SOLID
Coupling
Cohesion
Interfaces
Patterns
Extensibility
Edge cases
```

The assignment therefore proposes a rubric rather than treating one reference solution as the only correct solution.

The core question is:

> **How can we evaluate design quality rather than answer similarity?**

---

# 11. What Happens When Two Valid Designs Look Very Different?

LLD is not a multiple-choice problem.

Example:

### Design A

```text
ParkingLot
Floor
Spot
Vehicle
Ticket
```

### Design B

```text
ParkingFacility
ParkingArea
ParkingSpace
Vehicle
ParkingSession
AllocationPolicy
```

Both may be valid.

Therefore evaluation should focus on:

```text
Does it satisfy the requirements?
Are responsibilities coherent?
Is coupling reasonable?
Can requirements evolve?
Are important rules enforced?
```

Rather than:

```text
Does it contain exactly these classes?
```

---

# 12. What Feedback Would Help the Learner Improve?

Bad:

```text
Score: 72/100
```

Better:

```text
Requirement understanding: 8/10

Good:
You correctly modeled multiple vehicle types.

Concern:
Vehicle pricing logic is embedded inside ParkingLot.

Why it matters:
Adding a new pricing rule would require modifying ParkingLot.

Suggestion:
Separate pricing behaviour behind an abstraction.
```

Useful feedback should tell the learner:

```text
What did I do?
      ↓
What's wrong?
      ↓
Why is it a problem?
      ↓
What should I do differently?
```

The assignment suggests an evaluation structure like:

```text
criterion
    ↓
score
    ↓
evidence
    ↓
concern
    ↓
suggestion
    ↓
confidence
```

---

# 13. What Evidence Should the Platform Retain From an Attempt?

The platform should retain enough information for the learner to review previous attempts.

Conceptually:

```text
Problem
   ↓
Attempt
   ↓
Submission
   ↓
Evaluation
   ↓
Feedback
```

Potentially, the learner should be able to see progress such as:

```text
Attempt #1
Score: 62
Weakness: Responsibilities

Attempt #2
Score: 74
Weakness: Extensibility

Attempt #3
Score: 83
```

The purpose of history is:

> Support improvement, rather than one-time solving.

---

# 14. Tab 2 — Section 2: Do a Small Amount of Real Research

The assignment asks for approximately **2–3 hours** of research.

It suggests looking at:

```text
LLD practice/interview tools
GitHub projects
Articles
Community discussions
```

The research should investigate:

| Area | Questions |
|---|---|
| Practice workflow | How does the learner start, work, submit and retry? |
| Submission | Is the solution text, code, UML or something else? |
| Feedback | Is there a score, comments, rubric, reference solution or AI feedback? |
| Learning loop | Does the product help identify recurring weaknesses? |
| Gaps | What would you change or simplify? |

---

# 15. Existing Platforms / Tools Researched

## 15.1 LLDCanvas

LLDCanvas combines:

```text
LLD problems
+
UML editor
+
Design patterns
+
Runnable code
+
Interview mode
+
Community discussions
+
Analytics
```

It demonstrates that LLD practice can go beyond a static question/answer bank.

The useful lesson is:

> Interactive design and comparison can be part of the practice loop.

---

## 15.2 LLD Arena

LLD Arena is particularly relevant because it combines many of the same concepts as the assignment.

It includes:

```text
LLD problems
Monaco editor
Java compilation
Hidden tests
UML diagrams
AI design grading
Progression
```

It is an important existing project to study because it shows an implementation of:

```text
Practice
+
Submission
+
Execution/testing
+
UML
+
AI evaluation
+
Progress
```

---

## 15.3 AlgoInsight

AlgoInsight structures practice around:

```text
Requirements
      ↓
Core entities
      ↓
Classes & relationships
      ↓
Implementation
      ↓
Edge cases / tests
      ↓
Extensibility & trade-offs
```

It also provides AI evaluation.

This is closely related to the assignment's focus.

---

## 15.4 InstaMock

InstaMock provides AI-powered LLD interview practice involving:

```text
OOP
SOLID
Design patterns
AI feedback
Scoring
```

This represents a more conversational/interview-oriented direction.

---

## 15.5 DevSketches

DevSketches emphasizes an LLD workflow involving:

```text
Clarify scope
      ↓
Classes / responsibilities
      ↓
Flows
      ↓
Concurrency
      ↓
Implementation
```

It also distinguishes LLD from HLD.

---

# 16. GitHub Projects Researched

## 16.1 `mightbeanshuu/lld-arena`

This is one of the most relevant repositories for the assignment.

It combines:

```text
Problems
+
Submission
+
Code execution
+
Tests
+
UML
+
AI grading
+
Progress
```

It is useful for studying how a similar practice/evaluation product has been structured.

---

## 16.2 `vivek-panchal/Low-Level-Design-Javascript`

This repository organizes LLD practice around:

```text
Problem scope
Requirements
Mermaid diagrams
Sequence / structure diagrams
Class maps
Interviewer Q&A
```

It is useful for understanding how individual LLD problems and their supporting learning material can be represented.

---

## 16.3 `mithran77/low-level-design`

This repository covers:

```text
OOPS
SOLID
DRY
YAGNI
KISS
```

along with concrete LLD problems such as:

```text
Parking Lot
Elevator
Vending Machine
Pub/Sub
Tic-Tac-Toe
```

---

## 16.4 `kumaransg/LLD`

This is a larger collection of LLD/system-design questions and implementations used for interview preparation.

It is useful for understanding the breadth of problems commonly used for LLD practice.

---

# 17. Community Discussions Researched

Community discussions reveal practical learner problems that are relevant to the assignment.

One developersIndia discussion describes people looking for LLD mock partners because they want feedback on:

```text
Design
Code quality
Communication
```

rather than simply reading solutions.

Another discussion highlights uncertainty around the actual LLD process:

```text
How do I gather requirements?
What scope is expected?
When do I stop asking questions?
How do I break the problem into classes?
How much code should I write?
```

Another recent discussion highlights a problem with AI-assisted LLD practice:

> AI can overcomplicate an LLD prompt and turn it into something much larger than the intended interview problem.

This suggests that AI feedback should remain bounded by:

```text
Problem requirements
+
Expected scope
```

rather than generating unnecessary complexity.

Another discussion shows that candidates are uncertain about exactly what LLD interviews expect, such as:

```text
UML only?
Code?
Clean architecture?
```

This reinforces that learners need clarity around what constitutes a good LLD solution.

---

# 18. Tab 2 — Section 3: Define a Narrow MVP

The assignment explicitly recommends a small MVP.

A strong two-day MVP can be:

```text
3–5 problems
+
1 practice flow
+
1 submission model
+
1 evaluation flow
+
Feedback
+
Attempt history
```

The important principle is:

> Do not build features simply because they sound impressive.

Ask:

> **Does this feature improve the practice loop?**

The assignment is not asking for:

```text
1000 problems
Social network
Chat
Leaderboards
Subscriptions
Notifications
Mobile application
```

The goal is to solve:

> **One clear learner problem well.**

---

# 19. Tab 2 — Section 4: Think About the Submission

This section asks:

> **What representation of an LLD solution should the learner submit?**

Possible options:

| Submission | What it proves |
|---|---|
| Text design | Requirements, assumptions, classes, responsibilities, reasoning |
| Code | Concrete implementation, interfaces, coupling, testability, behaviour |
| Diagram | Relationships, structure, responsibilities |
| Combined | More evidence, but more implementation effort |

The assignment does not require supporting everything.

The important decision is:

> **What is the smallest submission format that gives enough evidence of design quality?**

---

# 20. Tab 2 — Section 5: Think About Evaluation as a Rubric

This section asks:

> **What exactly are we evaluating?**

The assignment suggests dimensions such as:

```text
Requirement understanding
Class responsibilities
Coupling / cohesion
Encapsulation / interfaces
Abstraction / patterns
Extensibility
Edge cases / testability
Explanation quality
```

This becomes the platform's evaluation model.

Instead of:

```text
AI:
"Give this solution a score out of 100."
```

the platform can conceptually produce:

```text
Requirement understanding → 8/10
Responsibilities → 6/10
Cohesion → 7/10
Extensibility → 5/10

Evidence:
...

Concern:
...

Suggestion:
...
```

The important property is:

> **Explainable feedback.**

---

# 21. Tab 2 — Section 6: Decide Where AI Helps

This section asks:

> **Where is AI genuinely useful instead of simply adding AI for the sake of it?**

### Deterministic logic

```text
Required fields
Submission validation
Known rules
Tests
State transitions
Duplicate handling
```

### AI

```text
Responsibility quality
Trade-offs
SOLID / abstractions
Explanation quality
Improvement suggestions
```

The principle is:

> **Use code where the answer is objectively knowable; use AI where reasoning/judgment is required.**

---

# 22. Tab 2 — Section 7: Make AI Feedback More Consistent

This section asks:

> **How do we prevent the LLM from giving random or inconsistent feedback?**

The assignment recommends:

```text
Fixed rubric
+
Structured output
```

Example:

```text
criterion
score
evidence
concern
suggestion
confidence
```

The platform should therefore avoid:

```text
"Looks pretty good!
Maybe improve your classes."
```

and instead produce structured feedback such as:

```text
Criterion: Cohesion
Score: 6

Evidence:
...

Concern:
...

Suggestion:
...

Confidence:
...
```

The LLM therefore acts as an **evaluation component**, rather than becoming the entire application.

---

# 23. Tab 2 — Section 8: Keep the LLD of Your Product Meaningful

This section is subtle but important.

The product itself is a platform for practicing LLD.

Therefore:

> **The platform itself should demonstrate good LLD.**

The assignment gives possible domain objects:

```text
Problem
Attempt
Submission
Evaluation
Rubric
Feedback
```

These are examples, not mandatory classes.

For every class, ask:

```text
What responsibility does it own?
What behaviour belongs here?
What does it depend on?
What is likely to change?
Why does this abstraction exist?
```

The goal is not to create as many classes as possible.

The goal is to have:

```text
Clear responsibilities
+
Meaningful behaviour
+
Appropriate relationships
+
Useful abstractions
+
Extensibility
```

---

# 24. The Two Most Important Ideas

The assignment can be reduced to two major problems.

## Problem A — Practice

```text
Give learner a realistic LLD problem
        ↓
Give enough requirements
        ↓
Let them design
        ↓
Let them submit
```

## Problem B — Evaluation

```text
Understand their submission
        ↓
Evaluate design quality
        ↓
Explain why
        ↓
Suggest improvements
        ↓
Store it
        ↓
Allow another attempt
```

The second part is where the assignment becomes particularly interesting.

There are already many repositories and platforms that provide:

```text
LLD Problems
+
Reference Solutions
```

The assignment asks something more focused:

> **How do we turn LLD practice into a feedback-driven learning loop when there isn't always one correct design?**

---

# 25. Overall Product Concept

The entire assignment can be understood as:

```text
                 LLD PRACTICE PLATFORM

                       Learner
                          |
                          ↓
                  Choose a problem
                          |
                          ↓
                  Understand requirements
                          |
                          ↓
                    Design solution
                          |
                          ↓
                       Submit
                          |
                          ↓
                     Evaluate
                  ┌───────┴───────┐
                  ↓               ↓
           Deterministic          AI
              checks           judgment
                  └───────┬───────┘
                          ↓
                      Feedback
                          |
                          ↓
                       History
                          |
                          ↓
                     Try Again
```

Behind this flow, the design needs to answer:

```text
What is a Problem?
What is an Attempt?
What is a Submission?
What is an Evaluation?
What is Feedback?
What is the Rubric?

Can submission formats change?
Can evaluators change?
Can evaluation fail?
Can evaluation be slow?
```

---

# 26. What Is Right for This Assignment

The assignment values:

```text
Simple architecture
+
Clean domain boundaries
+
Clear reason for abstractions
+
Useful feedback model
+
Small amount of thoughtful AI
+
Working end-to-end prototype
+
Clear trade-offs
+
Clear limitations
+
Tests for important behaviour
```

The assignment explicitly considers these strong candidate decisions.

---

# 27. What Is Wrong / Less Impressive for This Assignment

The assignment specifically says it would be less impressed by:

```text
Many microservices with no need
```

```text
Lots of UI with weak practice logic
```

```text
Design patterns added only to demonstrate pattern knowledge
```

```text
An LLM prompt that simply asks for a 100-point score
```

```text
Large feature lists with little working functionality
```

---

# 28. Evaluation Weighting

The assignment evaluates:

| Area | Weight |
|---|---:|
| Problem understanding & research | 15% |
| Product thinking / creativity | 15% |
| LLD / domain design | 25% |
| Evaluation & feedback approach | 15% |
| Extensibility & engineering judgement | 10% |
| Implementation quality | 10% |
| Testing & reliability | 5% |
| AI usage | 5% |

The largest individual category is:

> **LLD / domain design — 25%**

This reinforces that the assignment is primarily an LLD/domain-design exercise.

---

# 29. Final Understanding

The assignment is **not** primarily asking:

> “Can you build an AI-powered LLD website?”

It is asking whether you can thoughtfully design and build a small product around this problem:

> **A learner wants to practice LLD, submit their own design, understand whether the design is good, receive useful/explainable feedback, review previous attempts, and improve.**

The implementation should therefore revolve around:

```text
Problem
   ↓
Practice
   ↓
Submission
   ↓
Evaluation
   ↓
Feedback
   ↓
History
   ↓
Retry
```

while demonstrating:

```text
Good LLD
+
Clear responsibilities
+
Meaningful abstractions
+
Extensibility
+
Practical evaluation
+
Thoughtful AI usage
```

and avoiding unnecessary HLD complexity.

---

# 30. Important Context for the Next Discussion

Before implementation, the important decisions to discuss are:

1. **What exactly does the learner submit?**
   - Text
   - Diagram
   - Code
   - Combination

2. **What exactly does “good LLD” mean?**
   - Define the evaluation rubric.

3. **What can be evaluated deterministically?**

4. **What requires AI reasoning?**

5. **How should AI feedback be structured and made consistent?**

6. **How should submission and evaluator variations remain extensible?**

7. **How should evaluation states and failures work?**

8. **What evidence should be retained in attempt history?**

9. **What is the smallest MVP that completes the practice loop?**

10. **How should the platform's own domain model demonstrate good LLD?**

These decisions should be discussed before choosing the technology stack or beginning implementation.

---

# References / Research Sources Mentioned

## Platforms

- **LLDCanvas**
  - LLD problems
  - UML editor
  - Design patterns
  - Runnable code
  - Interview mode
  - Community discussions
  - Analytics

- **LLD Arena**
  - LLD problems
  - Monaco editor
  - Java compilation
  - Hidden tests
  - UML diagrams
  - AI design grading
  - Progression

- **AlgoInsight**
  - Requirements
  - Core entities
  - Classes and relationships
  - Implementation
  - Edge cases/tests
  - Extensibility/trade-offs
  - AI evaluation

- **InstaMock**
  - AI-powered LLD interview practice
  - OOP
  - SOLID
  - Design patterns
  - AI feedback
  - Scoring

- **DevSketches**
  - Scope clarification
  - Classes/responsibilities
  - Flows
  - Concurrency
  - Implementation

## GitHub Projects

- `mightbeanshuu/lld-arena`
- `vivek-panchal/Low-Level-Design-Javascript`
- `mithran77/low-level-design`
- `kumaransg/LLD`

## Community Discussions

Research included discussions around:

- Finding LLD mock interview partners
- Feedback on design, code quality and communication
- How to gather requirements
- Determining LLD scope
- Knowing when to stop asking questions
- Breaking problems into classes
- How much code to write
- AI overcomplicating LLD problems
- Whether LLD interviews expect UML, code or clean architecture

---

# Final Principle

The core objective is:

```text
Solve one clear learner problem well.
```

Not:

```text
Build every possible LLD-learning feature.
```

The platform should demonstrate that the designer understands:

```text
LLD
+
Product thinking
+
Evaluation
+
Explainable feedback
+
Extensibility
+
Practical AI usage
```

without turning the assignment into an unnecessarily large system.