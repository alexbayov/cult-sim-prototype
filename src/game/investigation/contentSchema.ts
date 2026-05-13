import type {
  CasePerson,
  CaseSource,
  ControlPattern,
  DebriefEntry,
  EvidenceFragment,
  InvestigationCase,
  InvestigationContent,
  ReportContent,
  CaseV2,
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


const validateCaseV2 = (content: CaseV2): string[] => {
  const errors: string[] = []
  if (content.schemaVersion !== 'v2') {
    errors.push(`CaseV2 ${content.id} schemaVersion must be v2`)
  }
  if (!content.id) errors.push('CaseV2 is missing id')
  if (!content.title) errors.push(`CaseV2 ${content.id} is missing title`)
  if (!content.protagonist?.name) {
    errors.push(`CaseV2 ${content.id} is missing protagonist.name`)
  }
  if (!content.brief?.from) errors.push(`CaseV2 ${content.id} is missing brief.from`)
  if (!content.brief?.body) errors.push(`CaseV2 ${content.id} is missing brief.body`)
  if (!Number.isFinite(content.actionBudget) || content.actionBudget < 0) {
    errors.push(`CaseV2 ${content.id} actionBudget must be non-negative`)
  }

  errors.push(...collectDuplicateIds('hypothesis', content.hypotheses.map((h) => h.id)))
  errors.push(...collectDuplicateIds('document', content.documents.map((d) => d.id)))
  errors.push(...collectDuplicateIds('contact', content.contacts.map((c) => c.id)))
  errors.push(...collectDuplicateIds('interview', content.interviews.map((i) => i.id)))
  errors.push(...collectDuplicateIds('action', content.actions.map((a) => a.id)))
  errors.push(
    ...collectDuplicateIds('recommendation', content.recommendations.map((r) => r.id)),
  )
  errors.push(...collectDuplicateIds('epilogue', content.epilogues.map((e) => e.id)))

  const hypothesisIds = new Set(content.hypotheses.map((h) => h.id))
  const documentIds = new Set(content.documents.map((d) => d.id))
  const contactIds = new Set(content.contacts.map((c) => c.id))
  const interviewIds = new Set(content.interviews.map((i) => i.id))
  const actionIds = new Set(content.actions.map((a) => a.id))
  const recommendationIds = new Set(content.recommendations.map((r) => r.id))

  for (const document of content.documents) {
    if (!document.title) errors.push(`Document ${document.id} is missing title`)
    if (!document.body) errors.push(`Document ${document.id} is missing body`)
    for (let i = 0; i < document.keyPhrases.length; i++) {
      const keyPhrase = document.keyPhrases[i]
      const where = `Document ${document.id}.keyPhrases[${i}]`
      const [start, end] = keyPhrase.range
      if (start < 0 || end > document.body.length || start >= end) {
        errors.push(`${where}.range out of [0, ${document.body.length}) or non-positive width`)
      }
      if (keyPhrase.effects.length === 0) errors.push(`${where}.effects must be non-empty`)
      for (const effect of keyPhrase.effects) {
        if (!hypothesisIds.has(effect.hypothesisId)) {
          errors.push(`${where}.effects hypothesis unknown: ${effect.hypothesisId}`)
        }
        if (!['strong', 'weak', 'counter'].includes(effect.weight)) {
          errors.push(`${where}.effects weight must be strong|weak|counter`)
        }
      }
    }
    if (document.unlockedByAction && !actionIds.has(document.unlockedByAction)) {
      errors.push(`Document ${document.id} unlockedByAction unknown: ${document.unlockedByAction}`)
    }
  }

  for (const contact of content.contacts) {
    if (!interviewIds.has(contact.interviewId)) {
      errors.push(`Contact ${contact.id} interviewId unknown: ${contact.interviewId}`)
    }
    const gate = contact.gateRequirement
    if (gate?.requiredHypothesis && !hypothesisIds.has(gate.requiredHypothesis)) {
      errors.push(
        `Contact ${contact.id} gateRequirement.requiredHypothesis unknown: ${gate.requiredHypothesis}`,
      )
    }
    if (gate?.requiredDocumentId && !documentIds.has(gate.requiredDocumentId)) {
      errors.push(
        `Contact ${contact.id} gateRequirement.requiredDocumentId unknown: ${gate.requiredDocumentId}`,
      )
    }
    if (contact.initialState === 'gated' && !gate?.requiredHypothesis && !gate?.requiredDocumentId) {
      errors.push(`Contact ${contact.id} is gated but has no gate requirement`)
    }
  }

  for (const interview of content.interviews) {
    if (!contactIds.has(interview.contactId)) {
      errors.push(`Interview ${interview.id} contactId unknown: ${interview.contactId}`)
    }
    const nodeIds = new Set(interview.nodes.map((node) => node.id))
    if (!nodeIds.has(interview.startNodeId)) {
      errors.push(`Interview ${interview.id} startNodeId unknown: ${interview.startNodeId}`)
    }
    for (const node of interview.nodes) {
      if (node.next !== undefined && !nodeIds.has(node.next)) {
        errors.push(`Interview ${interview.id} node ${node.id} next unknown: ${node.next}`)
      }
      for (const choice of node.choices ?? []) {
        if (!nodeIds.has(choice.next)) {
          errors.push(
            `Interview ${interview.id} node ${node.id} choice ${choice.id} next unknown: ${choice.next}`,
          )
        }
        if (
          choice.requiresPhraseFromHypothesis &&
          !hypothesisIds.has(choice.requiresPhraseFromHypothesis)
        ) {
          errors.push(
            `Interview ${interview.id} node ${node.id} choice ${choice.id} requiresPhraseFromHypothesis unknown: ${choice.requiresPhraseFromHypothesis}`,
          )
        }
      }
    }
  }

  for (const action of content.actions) {
    if (action.cost < 0) errors.push(`Action ${action.id} cost must be non-negative`)
    for (const effect of action.effects) {
      if (effect.kind === 'unlockDocument' && !documentIds.has(effect.documentId)) {
        errors.push(`Action ${action.id} unlockDocument unknown: ${effect.documentId}`)
      }
      if (effect.kind === 'unlockContact' && !contactIds.has(effect.contactId)) {
        errors.push(`Action ${action.id} unlockContact unknown: ${effect.contactId}`)
      }
    }
  }

  for (const recommendation of content.recommendations) {
    for (const requirement of recommendation.requiresHypotheses) {
      if (!hypothesisIds.has(requirement.hypothesisId)) {
        errors.push(
          `Recommendation ${recommendation.id} requiresHypotheses unknown: ${requirement.hypothesisId}`,
        )
      }
    }
  }

  const qualitiesByRecommendation = new Map<string, Set<string>>()
  for (const epilogue of content.epilogues) {
    if (!recommendationIds.has(epilogue.recommendationId)) {
      errors.push(`Epilogue ${epilogue.id} recommendationId unknown: ${epilogue.recommendationId}`)
    }
    const qualities = qualitiesByRecommendation.get(epilogue.recommendationId) ?? new Set<string>()
    qualities.add(epilogue.quality)
    qualitiesByRecommendation.set(epilogue.recommendationId, qualities)
  }
  for (const recommendation of content.recommendations) {
    for (const quality of ['precise', 'imprecise', 'incorrect']) {
      if (!(qualitiesByRecommendation.get(recommendation.id)?.has(quality) ?? false)) {
        errors.push(`Recommendation ${recommendation.id} missing ${quality} epilogue`)
      }
    }
  }

  return errors
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

export const validateCaseV2Content = (content: CaseV2): string[] =>
  validateCaseV2(content)

export const assertValidCaseV2Content = (content: CaseV2): void => {
  const errors = validateCaseV2Content(content)
  if (errors.length > 0) {
    throw new InvestigationContentError(errors)
  }
}
