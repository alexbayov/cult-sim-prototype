import type {
  CasePerson,
  CaseSource,
  ControlPattern,
  DebriefEntry,
  EvidenceFragment,
  InvestigationCase,
  InvestigationContent,
  ReportContent,
  ReportOutcome,
} from './types'

// Runtime validator for InvestigationContent.
//
// This is a small in-game validator focused on the kinds of mistakes that
// silently break the dossier UI: duplicate ids, dangling references between
// sources/persons/evidence/patterns, empty required arrays, and out-of-range
// numeric fields. A separate offline CLI validator may extend this later.

const isInRange = (value: number, min: number, max: number): boolean =>
  Number.isFinite(value) && value >= min && value <= max

const collectDuplicateIds = (entityLabel: string, ids: string[]): string[] => {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`Duplicate ${entityLabel} id: ${id}`)
    } else {
      seen.add(id)
    }
  }
  return errors
}

const validateCase = (
  caseData: InvestigationCase,
  sourceIds: Set<string>,
  personIds: Set<string>,
): string[] => {
  const errors: string[] = []
  if (!caseData.id) errors.push('Case is missing id')
  if (!caseData.title) errors.push(`Case ${caseData.id} is missing title`)
  if (!caseData.investigationQuestion) {
    errors.push(`Case ${caseData.id} is missing investigationQuestion`)
  }
  if (caseData.initialSourceIds.length === 0) {
    errors.push(`Case ${caseData.id} has empty initialSourceIds`)
  }
  if (caseData.initialPersonIds.length === 0) {
    errors.push(`Case ${caseData.id} has empty initialPersonIds`)
  }
  if (caseData.themeTags.length === 0) {
    errors.push(`Case ${caseData.id} has empty themeTags`)
  }
  for (const id of caseData.initialSourceIds) {
    if (!sourceIds.has(id)) {
      errors.push(`Case initialSourceIds references unknown source: ${id}`)
    }
  }
  for (const id of caseData.initialPersonIds) {
    if (!personIds.has(id)) {
      errors.push(`Case initialPersonIds references unknown person: ${id}`)
    }
  }
  return errors
}

const validatePersons = (
  persons: CasePerson[],
  sourceIds: Set<string>,
): string[] => {
  const errors: string[] = []
  errors.push(...collectDuplicateIds('person', persons.map((p) => p.id)))
  for (const person of persons) {
    if (!person.name) errors.push(`Person ${person.id} is missing name`)
    if (!isInRange(person.riskLevel, 0, 100)) {
      errors.push(`Person ${person.id} riskLevel out of range 0..100`)
    }
    if (!isInRange(person.influenceLevel, 0, 100)) {
      errors.push(`Person ${person.id} influenceLevel out of range 0..100`)
    }
    if (!isInRange(person.credibility, 0, 100)) {
      errors.push(`Person ${person.id} credibility out of range 0..100`)
    }
    for (const sourceId of person.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        errors.push(
          `Person ${person.id} sourceIds references unknown source: ${sourceId}`,
        )
      }
    }
  }
  return errors
}

const validateSources = (
  sources: CaseSource[],
  evidenceIds: Set<string>,
): string[] => {
  const errors: string[] = []
  errors.push(...collectDuplicateIds('source', sources.map((s) => s.id)))
  for (const source of sources) {
    if (!source.title) errors.push(`Source ${source.id} is missing title`)
    if (!isInRange(source.reliability, 0, 100)) {
      errors.push(`Source ${source.id} reliability out of range 0..100`)
    }
    for (const evidenceId of source.unlockedByEvidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(
          `Source ${source.id} unlockedByEvidenceIds references unknown evidence: ${evidenceId}`,
        )
      }
    }
  }
  return errors
}

const validateEvidence = (
  evidence: EvidenceFragment[],
  sourceIds: Set<string>,
  personIds: Set<string>,
  patternIds: Set<string>,
): string[] => {
  const errors: string[] = []
  errors.push(...collectDuplicateIds('evidence', evidence.map((e) => e.id)))
  const evidenceIds = new Set(evidence.map((e) => e.id))
  for (const fragment of evidence) {
    if (!fragment.text) {
      errors.push(`Evidence ${fragment.id} has empty text`)
    }
    if (!sourceIds.has(fragment.sourceId)) {
      errors.push(
        `Evidence ${fragment.id} sourceId references unknown source: ${fragment.sourceId}`,
      )
    }
    if (!isInRange(fragment.reliability, 0, 100)) {
      errors.push(`Evidence ${fragment.id} reliability out of range 0..100`)
    }
    if (![1, 2, 3, 4, 5].includes(fragment.weight)) {
      errors.push(`Evidence ${fragment.id} weight must be 1..5`)
    }
    for (const personId of fragment.linksToPersonIds) {
      if (!personIds.has(personId)) {
        errors.push(
          `Evidence ${fragment.id} linksToPersonIds references unknown person: ${personId}`,
        )
      }
    }
    for (const patternId of fragment.suggestedPatternIds) {
      if (!patternIds.has(patternId)) {
        errors.push(
          `Evidence ${fragment.id} suggestedPatternIds references unknown pattern: ${patternId}`,
        )
      }
    }
    for (const sourceId of fragment.unlocksSourceIds) {
      if (!sourceIds.has(sourceId)) {
        errors.push(
          `Evidence ${fragment.id} unlocksSourceIds references unknown source: ${sourceId}`,
        )
      }
      if (sourceId === fragment.sourceId) {
        errors.push(
          `Evidence ${fragment.id} cannot unlock its own source: ${sourceId}`,
        )
      }
    }
  }
  return [...errors, ...crossCheckEvidenceSet(evidence, evidenceIds)]
}

