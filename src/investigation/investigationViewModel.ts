// Adapter: converts the canonical InvestigationContent (PR #12) into the
// view-model that DossierApp renders.
//
// The view-model is intentionally narrow and presentational. It does NOT
// carry runtime state (selected fragments, confirmed patterns, drafted
// report). Adding that is a follow-up (PR #10 adaptation).
//
// Visible labels here follow the language guidance from the Dev E brief:
//   - sources are referred to as "материалы";
//   - evidence fragments are referred to as "наблюдения" / "фрагменты";
//   - patterns are referred to as "связи" / "повторяющиеся сигналы";
//   - report draft is referred to as "сводка".
// We intentionally avoid `улика`, `доказательство`, and `love bombing` as
// primary visible labels.

import type {
  CasePerson,
  CaseSource,
  ControlPattern,
  DebriefEntry,
  EvidenceFragment,
  InvestigationContent,
  PersonRole,
  ReportOutcome,
  SourceType,
} from '../game/investigation/types'

export type ReliabilityLevel = 'low' | 'medium' | 'high'
export type RiskBucket = 'low' | 'medium' | 'high' | 'critical'
export type SignalLevel = 'low' | 'medium' | 'high'

export type DossierViewMaterial = {
  id: string
  typeLabel: string
  title: string
  date: string
  origin: string
  reliability: ReliabilityLevel
  reliabilityScore: number
}

export type DossierViewFragment = {
  id: string
  sourceId: string
  speaker: string
  text: string
  highlighted: boolean
}

export type DossierViewPerson = {
  id: string
  name: string
  initials: string
  roleLabel: string
  publicDescription: string
  privateNote: string
  riskLevel: RiskBucket
  influence: number
  credibility: number
}

export type DossierViewPattern = {
  id: string
  title: string
  shortDescription: string
  strongSignals: number
  weakSignals: number
  signalLevel: SignalLevel
}

export type DossierViewObservation = {
  id: string
  sourceId: string
  sourceLabel: string
  text: string
  speaker: string
  linkedPersonName: string | null
  linkedPatternTitle: string | null
  reliability: ReliabilityLevel
  weight: SignalLevel
}

export type DossierViewTimelineEvent = {
  id: string
  date: string
  label: string
  note: string
  tone: 'neutral' | 'warning' | 'risk'
}

export type DossierViewOutcome = {
  id: string
  title: string
  summary: string
}

export type DossierViewDebriefTerm = {
  id: string
  term: string
  shortExplanation: string
}

export type DossierViewProgressChip = {
  label: string
  value: string
}

export type DossierView = {
  number: string
  caseId: string
  title: string
  subtitle: string
  status: string
  publicLegend: string
  investigationQuestion: string
  riskStatement: string
  contentWarning: string
  progressChips: DossierViewProgressChip[]
  materials: DossierViewMaterial[]
  fragmentsBySource: Record<string, DossierViewFragment[]>
  activeMaterialId: string
  observations: DossierViewObservation[]
  persons: DossierViewPerson[]
  patterns: DossierViewPattern[]
  timeline: DossierViewTimelineEvent[]
  outcomes: DossierViewOutcome[]
  debrief: DossierViewDebriefTerm[]
}

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  chat: 'чат',
  landing: 'лендинг',
  testimony: 'свидетельство',
  payment: 'платёжный док',
  videoTranscript: 'эфир',
  socialPost: 'соцсети',
  internalDoc: 'внутренний док',
  diary: 'дневник',
  news: 'новости',
  expertNote: 'эксперт',
}

const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  leader: 'ведущий',
  admin: 'администратор',
  vulnerableParticipant: 'участница в зоне риска',
  exMember: 'бывший участник',
  donor: 'крупный донор',
  recruiter: 'рекрутер',
  relative: 'родственник',
  expert: 'эксперт',
}

function reliabilityBucket(score: number): ReliabilityLevel {
  if (score >= 75) return 'high'
  if (score >= 55) return 'medium'
  return 'low'
}

