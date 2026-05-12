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

// -----------------------------------------------------------------------------
// v2 schema — Wave 4 pivot.
//
// The v1 shape above (Evidence / Pattern / Outcome / Report) describes the
// readable interactive notebook that ships on main today. The v2 shape below
// describes the investigation game from docs/GAME_DESIGN.md §4-§5: the player
// reads long Documents, drag-highlights phrases, fills hypothesis slots, gates
// open Contacts, and submits a Recommendation that produces an Epilogue.
//
// Both shapes coexist on disk and in this file. A case discriminates via its
// top-level `schemaVersion`: case.json with `"schemaVersion": "v2"` is the new
// shape; case.json without that field is the legacy v1 shape. Loaders, the
// validator, and the visible-language audit dispatch on `schemaVersion`.
// -----------------------------------------------------------------------------

export type DocumentType =
  | 'chat'
  | 'social'
  | 'clipping'
  | 'transcript'
  | 'interview'
  | 'document'
  | 'personal'

export type KeyPhrase = {
  // [start, end) into Document.body as UTF-16 code-unit indices. The validator
  // checks 0 <= start < end <= body.length.
  range: [number, number]
  // Hypothesis ids this phrase supports or counters.
  worksOn: string[]
  weight: 'strong' | 'weak' | 'counter'
}

// Named `CaseDocument` rather than `Document` to avoid shadowing the global
// DOM `Document` type that comes in via `"lib": ["DOM"]` in tsconfig.app.json.
// The on-disk JSON shape and the design doc still call this a Document.
export type CaseDocument = {
  id: string
  type: DocumentType
  title: string
  source: string
  date?: string
  body: string
  keyPhrases: KeyPhrase[]
  // Visible on the starting table when false → must be unlocked by an Action.
  defaultVisible: boolean
  unlockedByAction?: string
}

export type Hypothesis = {
  id: string
  label: string
  description: string
}

export type ContactGateRequirement = {
  requiredHypothesis?: string
  minWeight?: 'weak' | 'strong'
  minSupportingPhrases?: number
}

export type Contact = {
  id: string
  name: string
  role: string
  initialState: 'public' | 'gated' | 'hostile' | 'unknown'
  gateRequirement?: ContactGateRequirement
  interviewId: string
}

export type InterviewChoice = {
  id: string
  label: string
  // If set, the choice is only selectable when the player has at least one
  // notebook entry attached to this hypothesis.
  requiresPhraseFromHypothesis?: string
  next: string
}

export type InterviewNode = {
  id: string
  speaker: 'expert' | 'contact'
  text: string
  choices?: InterviewChoice[]
  // Linear fall-through when no choices are presented. Either `choices` or
  // `next` (or neither, for terminal nodes) is set.
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

// Named `CaseAction` rather than `Action` to avoid the very generic word
// `Action` colliding with downstream code that often imports redux/store-style
// action types. The on-disk JSON and the design doc still call this an Action.
export type CaseAction = {
  id: string
  label: string
  description: string
  // Spent against `CaseV2.actionBudget`.
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

export type CaseV2Manifest = {
  schemaVersion: 'v2'
  id: string
  title: string
  protagonist: {
    name: string
    tagline?: string
  }
  brief: {
    from: string
    body: string
  }
  actionBudget: number
}

// On-disk, the per-section JSONs sit alongside `case.json`. The TS shape
// presented here mirrors what a future loader will assemble.
export type CaseV2 = CaseV2Manifest & {
  hypotheses: Hypothesis[]
  documents: CaseDocument[]
  contacts: Contact[]
  interviews: Interview[]
  actions: CaseAction[]
  recommendations: Recommendation[]
  epilogues: Epilogue[]
}

// Convenience aliases for downstream code that prefers the design-doc names.
// Useful in files that don't pull in the DOM lib (e.g. a future server-side
// loader); in src/ where DOM types are present, import `CaseDocument` /
// `CaseAction` directly.
export type DocumentV2 = CaseDocument
export type ActionV2 = CaseAction
