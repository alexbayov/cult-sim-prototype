import infoCaseManifest from '../cases/info-business-marathon/case.json'
import infoPersons from '../cases/info-business-marathon/persons.json'
import infoSources from '../cases/info-business-marathon/sources.json'
import infoEvidence from '../cases/info-business-marathon/evidence.json'
import infoPatterns from '../cases/info-business-marathon/patterns.json'
import infoReport from '../cases/info-business-marathon/report.json'
import infoDebrief from '../cases/info-business-marathon/debrief.json'

import proryv01CaseManifest from '../cases/case-01-proryv/case.json'
import proryv01Hypotheses from '../cases/case-01-proryv/hypotheses.json'
import proryv01Documents from '../cases/case-01-proryv/documents.json'
import proryv01Contacts from '../cases/case-01-proryv/contacts.json'
import proryv01Interviews from '../cases/case-01-proryv/interviews.json'
import proryv01Actions from '../cases/case-01-proryv/actions.json'
import proryv01Recommendations from '../cases/case-01-proryv/recommendations.json'
import proryv01Epilogues from '../cases/case-01-proryv/epilogues.json'

import familyCaseManifest from '../cases/family-retreat-center/case.json'
import familyPersons from '../cases/family-retreat-center/persons.json'
import familySources from '../cases/family-retreat-center/sources.json'
import familyEvidence from '../cases/family-retreat-center/evidence.json'
import familyPatterns from '../cases/family-retreat-center/patterns.json'
import familyReport from '../cases/family-retreat-center/report.json'
import familyDebrief from '../cases/family-retreat-center/debrief.json'

import type {
  CasePerson,
  CaseSource,
  CaseV2,
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

export const case01ProryInvestigation: CaseV2 = {
  schemaVersion: 'v2',
  ...(proryv01CaseManifest as Omit<CaseV2, 'schemaVersion' | 'hypotheses' | 'documents' | 'contacts' | 'interviews' | 'actions' | 'recommendations' | 'epilogues'>),
  hypotheses: proryv01Hypotheses as CaseV2['hypotheses'],
  documents: proryv01Documents as CaseV2['documents'],
  contacts: proryv01Contacts as CaseV2['contacts'],
  interviews: proryv01Interviews as CaseV2['interviews'],
  actions: proryv01Actions as CaseV2['actions'],
  recommendations: proryv01Recommendations as CaseV2['recommendations'],
  epilogues: proryv01Epilogues as CaseV2['epilogues'],
}

// Stable list of all investigation contents available in this build. Callers
// (validator, future case picker, etc.) should iterate this instead of
// referencing individual exports.
export const investigationContents: ReadonlyArray<InvestigationContent> = [
  infoBusinessMarathonInvestigation,
  familyRetreatCenterInvestigation,
]

export const investigationContentsV2: ReadonlyArray<CaseV2> = [
  case01ProryInvestigation,
]

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

export {
  assertValidInvestigationContent,
  InvestigationContentError,
  validateInvestigationContent,
}
