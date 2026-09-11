export type Dimension =
  | 'requirementUnderstanding' | 'classResponsibilities' | 'couplingCohesion'
  | 'encapsulationInterfaces' | 'abstractionPatterns' | 'extensibility'
  | 'edgeCasesTestability' | 'explanationQuality';

export const ALL_DIMENSIONS: Dimension[] = [
  'requirementUnderstanding', 'classResponsibilities', 'couplingCohesion',
  'encapsulationInterfaces', 'abstractionPatterns', 'extensibility',
  'edgeCasesTestability', 'explanationQuality',
];

export type SectionKey =
  | 'requirementsAssumptions' | 'classesResponsibilities' | 'relationshipsInteractions'
  | 'keyBehaviourRules' | 'edgeCasesTestability' | 'tradeoffsExtensibility';

export const REQUIRED_SECTION_KEYS: SectionKey[] = [
  'requirementsAssumptions', 'classesResponsibilities', 'relationshipsInteractions',
  'keyBehaviourRules', 'edgeCasesTestability', 'tradeoffsExtensibility',
];

export type AnchorScore = 0 | 1 | 2 | 3 | 4;
export type Confidence = 'none' | 'low' | 'medium' | 'high';
export interface LineRange { start: number; end: number }
