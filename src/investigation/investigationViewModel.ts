// Adapter: converts the canonical InvestigationContent (PR #12) into the
// view-model that DossierApp renders.
//
// Two layers of behaviour are exposed:
//   - The base view-model (sources, fragments, patterns, persons, timeline,
//     etc.) is purely a presentational projection of the static case content.
//   - On top of that, an optional `Selection` snapshot drives runtime state:
//     which fragments are marked, which materials have been unlocked by those
//     marks, which signals are now considered confirmed, and what summary
//     would land if the user submitted the case right now.
//
// Visible labels here follow the language guidance from the Dev E brief:
//   - sources are referred to as "материалы";
//   - evidence fragments are referred to as "наблюдения" / "фрагменты" /
//     "закладки" once marked;
//   - patterns are referred to as "связи" / "повторяющиеся сигналы";
//   - the report is referred to as "сводка".
// We intentionally avoid `улика`, `доказательство`, `паттерн`, and
// `love bombing` as primary visible labels.

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

export type ConnectionStatus =
  | 'unmarked'
  | 'weak'
  | 'partial'
  | 'strong'
  | 'contradicted'

export type Selection = {
  selectedFragmentIds: ReadonlySet<string>
  reportSubmitted: boolean
}

export const emptySelection: Selection = {
  selectedFragmentIds: new Set<string>(),
  reportSubmitted: false,
}

export type DossierViewMaterial = {
  id: string
  typeLabel: string
  title: string
  date: string
  origin: string
  reliability: ReliabilityLevel
  reliabilityScore: number
  locked: boolean
  lockedHint: string | null
  // When this material was opened by a player's bookmark, surface a short
  // preview of the *first* bookmark (in selection insertion order) that
  // unlocked it. Stays `null` for materials in `initialSourceIds` and for
  // materials that are still locked. Preview is capped at 80 characters
  // with ellipsis so the renderer can drop it inline without re-trimming.
  unlockedByFragment: { fragmentId: string; fragmentText: string } | null
}

