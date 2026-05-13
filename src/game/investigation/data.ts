import infoCaseManifest from '../cases/info-business-marathon/case.json'
import infoPersons from '../cases/info-business-marathon/persons.json'
import infoSources from '../cases/info-business-marathon/sources.json'
import infoEvidence from '../cases/info-business-marathon/evidence.json'
import infoPatterns from '../cases/info-business-marathon/patterns.json'
import infoReport from '../cases/info-business-marathon/report.json'
import infoDebrief from '../cases/info-business-marathon/debrief.json'

import familyCaseManifest from '../cases/family-retreat-center/case.json'
import familyPersons from '../cases/family-retreat-center/persons.json'
import familySources from '../cases/family-retreat-center/sources.json'
import familyEvidence from '../cases/family-retreat-center/evidence.json'
import familyPatterns from '../cases/family-retreat-center/patterns.json'
import familyReport from '../cases/family-retreat-center/report.json'
import familyDebrief from '../cases/family-retreat-center/debrief.json'

import case01Manifest from '../cases/case-01-proryv/case.json'
import case01Hypotheses from '../cases/case-01-proryv/hypotheses.json'
import case01Documents from '../cases/case-01-proryv/documents.json'
import case01Contacts from '../cases/case-01-proryv/contacts.json'
import case01Interviews from '../cases/case-01-proryv/interviews.json'
import case01Actions from '../cases/case-01-proryv/actions.json'
import case01Recommendations from '../cases/case-01-proryv/recommendations.json'
import case01Epilogues from '../cases/case-01-proryv/epilogues.json'

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
  CaseV2Manifest,
  Hypothesis,
  CaseDocument,
  Contact,
  Interview,
  CaseAction,
  Recommendation,
  Epilogue,
} from './types'
import {
  assertValidInvestigationContent,
  InvestigationContentError,
  validateCaseV2Content,
  validateInvestigationContent,
} from './contentSchema'

// JSON modules come in as widened types (e.g. `string` instead of literal
// unions). We cast through the typed shapes here so the rest of the codebase
// can use the precise InvestigationContent type without sprinkling casts.
export const infoBusinessMarathonInvestigation: InvestigationContent = {
  case: infoCaseManifest as InvestigationCase,
  persons: infoPersons as CasePerson[],
  sources: infoSources as CaseSource[],
  evidence: infoEvidence as EvidenceFragment[],
  patterns: infoPatterns as ControlPattern[],
  report: infoReport as ReportContent,
  debrief: infoDebrief as DebriefEntry[],
}

export const familyRetreatCenterInvestigation: InvestigationContent = {
  case: familyCaseManifest as InvestigationCase,
  persons: familyPersons as CasePerson[],
  sources: familySources as CaseSource[],
  evidence: familyEvidence as EvidenceFragment[],
  patterns: familyPatterns as ControlPattern[],
  report: familyReport as ReportContent,
  debrief: familyDebrief as DebriefEntry[],
}

// Stable list of all investigation contents available in this build. Callers
// (validator, future case picker, etc.) should iterate this instead of
// referencing individual exports.
export const investigationContents: ReadonlyArray<InvestigationContent> = [
  infoBusinessMarathonInvestigation,
  familyRetreatCenterInvestigation,
]

export const caseProryvV2: CaseV2 = {
  ...(case01Manifest as CaseV2Manifest),
  hypotheses: case01Hypotheses as Hypothesis[],
  documents: case01Documents as CaseDocument[],
  contacts: case01Contacts as Contact[],
  interviews: case01Interviews as Interview[],
  actions: case01Actions as CaseAction[],
  recommendations: case01Recommendations as Recommendation[],
  epilogues: case01Epilogues as Epilogue[],
}

export const v2Cases: ReadonlyArray<CaseV2> = [caseProryvV2]

// Validate every bundled case on import: log loudly so a bad JSON edit shows
// up in the dev console immediately, but don't throw so the rest of the app
// (including the legacy scenario prototype) keeps loading. Callers that want
// strict behavior can use `assertValidInvestigationContent` directly.
for (const content of investigationContents) {
  const importErrors = validateInvestigationContent(content)
  if (importErrors.length > 0) {
    console.error(
      `Investigation content validation failed for case "${content.case.id}":\n- ` +
        importErrors.join('\n- '),
    )
  }
}

for (const content of v2Cases) {
  const importErrors = validateCaseV2Content(content)
  if (importErrors.length > 0) {
    console.error(
      `Investigation v2 content validation failed for case "${content.id}":\n- ` +
        importErrors.join('\n- '),
    )
  }
}

export {
  assertValidInvestigationContent,
  InvestigationContentError,
  validateInvestigationContent,
}
