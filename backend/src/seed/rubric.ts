import type { DimensionDef } from '../domain/Rubric.js';

/**
 * The 8 rubric dimensions are global/shared across every problem (decision 8): what varies
 * per problem is the weight map (see `seed/problems.ts`) and the scope boundary text, not the
 * dimension set or anchor descriptions themselves.
 */
export const GLOBAL_RUBRIC_DIMENSIONS: DimensionDef[] = [
  {
    key: 'requirementUnderstanding',
    anchors: [
      { score: 0, label: 'Missing', description: "No requirements or assumptions are stated; the design doesn't engage with what was asked." },
      { score: 1, label: 'Weak', description: 'Requirements are restated but key constraints or actors are missed or misread.' },
      { score: 2, label: 'Adequate', description: 'Core requirements are captured with reasonable assumptions, though some edge conditions are unaddressed.' },
      { score: 3, label: 'Strong', description: "Requirements and explicit assumptions are clearly enumerated and match the problem's actual scope." },
      { score: 4, label: 'Exemplary', description: 'Requirements are precisely decomposed, assumptions are justified, and ambiguities are explicitly called out and resolved.' },
    ],
  },
  {
    key: 'classResponsibilities',
    anchors: [
      { score: 0, label: 'Missing', description: 'No classes are identified, or responsibilities are entirely undifferentiated.' },
      { score: 1, label: 'Weak', description: 'Classes exist but responsibilities overlap heavily, or a god-class does most of the work.' },
      { score: 2, label: 'Adequate', description: 'Classes have mostly distinct responsibilities, with a few blurred boundaries.' },
      { score: 3, label: 'Strong', description: 'Each class has a clear, single responsibility that maps cleanly to a domain concept.' },
      { score: 4, label: 'Exemplary', description: 'Responsibilities are precisely scoped per SRP, with naming and boundaries that would survive requirement changes.' },
    ],
  },
  {
    key: 'couplingCohesion',
    anchors: [
      { score: 0, label: 'Missing', description: "Classes are an undifferentiated tangle; there's no sense of what depends on what." },
      { score: 1, label: 'Weak', description: "High coupling: classes reach into each other's internals or share mutable state directly." },
      { score: 2, label: 'Adequate', description: 'Coupling is mostly reasonable but a few classes are more entangled than necessary.' },
      { score: 3, label: 'Strong', description: 'Classes are loosely coupled through well-defined interfaces, and each class is internally cohesive.' },
      { score: 4, label: 'Exemplary', description: 'Coupling is minimized deliberately (e.g. via interfaces/events) and cohesion is high throughout, with dependencies flowing in one clear direction.' },
    ],
  },
  {
    key: 'encapsulationInterfaces',
    anchors: [
      { score: 0, label: 'Missing', description: 'No encapsulation; all state is exposed and mutated directly from outside.' },
      { score: 1, label: 'Weak', description: 'Some fields are public that should be private; interfaces leak implementation details.' },
      { score: 2, label: 'Adequate', description: 'Most state is encapsulated behind methods, with a few leaks.' },
      { score: 3, label: 'Strong', description: 'State is well encapsulated and interfaces expose only what callers need.' },
      { score: 4, label: 'Exemplary', description: 'Interfaces are minimal and intention-revealing; invariants are protected and cannot be violated from outside the class.' },
    ],
  },
  {
    key: 'abstractionPatterns',
    anchors: [
      { score: 0, label: 'Missing', description: 'No abstraction; behavior is hard-coded with no reusable structure.' },
      { score: 1, label: 'Weak', description: 'Abstractions are misapplied, or a pattern is forced where a simpler structure would work.' },
      { score: 2, label: 'Adequate', description: 'Reasonable abstractions are used, though some opportunities for polymorphism are missed (e.g. if/else chains on type).' },
      { score: 3, label: 'Strong', description: 'Appropriate abstractions/patterns (e.g. strategy, factory, state) are used where they genuinely fit the problem.' },
      { score: 4, label: 'Exemplary', description: 'Abstractions are chosen deliberately and explained, trading off simplicity against flexibility with clear justification.' },
    ],
  },
  {
    key: 'extensibility',
    anchors: [
      { score: 0, label: 'Missing', description: 'The design would require a rewrite to add any new variant or rule.' },
      { score: 1, label: 'Weak', description: 'Adding a new variant requires touching many existing classes or editing conditionals.' },
      { score: 2, label: 'Adequate', description: 'Some extension points exist, but a few likely future changes would still ripple across the design.' },
      { score: 3, label: 'Strong', description: 'New variants (e.g. a new vehicle type, a new pricing rule) can be added by adding a class, not editing existing ones.' },
      { score: 4, label: 'Exemplary', description: 'The design anticipates realistic future requirements and isolates change behind clear extension points (open/closed in practice, not just in name).' },
    ],
  },
  {
    key: 'edgeCasesTestability',
    anchors: [
      { score: 0, label: 'Missing', description: 'No edge cases are considered; the design only covers the happy path.' },
      { score: 1, label: 'Weak', description: "A couple of edge cases are mentioned but not designed for (e.g. no concurrency/capacity handling)." },
      { score: 2, label: 'Adequate', description: 'Common edge cases are addressed, though some (e.g. concurrency, empty/boundary states) are missed.' },
      { score: 3, label: 'Strong', description: 'Edge cases (concurrency, capacity limits, invalid input, boundary states) are identified and the design shows how they are handled.' },
      { score: 4, label: 'Exemplary', description: 'Edge cases are enumerated systematically and the design is structured so each is independently testable (small units, clear seams).' },
    ],
  },
  {
    key: 'explanationQuality',
    anchors: [
      { score: 0, label: 'Missing', description: 'There is no explanation of design choices or trade-offs.' },
      { score: 1, label: 'Weak', description: "Choices are stated but not justified; trade-offs aren't discussed." },
      { score: 2, label: 'Adequate', description: 'Some trade-offs are discussed, but the reasoning is thin or inconsistent with the design shown.' },
      { score: 3, label: 'Strong', description: 'Trade-offs and alternative approaches are clearly explained and consistent with what was actually built.' },
      { score: 4, label: 'Exemplary', description: 'The explanation makes the reasoning behind every major decision legible, including what was rejected and why.' },
    ],
  },
];