function riskBucket(score: number): RiskBucket {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

function weightBucket(weight: number): SignalLevel {
  if (weight >= 4) return 'high'
  if (weight >= 3) return 'medium'
  return 'low'
}

function signalLevelFromCounts(strong: number, weak: number): SignalLevel {
  if (strong >= 2) return 'high'
  if (strong >= 1 || weak >= 2) return 'medium'
  return 'low'
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function stripParenthetical(label: string): string {
  return label.replace(/\s*\([^)]+\)\s*$/u, '').trim()
}

function formatShortDate(iso: string): string {
  const months = [
    'янв',
    'фев',
    'мар',
    'апр',
    'мая',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
  ]
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso)
  if (!match) return iso
  const month = months[Number(match[2]) - 1] ?? match[2]
  return `${Number(match[3])} ${month}`
}

function dossierNumberFor(caseId: string, year: string): string {
  const code = caseId
    .split('-')
    .map((part) => part[0] ?? '')
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 3)
  return `${code || 'CASE'}-${year}/01`
}

function buildFragmentsBySource(
  evidence: EvidenceFragment[],
): Record<string, DossierViewFragment[]> {
  const byId: Record<string, DossierViewFragment[]> = {}
  for (const e of evidence) {
    if (!e.defaultVisible) continue
    if (e.isRedHerring) continue
    const f: DossierViewFragment = {
      id: e.id,
      sourceId: e.sourceId,
      speaker: e.speaker,
      text: e.text,
      highlighted: e.weight >= 4 || e.riskTags.length >= 2,
    }
    if (!byId[e.sourceId]) byId[e.sourceId] = []
    byId[e.sourceId].push(f)
  }
  return byId
}

function buildObservations(
  evidence: EvidenceFragment[],
  sourceById: Map<string, CaseSource>,
  personById: Map<string, CasePerson>,
  patternById: Map<string, ControlPattern>,
  limit: number,
): DossierViewObservation[] {
  const ranked = evidence
    .filter((e) => e.defaultVisible && !e.isRedHerring)
    .slice()
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight
      return b.reliability - a.reliability
    })
    .slice(0, limit)
  return ranked.map((e) => {
    const source = sourceById.get(e.sourceId)
    const linkedPerson = e.linksToPersonIds
      .map((id) => personById.get(id))
      .find((p): p is CasePerson => Boolean(p))
    const linkedPattern = e.suggestedPatternIds
      .map((id) => patternById.get(id))
      .find((p): p is ControlPattern => Boolean(p))
    return {
      id: e.id,
      sourceId: e.sourceId,
      sourceLabel: source?.title ?? e.sourceId,
      text: e.text,
      speaker: e.speaker,
      linkedPersonName: linkedPerson?.name ?? null,
      linkedPatternTitle: linkedPattern?.title ?? null,
      reliability: reliabilityBucket(e.reliability),
      weight: weightBucket(e.weight),
    }
  })
}

function buildTimeline(
  evidence: EvidenceFragment[],
  sources: CaseSource[],
  limit: number,
): DossierViewTimelineEvent[] {
  type RawEvent = {
    id: string
    date: string
    label: string
    note: string
    tone: 'neutral' | 'warning' | 'risk'
    sortKey: number
  }
  const events: RawEvent[] = []
  for (const s of sources) {
    events.push({
      id: 'src_' + s.id,
      date: formatShortDate(s.date),
      label: 'материал зафиксирован: ' + s.title.toLowerCase(),
      note: s.origin,
      tone: 'neutral',
      sortKey: Date.parse(s.date) || 0,
    })
  }
  const strong = evidence
    .filter((e) => e.defaultVisible && !e.isRedHerring && e.weight >= 4)
    .slice()
    .sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0))
  for (const e of strong) {
    const isRisky = e.riskTags.length >= 1
    events.push({
      id: 'ev_' + e.id,
      date: formatShortDate(e.date),
      label: 'наблюдение: ' + (e.speaker ? e.speaker.toLowerCase() : 'материал'),
      note: e.text,
      tone: isRisky ? 'risk' : 'warning',
      sortKey: Date.parse(e.date) || 0,
    })
  }
  events.sort((a, b) => a.sortKey - b.sortKey)
  return events.slice(0, limit).map((event) => ({
    id: event.id,
    date: event.date,
    label: event.label,
    note: event.note,
    tone: event.tone,
  }))
}