export type DossierViewFragment = {
  id: string
  sourceId: string
  speaker: string
  text: string
  highlighted: boolean
  selected: boolean
  unlocksHint: string | null
  // Title of the first suggested pattern for this fragment, used to render
  // a faint «связано с: …» line under the fragment text. `null` if the
  // fragment has no suggested pattern. `linkedPatternExtraCount` is the
  // number of *additional* suggested patterns (0 if only one).
  linkedPatternTitle: string | null
  linkedPatternExtraCount: number
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
  connectionStatus: ConnectionStatus
  markedCount: number
  targetCount: number
  contradictedCount: number
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

export type DossierViewReport = {
  outcomeId: string
  title: string
  summary: string
  recommendedFraming: string
  notes: string[]
  confirmedPatternTitles: string[]
  supportedPatternTitles: string[]
  suspectedPatternTitles: string[]
  contradictedPatternTitles: string[]
  strongestFragmentTexts: string[]
  gapPatternTitles: string[]
}

export type DossierViewSelectionSummary = {
  selectedCount: number
  visibleFragmentCount: number
  unlockedMaterialCount: number
  totalMaterialCount: number
  confirmedPatternCount: number
  totalPatternCount: number
  // Titles of materials that are currently unlocked but were NOT in the
  // case's `initialSourceIds`. Used by ProgressNudge to name what just
  // opened up; ordered as in the case's `sources` list for stability.
  unlockedSinceStartTitles: string[]
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
  selectedObservations: DossierViewObservation[]
  persons: DossierViewPerson[]
  patterns: DossierViewPattern[]
  timeline: DossierViewTimelineEvent[]
  outcomes: DossierViewOutcome[]
  debrief: DossierViewDebriefTerm[]
  selectionSummary: DossierViewSelectionSummary
  report: DossierViewReport | null
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

function computeUnlockedMaterialIds(
  content: InvestigationContent,
  selection: Selection,
): { unlocked: Set<string>; lockedHintBySource: Map<string, string> } {
  const initial = new Set<string>(content.case.initialSourceIds)
  const unlocked = new Set<string>()
  for (const s of content.sources) {
    if (initial.has(s.id) || s.unlockedByEvidenceIds.length === 0) {
      unlocked.add(s.id)
    }
  }
  // Bidirectional unlock: a selected fragment can list `unlocksSourceIds`,
  // and a source can list `unlockedByEvidenceIds` — honour both.
  for (const id of selection.selectedFragmentIds) {
    const ev = content.evidence.find((e) => e.id === id)
    if (!ev) continue
    for (const sid of ev.unlocksSourceIds) unlocked.add(sid)
  }
  for (const s of content.sources) {
    if (unlocked.has(s.id)) continue
    if (
      s.unlockedByEvidenceIds.some((eid) =>
        selection.selectedFragmentIds.has(eid),
      )
    ) {
      unlocked.add(s.id)
    }
  }

  const evidenceById = new Map(content.evidence.map((e) => [e.id, e]))
  const sourceById = new Map(content.sources.map((s) => [s.id, s]))
  const lockedHintBySource = new Map<string, string>()
  for (const s of content.sources) {
    if (unlocked.has(s.id)) continue
    const sources = new Set<string>()
    for (const eid of s.unlockedByEvidenceIds) {
      const ev = evidenceById.get(eid)
      if (!ev) continue
      const src = sourceById.get(ev.sourceId)
      if (src) sources.add(src.title)
    }
    if (sources.size > 0) {
      const list = Array.from(sources).join(', ')
      lockedHintBySource.set(s.id, `откроется через фрагмент из: ${list}`)
    } else {
      lockedHintBySource.set(s.id, 'закрытый материал')
    }
  }
  return { unlocked, lockedHintBySource }
}

function computePatternConnection(
  pattern: ControlPattern,
  selection: Selection,
): {
  status: ConnectionStatus
  marked: number
  contradicted: number
} {
  const sel = selection.selectedFragmentIds
  const strong = pattern.strongEvidenceIds.filter((id) => sel.has(id)).length
  const weak = pattern.weakEvidenceIds.filter((id) => sel.has(id)).length
  const counter = pattern.counterEvidenceIds.filter((id) => sel.has(id)).length
  if (counter > 0) {
    return { status: 'contradicted', marked: strong + weak, contradicted: counter }
  }
  const linked = strong + weak
  if (linked === 0) return { status: 'unmarked', marked: 0, contradicted: 0 }
  if (strong >= pattern.requiredEvidenceCount && pattern.requiredEvidenceCount > 0) {
    return { status: 'strong', marked: linked, contradicted: 0 }
  }
  if (strong === 0) return { status: 'weak', marked: linked, contradicted: 0 }
  return { status: 'partial', marked: linked, contradicted: 0 }
}

function buildFragmentsBySource(
  content: InvestigationContent,
  selection: Selection,
  patternById: Map<string, ControlPattern>,
): Record<string, DossierViewFragment[]> {
  const sourceById = new Map(content.sources.map((s) => [s.id, s]))
  const byId: Record<string, DossierViewFragment[]> = {}
  for (const e of content.evidence) {
    if (!e.defaultVisible) continue
    if (e.isRedHerring) continue
    const unlocksHint =
      e.unlocksSourceIds.length > 0
        ? e.unlocksSourceIds
            .map((sid) => sourceById.get(sid)?.title)
            .filter(Boolean)
            .map((t) => `открывает материал: ${t}`)
            .join('; ') || null
        : null
    const linkedPatternIds = e.suggestedPatternIds.filter((pid) =>
      patternById.has(pid),
    )
    const linkedPatternTitle =
      linkedPatternIds.length > 0
        ? patternById.get(linkedPatternIds[0])?.title ?? null
        : null
    const linkedPatternExtraCount = Math.max(0, linkedPatternIds.length - 1)
    const f: DossierViewFragment = {
      id: e.id,
      sourceId: e.sourceId,
      speaker: e.speaker,
      text: e.text,
      highlighted: e.weight >= 4 || e.riskTags.length >= 2,
      selected: selection.selectedFragmentIds.has(e.id),
      unlocksHint,
      linkedPatternTitle,
      linkedPatternExtraCount,
    }
    if (!byId[e.sourceId]) byId[e.sourceId] = []
    byId[e.sourceId].push(f)
  }
  return byId
}

function truncatePreview(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

function computeUnlockedByFragment(
  content: InvestigationContent,
  selection: Selection,
  unlockedIds: ReadonlySet<string>,
): Map<string, { fragmentId: string; fragmentText: string }> {
  const initial = new Set<string>(content.case.initialSourceIds)
  const evidenceById = new Map(content.evidence.map((e) => [e.id, e]))
  // Source -> set of evidence ids that can unlock it (either direction).
  const unlockersBySource = new Map<string, Set<string>>()
  for (const s of content.sources) {
    if (initial.has(s.id)) continue
    const set = new Set<string>(s.unlockedByEvidenceIds)
    unlockersBySource.set(s.id, set)
  }
  for (const e of content.evidence) {
    for (const sid of e.unlocksSourceIds) {
      if (initial.has(sid)) continue
      const set = unlockersBySource.get(sid)
      if (set) set.add(e.id)
      else unlockersBySource.set(sid, new Set<string>([e.id]))
    }
  }
  const out = new Map<string, { fragmentId: string; fragmentText: string }>()
  // Iterate selection in insertion order; the first selected fragment that
  // is a valid unlocker for a still-unmapped material wins.
  for (const fragmentId of selection.selectedFragmentIds) {
    for (const [sourceId, unlockers] of unlockersBySource) {
      if (out.has(sourceId)) continue
      if (!unlockedIds.has(sourceId)) continue
      if (!unlockers.has(fragmentId)) continue
      const ev = evidenceById.get(fragmentId)
      if (!ev) continue
      out.set(sourceId, {
        fragmentId,
        fragmentText: truncatePreview(ev.text, 80),
      })
    }
  }
  return out
}

function makeObservation(
  e: EvidenceFragment,
  sourceById: Map<string, CaseSource>,
  personById: Map<string, CasePerson>,
  patternById: Map<string, ControlPattern>,
): DossierViewObservation {
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
}

function buildPreviewObservations(
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
  return ranked.map((e) => makeObservation(e, sourceById, personById, patternById))
}

function buildSelectedObservations(
  content: InvestigationContent,
  selection: Selection,
  sourceById: Map<string, CaseSource>,
  personById: Map<string, CasePerson>,
  patternById: Map<string, ControlPattern>,
): DossierViewObservation[] {
  const out: DossierViewObservation[] = []
  for (const e of content.evidence) {
    if (!selection.selectedFragmentIds.has(e.id)) continue
    out.push(makeObservation(e, sourceById, personById, patternById))
  }
  out.sort((a, b) => {
    const weightOrder: Record<SignalLevel, number> = { high: 0, medium: 1, low: 2 }
    if (weightOrder[a.weight] !== weightOrder[b.weight]) {
      return weightOrder[a.weight] - weightOrder[b.weight]
    }
    return 0
  })
  return out
}

function buildTimeline(
  content: InvestigationContent,
  selection: Selection,
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

  const hasSelection = selection.selectedFragmentIds.size > 0
  if (!hasSelection) {
    for (const s of content.sources) {
      events.push({
        id: 'src_' + s.id,
        date: formatShortDate(s.date),
        label: 'материал зафиксирован: ' + s.title.toLowerCase(),
        note: s.origin,
        tone: 'neutral',
        sortKey: Date.parse(s.date) || 0,
      })
    }
    const strong = content.evidence
      .filter((e) => e.defaultVisible && !e.isRedHerring && e.weight >= 4)
      .slice()
      .sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0))
    for (const e of strong) {
      const isRisky = e.riskTags.length >= 1
      events.push({
        id: 'ev_' + e.id,
        date: formatShortDate(e.date),
        label:
          'наблюдение: ' + (e.speaker ? e.speaker.toLowerCase() : 'материал'),
        note: e.text,
        tone: isRisky ? 'risk' : 'warning',
        sortKey: Date.parse(e.date) || 0,
      })
    }
  } else {
    const selected = content.evidence.filter((e) =>
      selection.selectedFragmentIds.has(e.id),
    )
    selected.sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0))
    for (const e of selected) {
      const isRisky = e.riskTags.length >= 1
      const isStrong = e.weight >= 4
      events.push({
        id: 'ev_' + e.id,
        date: formatShortDate(e.date),
        label:
          'закладка: ' + (e.speaker ? e.speaker.toLowerCase() : 'материал'),
        note: e.text,
        tone: isRisky ? 'risk' : isStrong ? 'warning' : 'neutral',
        sortKey: Date.parse(e.date) || 0,
      })
    }
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

function pickOutcome(
  outcomes: ReportOutcome[],
  confirmedPatternIds: ReadonlySet<string>,
  hasRedHerring: boolean,
): ReportOutcome | null {
  if (outcomes.length === 0) return null
  const eligible = outcomes.filter(
    (o) =>
      o.requiredPatternIds.every((id) => confirmedPatternIds.has(id)) &&
      !o.forbiddenPatternIds.some((id) => confirmedPatternIds.has(id)) &&
      o.minPatternConfirmedCount <= confirmedPatternIds.size,
  )
  if (eligible.length === 0) return outcomes[0]

  eligible.sort((a, b) => {
    if (a.minPatternConfirmedCount !== b.minPatternConfirmedCount) {
      return b.minPatternConfirmedCount - a.minPatternConfirmedCount
    }
    if (a.requiredPatternIds.length !== b.requiredPatternIds.length) {
      return b.requiredPatternIds.length - a.requiredPatternIds.length
    }
    return 0
  })

  const pick = eligible[0]

  if (
    hasRedHerring &&
    confirmedPatternIds.size === 0 &&
    pick.minPatternConfirmedCount === 0
  ) {
    const misread = outcomes.find(
      (o) =>
        o.id === 'ro_misread' &&
        !o.forbiddenPatternIds.some((id) => confirmedPatternIds.has(id)),
    )
    if (misread) return misread
  }

  return pick
}

function buildReport(
  content: InvestigationContent,
  selection: Selection,
  patternConnections: Map<string, ConnectionStatus>,
  patternById: Map<string, ControlPattern>,
): DossierViewReport | null {
  if (!selection.reportSubmitted) return null

  const confirmedIds = new Set<string>()
  const supported: string[] = []
  const suspected: string[] = []
  const contradicted: string[] = []
  const gaps: string[] = []

  for (const p of content.patterns) {
    const status = patternConnections.get(p.id) ?? 'unmarked'
    if (status === 'strong') confirmedIds.add(p.id)
    if (status === 'partial') supported.push(p.title)
    if (status === 'weak') suspected.push(p.title)
    if (status === 'contradicted') contradicted.push(p.title)
    if (status === 'unmarked') gaps.push(p.title)
  }

  const confirmedTitles = Array.from(confirmedIds)
    .map((id) => patternById.get(id)?.title ?? id)
    .filter(Boolean)

  const redHerringSelected = content.evidence.some(
    (e) => selection.selectedFragmentIds.has(e.id) && e.isRedHerring,
  )

  const outcome = pickOutcome(
    content.report.outcomes,
    confirmedIds,
    redHerringSelected,
  )
  if (!outcome) return null

  const strongestFragmentTexts: string[] = content.evidence
    .filter(
      (e) =>
        selection.selectedFragmentIds.has(e.id) &&
        !e.isRedHerring &&
        e.weight >= 3,
    )
    .sort((a, b) => b.weight - a.weight || b.reliability - a.reliability)
    .slice(0, 3)
    .map((e) => e.text)

  return {
    outcomeId: outcome.id,
    title: outcome.title,
    summary: outcome.summary,
    recommendedFraming: outcome.recommendedFraming,
    notes: outcome.notes,
    confirmedPatternTitles: confirmedTitles,
    supportedPatternTitles: supported,
    suspectedPatternTitles: suspected,
    contradictedPatternTitles: contradicted,
    strongestFragmentTexts,
    gapPatternTitles: gaps,
  }
}

export function buildDossierView(
  content: InvestigationContent,
  selection: Selection = emptySelection,
): DossierView {
  const { case: c, persons, sources, evidence, patterns, report, debrief } = content
  const sourceById = new Map(sources.map((s) => [s.id, s]))
  const personById = new Map(persons.map((p) => [p.id, p]))
  const patternById = new Map(patterns.map((p) => [p.id, p]))

  const { unlocked: unlockedIds, lockedHintBySource } = computeUnlockedMaterialIds(
    content,
    selection,
  )

  const materials: DossierViewMaterial[] = sources.map((s) => ({
    id: s.id,
    typeLabel: SOURCE_TYPE_LABELS[s.type] ?? s.type,
    title: s.title,
    date: formatShortDate(s.date),
    origin: s.origin,
    reliability: reliabilityBucket(s.reliability),
    reliabilityScore: s.reliability,
    locked: !unlockedIds.has(s.id),
    lockedHint: unlockedIds.has(s.id) ? null : lockedHintBySource.get(s.id) ?? null,
    unlockedByFragment: unlockedByFragmentMap.get(s.id) ?? null,
  }))

  const fragmentsBySource = buildFragmentsBySource(content, selection, patternById)
  const unlockedByFragmentMap = computeUnlockedByFragment(
    content,
    selection,
    unlockedIds,
  )
  const observations = buildPreviewObservations(
    evidence,
    sourceById,
    personById,
    patternById,
    4,
  )
  const selectedObservations = buildSelectedObservations(
    content,
    selection,
    sourceById,
    personById,
    patternById,
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

  const patternConnections = new Map<string, ConnectionStatus>()
  const patternsView: DossierViewPattern[] = patterns.map((p) => {
    const strong = p.strongEvidenceIds.length
    const weak = p.weakEvidenceIds.length
    const conn = computePatternConnection(p, selection)
    patternConnections.set(p.id, conn.status)
    return {
      id: p.id,
      title: p.title,
      shortDescription: p.shortDescription,
      strongSignals: strong,
      weakSignals: weak,
      signalLevel: signalLevelFromCounts(strong, weak),
      connectionStatus: conn.status,
      markedCount: conn.marked,
      targetCount: p.requiredEvidenceCount,
      contradictedCount: conn.contradicted,
    }
  })

  const timeline = buildTimeline(content, selection, 6)
  const outcomes = buildOutcomes(report.outcomes)
  const debriefView = buildDebrief(debrief, 6)

  const year = (() => {
    const firstDate = sources[0]?.date ?? ''
    return /^(\d{4})/u.exec(firstDate)?.[1] ?? '2025'
  })()

  const visibleEvidenceCount = evidence.filter(
    (e) => e.defaultVisible && !e.isRedHerring,
  ).length
  const selectedCount = selection.selectedFragmentIds.size
  const unlockedMaterialCount = materials.filter((m) => !m.locked).length
  const confirmedPatternCount = patternsView.filter(
    (p) => p.connectionStatus === 'strong',
  ).length

  const initialSourceIdSet = new Set<string>(c.initialSourceIds)
  const unlockedSinceStartTitles = materials
    .filter((m) => !m.locked && !initialSourceIdSet.has(m.id))
    .map((m) => m.title)

  const progressChips: DossierViewProgressChip[] = [
    {
      label: 'материалов',
      value: `${unlockedMaterialCount} / ${materials.length}`,
    },
    {
      label: 'фрагментов в обзоре',
      value: `${selectedCount} / ${visibleEvidenceCount}`,
    },
    {
      label: 'наблюдений под отслеживанием',
      value: `${confirmedPatternCount} подтв. / ${patterns.length}`,
    },
    { label: 'людей', value: String(persons.length) },
  ]

  const reportView = buildReport(content, selection, patternConnections, patternById)

  const activeMaterialId =
    c.initialSourceIds.find((id) => sourceById.has(id) && unlockedIds.has(id)) ??
    sources.find((s) => unlockedIds.has(s.id))?.id ??
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
    selectedObservations,
    persons: personsView,
    patterns: patternsView,
    timeline,
    outcomes,
    debrief: debriefView,
    selectionSummary: {
      selectedCount,
      visibleFragmentCount: visibleEvidenceCount,
      unlockedMaterialCount,
      totalMaterialCount: materials.length,
      confirmedPatternCount,
      totalPatternCount: patterns.length,
      unlockedSinceStartTitles,
    },
    report: reportView,
  }
}
