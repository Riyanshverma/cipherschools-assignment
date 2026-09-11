import { z } from 'zod';

export const CitationSchema = z.object({
  sectionKey: z.enum(['requirementsAssumptions','classesResponsibilities','relationshipsInteractions','keyBehaviourRules','edgeCasesTestability','tradeoffsExtensibility']),
  quote: z.string(), lineRange: z.object({ start: z.number(), end: z.number() }),
}).strict();

export const CriterionSchema = z.object({
  criterion: z.enum(['requirementUnderstanding','classResponsibilities','couplingCohesion','encapsulationInterfaces','abstractionPatterns','extensibility','edgeCasesTestability','explanationQuality']),
  score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  evidence: z.array(CitationSchema), strength: z.string(),
  concern: z.string().nullable(), whyItMatters: z.string().nullable(), suggestion: z.string().nullable(),
  confidence: z.enum(['low','medium','high']),
}).strict().superRefine((c, ctx) => {
  const group = [c.concern, c.whyItMatters, c.suggestion];
  const anyPresent = group.some((v) => v !== null);
  const allPresent = group.every((v) => v !== null);
  if (anyPresent && !allPresent) ctx.addIssue({ code: 'custom', message: 'concern/whyItMatters/suggestion must be present or null as a group' });
});

export const FeedbackResponseSchema = z.object({
  summary: z.string(), criteria: z.array(CriterionSchema).length(8),
}).strict();

// Wire schema for OpenAI's structured-output mode — derived from the same Zod
// schema so the two never drift, per decision 9.
export const FEEDBACK_JSON_SCHEMA = z.toJSONSchema(FeedbackResponseSchema);