const crossCheckEvidenceSet = (
  evidence: EvidenceFragment[],
  evidenceIds: Set<string>,
): string[] => {
  const errors: string[] = []
  // sanity: every evidence id is unique already enforced; nothing else here.
  // Keeping this hook so pattern/report validators can share evidenceIds.
  void evidence
  void evidenceIds
  return errors
}

const validatePatterns = (
  patterns: ControlPattern[],
  evidenceIds: Set<string>,
): string[] => {
  const errors: string[] = []
  errors.push(...collectDuplicateIds('pattern', patterns.map((p) => p.id)))
  for (const pattern of patterns) {
    if (!pattern.title) {
      errors.push(`Pattern ${pattern.id} is missing title`)
    }
    if (pattern.requiredEvidenceCount < 1) {
      errors.push(
        `Pattern ${pattern.id} requiredEvidenceCount must be >= 1`,
      )
    }
    const checkIds = (label: string, ids: string[]) => {
      for (const id of ids) {
        if (!evidenceIds.has(id)) {
          errors.push(
            `Pattern ${pattern.id} ${label} references unknown evidence: ${id}`,
          )
        }
      }
    }
    checkIds('strongEvidenceIds', pattern.strongEvidenceIds)
    checkIds('weakEvidenceIds', pattern.weakEvidenceIds)
    checkIds('counterEvidenceIds', pattern.counterEvidenceIds)
  }
  return errors
}

const validateReport = (
  report: ReportContent,
  patternIds: Set<string>,
): string[] => {
  const errors: string[] = []
  if (report.outcomes.length === 0) {
    errors.push('Report has no outcomes')
  }
  errors.push(
    ...collectDuplicateIds('report outcome', report.outcomes.map((o) => o.id)),
  )
  for (const outcome of report.outcomes) {
    if (!outcome.title) {
      errors.push(`Report outcome ${outcome.id} is missing title`)
    }
    const checkPatternRefs = (label: string, ids: string[]) => {
      for (const id of ids) {
        if (!patternIds.has(id)) {
          errors.push(
            `Report outcome ${outcome.id} ${label} references unknown pattern: ${id}`,
          )
        }
      }
    }
    checkPatternRefs('requiredPatternIds', outcome.requiredPatternIds)
    checkPatternRefs('forbiddenPatternIds', outcome.forbiddenPatternIds)
    if (outcome.minPatternConfirmedCount < 0) {
      errors.push(
        `Report outcome ${outcome.id} minPatternConfirmedCount must be >= 0`,
      )
    }
  }
  errors.push(...validateOutcomeUniqueness(report.outcomes))
  if (report.sections.length === 0) {
    errors.push('Report has no sections')
  }
  return errors
}

const validateOutcomeUniqueness = (outcomes: ReportOutcome[]): string[] => {
  // ensure no outcome appears in both required and forbidden of the same outcome
  const errors: string[] = []
  for (const outcome of outcomes) {
    const required = new Set(outcome.requiredPatternIds)
    for (const id of outcome.forbiddenPatternIds) {
      if (required.has(id)) {
        errors.push(
          `Report outcome ${outcome.id} has pattern ${id} in both required and forbidden`,
        )
      }
    }
  }
  return errors
}

const validateDebrief = (
  debrief: DebriefEntry[],
  evidenceIds: Set<string>,
): string[] => {
  const errors: string[] = []
  errors.push(...collectDuplicateIds('debrief', debrief.map((d) => d.id)))
  for (const entry of debrief) {
    if (!entry.term) errors.push(`Debrief ${entry.id} is missing term`)
    for (const evidenceId of entry.exampleEvidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(
          `Debrief ${entry.id} exampleEvidenceIds references unknown evidence: ${evidenceId}`,
        )
      }
    }
  }
  return errors
}

export const validateInvestigationContent = (
  content: InvestigationContent,
): string[] => {
  const sourceIds = new Set(content.sources.map((s) => s.id))
  const personIds = new Set(content.persons.map((p) => p.id))
  const evidenceIds = new Set(content.evidence.map((e) => e.id))
  const patternIds = new Set(content.patterns.map((p) => p.id))

  return [
    ...validateCase(content.case, sourceIds, personIds),
    ...validatePersons(content.persons, sourceIds),
    ...validateSources(content.sources, evidenceIds),
    ...validateEvidence(content.evidence, sourceIds, personIds, patternIds),
    ...validatePatterns(content.patterns, evidenceIds),
    ...validateReport(content.report, patternIds),
    ...validateDebrief(content.debrief, evidenceIds),
  ]
}

export class InvestigationContentError extends Error {
  readonly errors: string[]

  constructor(errors: string[]) {
    super(`Invalid investigation content:\n- ${errors.join('\n- ')}`)
    this.name = 'InvestigationContentError'
    this.errors = errors
  }
}

export const assertValidInvestigationContent = (
  content: InvestigationContent,
): void => {
  const errors = validateInvestigationContent(content)
  if (errors.length > 0) {
    throw new InvestigationContentError(errors)
  }
}