function buildOutcomes(outcomes: ReportOutcome[]): DossierViewOutcome[] {
  return outcomes.map((o) => ({
    id: o.id,
    title: o.title,
    summary: o.summary,
  }))
}

function buildDebrief(debrief: DebriefEntry[], limit: number): DossierViewDebriefTerm[] {
  return debrief.slice(0, limit).map((d) => ({
    id: d.id,
    term: stripParenthetical(d.term),
    shortExplanation: d.shortExplanation,
  }))
}

export function buildDossierView(content: InvestigationContent): DossierView {
  const { case: c, persons, sources, evidence, patterns, report, debrief } = content
  const sourceById = new Map(sources.map((s) => [s.id, s]))
  const personById = new Map(persons.map((p) => [p.id, p]))
  const patternById = new Map(patterns.map((p) => [p.id, p]))

  const materials: DossierViewMaterial[] = sources.map((s) => ({
    id: s.id,
    typeLabel: SOURCE_TYPE_LABELS[s.type] ?? s.type,
    title: s.title,
    date: formatShortDate(s.date),
    origin: s.origin,
    reliability: reliabilityBucket(s.reliability),
    reliabilityScore: s.reliability,
  }))

  const fragmentsBySource = buildFragmentsBySource(evidence)
  const observations = buildObservations(
    evidence,
    sourceById,
    personById,
    patternById,
    4,
  )

  const personsView: DossierViewPerson[] = persons.map((p) => ({
    id: p.id,
    name: p.name,
    initials: getInitials(p.name),
    roleLabel: PERSON_ROLE_LABELS[p.role] ?? p.role,
    publicDescription: p.publicDescription,
    privateNote: p.privateNotes,
    riskLevel: riskBucket(p.riskLevel),
    influence: p.influenceLevel,
    credibility: p.credibility,
  }))

  const patternsView: DossierViewPattern[] = patterns.map((p) => {
    const strong = p.strongEvidenceIds.length
    const weak = p.weakEvidenceIds.length
    return {
      id: p.id,
      title: p.title,
      shortDescription: p.shortDescription,
      strongSignals: strong,
      weakSignals: weak,
      signalLevel: signalLevelFromCounts(strong, weak),
    }
  })

  const timeline = buildTimeline(evidence, sources, 6)
  const outcomes = buildOutcomes(report.outcomes)
  const debriefView = buildDebrief(debrief, 6)

  const year = (() => {
    const firstDate = sources[0]?.date ?? ''
    return /^(\d{4})/u.exec(firstDate)?.[1] ?? '2025'
  })()

  const visibleEvidenceCount = evidence.filter(
    (e) => e.defaultVisible && !e.isRedHerring,
  ).length

  const progressChips: DossierViewProgressChip[] = [
    { label: 'материалов', value: String(sources.length) },
    { label: 'фрагментов в обзоре', value: String(visibleEvidenceCount) },
    { label: 'наблюдений под отслеживанием', value: String(patterns.length) },
    { label: 'людей', value: String(persons.length) },
  ]

  const activeMaterialId =
    c.initialSourceIds.find((id) => sourceById.has(id)) ??
    sources[0]?.id ??
    ''

  return {
    number: dossierNumberFor(c.id, year),
    caseId: c.id,
    title: c.title,
    subtitle: c.subtitle,
    status: 'в работе',
    publicLegend: c.publicLegend,
    investigationQuestion: c.investigationQuestion,
    riskStatement: c.riskStatement,
    contentWarning: c.contentWarning,
    progressChips,
    materials,
    fragmentsBySource,
    activeMaterialId,
    observations,
    persons: personsView,
    patterns: patternsView,
    timeline,
    outcomes,
    debrief: debriefView,
  }
}
