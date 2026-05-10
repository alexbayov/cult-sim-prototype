import caseManifest from '../cases/info-business-marathon/case.json'
import persons from '../cases/info-business-marathon/persons.json'
import sources from '../cases/info-business-marathon/sources.json'
import evidence from '../cases/info-business-marathon/evidence.json'
import patterns from '../cases/info-business-marathon/patterns.json'
import report from '../cases/info-business-marathon/report.json'
import debrief from '../cases/info-business-marathon/debrief.json'

import type {
  CasePerson,
  CaseSource,
  ControlPattern,
  DebriefEntry,
  EvidenceFragment,
  InvestigationCase,
  InvestigationContent,
  ReportContent,
} from './types'
import {
  assertValidInvestigationContent,
  InvestigationContentError,
  validateInvestigationContent,
} from './contentSchema'

// JSON modules come in as widened types (e.g. `string` instead of literal
// unions). We cast through the typed shapes here so the rest of the codebase
// can use the precise InvestigationContent type without sprinkling casts.
export const infoBusinessMarathonInvestigation: InvestigationContent = {
  case: caseManifest as InvestigationCase,
  persons: persons as CasePerson[],
  sources: sources as CaseSource[],
  evidence: evidence as EvidenceFragment[],
  patterns: patterns as ControlPattern[],
  report: report as ReportContent,
  debrief: debrief as DebriefEntry[],
}

// Validate on import: log loudly so a bad JSON edit shows up in the dev
// console immediately, but don't throw so the rest of the app (including the
// legacy scenario prototype) keeps loading. Callers that want strict behavior
// can use `assertValidInvestigationContent` directly.
const importErrors = validateInvestigationContent(
  infoBusinessMarathonInvestigation,
)
if (importErrors.length > 0) {
  console.error(
    'Investigation content validation failed:\n- ' +
      importErrors.join('\n- '),
  )
}

export {
  assertValidInvestigationContent,
  InvestigationContentError,
  validateInvestigationContent,
}
