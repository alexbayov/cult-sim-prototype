// Investigation content model for the cult investigation / dossier game.
//
// All types here describe purely static content authored as JSON.
// Runtime state (selected evidence, pattern status, report draft) is
// modelled separately and is not part of this file.

export type SourceType =
  | 'chat'
  | 'landing'
  | 'testimony'
  | 'payment'
  | 'videoTranscript'
  | 'socialPost'
  | 'internalDoc'
  | 'diary'
  | 'news'
  | 'expertNote'

export type PersonRole =
  | 'leader'
  | 'admin'
  | 'vulnerableParticipant'
  | 'exMember'
  | 'donor'
  | 'recruiter'
  | 'relative'
  | 'expert'

export type PatternStatus =
  | 'unknown'
  | 'suspected'
  | 'supported'
  | 'confirmed'
  | 'contradicted'

export type RiskTag =
  | 'financialHarm'
  | 'emotionalHarm'
  | 'isolation'
  | 'coercion'
  | 'shame'
  | 'health'
  | 'minors'
  | 'leaderControl'
  | 'publicScandal'

export type ThemeTag =
  | 'infobusiness'
  | 'selfHelp'
  | 'finance'
  | 'isolation'
  | 'leaderFigure'
  | 'closedGroup'
  | 'publicLegend'

export type ReportSectionId =
  | 'summary'
  | 'confirmedPatterns'
  | 'insufficientEvidence'
  | 'peopleAtRisk'
  | 'timeline'
  | 'strongestEvidence'
  | 'debrief'

// Weight is intentionally a small enumerated scale to keep balancing readable.
export type EvidenceWeight = 1 | 2 | 3 | 4 | 5

export type InvestigationCase = {
  id: string
  title: string
  subtitle: string
  publicLegend: string
  investigationQuestion: string
  initialSourceIds: string[]
  initialPersonIds: string[]
  riskStatement: string
  contentWarning: string
  themeTags: ThemeTag[]
}

export type CasePerson = {
  id: string
  name: string
  role: PersonRole
  publicDescription: string
  privateNotes: string
  knownFacts: string[]
  riskLevel: number
  influenceLevel: number
  credibility: number
  sourceIds: string[]
  portraitAssetId: string
}

export type CaseSource = {
  id: string
  type: SourceType
  title: string
  date: string
  origin: string
  reliability: number
  unlockedByEvidenceIds: string[]
}

export type EvidenceFragment = {
  id: string
  sourceId: string
  text: string
  speaker: string
  date: string
  defaultVisible: boolean
  linksToPersonIds: string[]
  suggestedPatternIds: string[]
  riskTags: RiskTag[]
  reliability: number
  weight: EvidenceWeight
  unlocksSourceIds: string[]
  isRedHerring: boolean
}

export type ControlPattern = {
  id: string
  title: string
  shortDescription: string
  fullDescription: string
  requiredEvidenceCount: number
  strongEvidenceIds: string[]
  weakEvidenceIds: string[]
  counterEvidenceIds: string[]
  debriefText: string
}

// Validator-only authoring hints. Runtime outcome selection uses per-outcome
// `minPatternConfirmedCount` instead. Keeping these in `report.json` is
// recommended but no longer required; the validator falls back to a derived
// default when the block is absent.
export type ReportThresholds = {
  minConfirmedPatternsForStrongOutcome?: number
  maxContradictionsBeforeWeakOutcome?: number
  riskPersonsThreshold?: number
}

export type ReportOutcome = {
  id: string
  title: string
  summary: string
  recommendedFraming: string
  requiredPatternIds: string[]
  forbiddenPatternIds: string[]
  minPatternConfirmedCount: number
  notes: string[]
}

export type ReportContent = {
  thresholds?: ReportThresholds
  outcomes: ReportOutcome[]
  sections: ReportSectionId[]
}

export type DebriefEntry = {
  id: string
  term: string
  shortExplanation: string
  longExplanation: string
  protectiveFactors: string[]
  exampleEvidenceIds: string[]
}

export type InvestigationContent = {
  case: InvestigationCase
  persons: CasePerson[]
  sources: CaseSource[]
  evidence: EvidenceFragment[]
  patterns: ControlPattern[]
  report: ReportContent
  debrief: DebriefEntry[]
}

// ---------------------------------------------------------------------------
// v2 investigation model — pivot to drag-highlight + hypothesis loop
// ---------------------------------------------------------------------------

export type DocumentType =
  | 'chat'
  | 'social'
  | 'clipping'
  | 'transcript'
  | 'interview'
  | 'document'
  | 'personal'

export type KeyPhrase = {
  range: [number, number]
  worksOn: string[]
  weight: 'strong' | 'weak' | 'counter'
}

export type Document = {
  id: string
  type: DocumentType
  title: string
  source: string
  date?: string
  body: string
  keyPhrases: KeyPhrase[]
  defaultVisible: boolean
  unlockedByAction?: string
}

export type Hypothesis = {
  id: string
  label: string
  description: string
}

export type Contact = {
  id: string
  name: string
  role: string
  initialState: 'public' | 'gated' | 'hostile' | 'unknown'
  gateRequirement?: {
    requiredHypothesis?: string
    minWeight?: 'weak' | 'strong'
    minSupportingPhrases?: number
  }
  interviewId: string
}

export type InterviewChoice = {
  id: string
  label: string
  requiresPhraseFromHypothesis?: string
  next: string
}

export type InterviewNode = {
  id: string
  speaker: 'expert' | 'contact'
  text: string
  choices?: InterviewChoice[]
  next?: string
}

export type Interview = {
  id: string
  contactId: string
  startNodeId: string
  nodes: InterviewNode[]
}

export type ActionEffect =
  | { kind: 'unlockDocument'; documentId: string }
  | { kind: 'unlockContact'; contactId: string }

export type Action = {
  id: string
  label: string
  description: string
  cost: number
  effects: ActionEffect[]
}

export type HypothesisRequirement = {
  hypothesisId: string
  minSupportingPhrases: number
  minWeight: 'weak' | 'strong'
}

export type Recommendation = {
  id: string
  label: string
  body: string
  requiresHypotheses: HypothesisRequirement[]
}

export type EpilogueQuality = 'precise' | 'imprecise' | 'incorrect'

export type Epilogue = {
  id: string
  recommendationId: string
  quality: EpilogueQuality
  body: string
  monthsAhead: 3 | 6 | 12
}

export type CaseV2 = {
  schemaVersion: 'v2'
  id: string
  title: string
  protagonist: { name: string; tagline?: string }
  brief: { from: string; body: string }
  hypotheses: Hypothesis[]
  documents: Document[]
  contacts: Contact[]
  interviews: Interview[]
  actions: Action[]
  actionBudget: number
  recommendations: Recommendation[]
  epilogues: Epilogue[]
}
