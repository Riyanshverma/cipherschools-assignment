import type { DesignDocument } from '../../domain/DesignDocument.js';
import type { Rubric } from '../../domain/Rubric.js';
import type { ProblemContext } from '../../domain/ports/Evaluator.js';
import { REQUIRED_SECTION_KEYS, type AnchorScore } from '../../domain/types.js';

const ANCHOR_SCORES: AnchorScore[] = [0, 1, 2, 3, 4];

function renderRubric(rubric: Rubric): string {
  return rubric.getDimensions().map((dimension) => {
    const anchors = ANCHOR_SCORES.map((score) => {
      const anchor = rubric.getAnchor(dimension, score);
      return `  ${score} — ${anchor.label}: ${anchor.description}`;
    }).join('\n');
    return `${dimension}:\n${anchors}`;
  }).join('\n\n');
}

function renderSections(document: DesignDocument): string {
  return REQUIRED_SECTION_KEYS.map((key) => {
    const section = document.getSection(key);
    return `### ${key}\n${section?.text ?? '(missing)'}`;
  }).join('\n\n');
}

/**
 * Pure prompt assembly — no I/O. Embeds the rubric anchors (so the model
 * scores against the same named anchors a human reviewer would use) and the
 * problem's scope boundary verbatim (decision 5.4 — bounds the model to the
 * problem as posed, not whatever else it might imagine the system needs).
 */
export function buildPrompt(
  document: DesignDocument, rubric: Rubric, context: ProblemContext,
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    'You are evaluating a low-level design (LLD) submission against an 8-dimension rubric.',
    'Score every dimension 0-4 using the named anchors below. Never abstain — always give a score.',
    'Cite evidence only as exact quotes from the submitted sections.',
    '',
    'Rubric:',
    renderRubric(rubric),
  ].join('\n');

  const userPrompt = [
    `Problem: ${context.problemId}`,
    `Requirements:\n${context.requirements}`,
    `Scope boundary (the submission must be judged only against this scope):\n${context.scopeBoundary}`,
    '',
    'Submitted design document:',
    renderSections(document),
  ].join('\n');

  return { systemPrompt, userPrompt };
}
