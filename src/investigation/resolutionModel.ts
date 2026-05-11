// Pure helpers for the post-submit разбор / debrief screen.
//
// Given a case (`InvestigationContent`) and a snapshot of the player's
// selection (`InteractionState` + which materials they actually opened),
// this module computes:
//
//   - chosen outcome (id + title) from `buildSummaryDraft`;
//   - strong / supported / weak / contradicted observations;
//   - selected red-herring fragments — surfaced as `шум`;
//   - "missed strong" topics — connections where the case has опорные
//     фрагменты, but the player has none of them as закладки. We phrase
//     this as topics worth checking, not as "you missed X";
//   - protective observations the player has surfaced;
//   - five result metrics — `точность`, `осторожность`, `полнота`,
//     `защитный фокус`, `шум` — each in 0..100;
//   - five achievement seeds the player can earn locally.
//
// Deterministic. No React, no DOM, no I/O. Mirrors the contract style of
// `interactionModel.ts` so both layers stay testable in isolation.

import type {
  ControlPattern,
  EvidenceFragment,
  InvestigationContent,
} from '../game/investigation/types'
import {
  buildSummaryDraft,
  computeObservationStatuses,
  type InteractionState,
} from './interactionModel'

// ---- Metric & achievement vocab --------------------------------------------

export const RESOLUTION_METRIC_KEYS = [
  'precision',
  'caution',
  'completeness',
  'protectiveFocus',
  'noise',
] as const

export type ResolutionMetricKey = (typeof RESOLUTION_METRIC_KEYS)[number]

export type ResolutionMetric = {
  key: ResolutionMetricKey
  label: string
  value: number // 0..100
  description: string
}

export type ResolutionAchievementId =
  | 'a_no_rush'
  | 'a_external_support'
  | 'a_three_sources'
  | 'a_reality_check'
  | 'a_methodical_reader'

export type ResolutionAchievement = {
  id: ResolutionAchievementId
  title: string
  description: string
  earned: boolean
}

// ---- Output shape ----------------------------------------------------------

export type ResolutionPatternRef = {
  id: string
  title: string
}

export type ResolutionFragmentRef = {
  id: string
  text: string
  speaker: string
  sourceId: string
  sourceLabel: string
}

export type ResolutionGlossaryEntry = {
  id: string
  term: string
  shortExplanation: string
  relatedPatternId: string | null
}

export type Resolution = {
  outcomeId: string | null
  outcomeTitle: string | null
  selectedFragmentCount: number
  openedSourceCount: number
  totalSourceCount: number
  visibleSourceCount: number
  strongObservations: ResolutionPatternRef[]
  supportedObservations: ResolutionPatternRef[]
  weakObservations: ResolutionPatternRef[]
  contradictedObservations: ResolutionPatternRef[]
  protectiveObservations: ResolutionPatternRef[]
  noiseFragments: ResolutionFragmentRef[]
  missedStrongTopics: ResolutionPatternRef[]
  metrics: ResolutionMetric[]
  achievements: ResolutionAchievement[]
  glossary: ResolutionGlossaryEntry[]
}

export type ResolutionInput = {
  selection: InteractionState
  openedMaterialIds: ReadonlySet<string>
}

// ---- Heuristics ------------------------------------------------------------

// We don't have a typed marker for "protective" patterns on disk yet, but
// both seeded cases use stable suffixes for them (`p_protective_ties`,
// `p_reality_testing`). Detect by id substring so new cases following the
// same convention get protective treatment for free.
const PROTECTIVE_PATTERN_ID_HINTS = ['protective', 'reality']

function isProtectivePattern(p: ControlPattern): boolean {
  return PROTECTIVE_PATTERN_ID_HINTS.some((hint) => p.id.includes(hint))
}

function clamp(n: number, min = 0, max = 100): number {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

function stripParenthetical(label: string): string {
  return label.replace(/\s*\([^)]+\)\s*$/u, '').trim()
}

function patternRef(p: ControlPattern): ResolutionPatternRef {
  return { id: p.id, title: p.title }
}

// ---- Main entry ------------------------------------------------------------

export function buildResolution(
  content: InvestigationContent,
  input: ResolutionInput,
): Resolution {
  const { selection, openedMaterialIds } = input
  const selectedIds = selection.selectedFragmentIds

  const fragmentById = new Map<string, EvidenceFragment>()
  for (const e of content.evidence) fragmentById.set(e.id, e)

  const patternById = new Map<string, ControlPattern>()
  for (const p of content.patterns) patternById.set(p.id, p)

  const protectivePatterns = content.patterns.filter(isProtectivePattern)
  const riskPatterns = content.patterns.filter((p) => !isProtectivePattern(p))

  const selectedFragments: EvidenceFragment[] = []
  for (const id of selectedIds) {
    const f = fragmentById.get(id)
    if (f) selectedFragments.push(f)
  }

  // Per-pattern statuses delegated to the interaction model so we share the
  // same algorithm as the live UI.
  const statuses = computeObservationStatuses(content, selection)
  const statusById = new Map(statuses.map((s) => [s.patternId, s]))

  const strongObservations: ResolutionPatternRef[] = []
  const supportedObservations: ResolutionPatternRef[] = []
  const weakObservations: ResolutionPatternRef[] = []
  const contradictedObservations: ResolutionPatternRef[] = []
  const protectiveObservations: ResolutionPatternRef[] = []

  for (const p of content.patterns) {
    const s = statusById.get(p.id)
    if (!s) continue
    const ref = patternRef(p)
    if (s.status === 'strong') strongObservations.push(ref)
    else if (s.status === 'supported') supportedObservations.push(ref)
    else if (s.status === 'signal') weakObservations.push(ref)
    if (s.counterCount >= 1) contradictedObservations.push(ref)
    if (isProtectivePattern(p) && s.status !== 'hidden') {
      protectiveObservations.push(ref)
    }
  }

  // Noise: selected red-herring fragments. These get surfaced as «шум».
  const sourceTitleById = new Map(content.sources.map((s) => [s.id, s.title]))
  const noiseFragments: ResolutionFragmentRef[] = selectedFragments
    .filter((f) => f.isRedHerring)
    .map((f) => ({
      id: f.id,
      text: f.text,
      speaker: f.speaker,
      sourceId: f.sourceId,
      sourceLabel: sourceTitleById.get(f.sourceId) ?? f.sourceId,
    }))

  // Missed strong: any non-protective pattern where the case has at least
  // one strong fragment available, but the player has none of those strong
  // fragments selected. We list them as topics, not failures.
  const missedStrongTopics: ResolutionPatternRef[] = []
  for (const p of content.patterns) {
    if (isProtectivePattern(p)) continue
    if (p.strongEvidenceIds.length === 0) continue
    const hasStrongSelected = p.strongEvidenceIds.some((id) =>
      selectedIds.has(id),
    )
    if (!hasStrongSelected) missedStrongTopics.push(patternRef(p))
  }

  // Visible / opened source counts. "Visible" = currently unlocked given
  // selection. "Opened" = sources the player actually focused at least once.
  const unlockedSourceIds = new Set<string>(content.case.initialSourceIds)
  for (const s of content.sources) {
    if (s.unlockedByEvidenceIds.length === 0) unlockedSourceIds.add(s.id)
  }
  for (const id of selectedIds) {
    const f = fragmentById.get(id)
    if (!f) continue
    for (const sid of f.unlocksSourceIds) unlockedSourceIds.add(sid)
  }
  for (const s of content.sources) {
    if (s.unlockedByEvidenceIds.some((eid) => selectedIds.has(eid))) {
      unlockedSourceIds.add(s.id)
    }
  }
  const validSourceIds = new Set(content.sources.map((s) => s.id))
  const openedSourceCount = Array.from(openedMaterialIds).filter((id) =>
    validSourceIds.has(id),
  ).length

  // ---- Metrics ----

  const totalSelected = selectedFragments.length
  const redHerringSelected = noiseFragments.length

  const isCounterFragment = (f: EvidenceFragment): boolean =>
    content.patterns.some((p) => p.counterEvidenceIds.includes(f.id))
  const isProtectiveFragment = (f: EvidenceFragment): boolean =>
    protectivePatterns.some(
      (p) =>
        p.strongEvidenceIds.includes(f.id) ||
        p.weakEvidenceIds.includes(f.id),
    )

  const counterOrProtectiveSelected = selectedFragments.filter(
    (f) => isCounterFragment(f) || isProtectiveFragment(f),
  ).length
  const protectiveFragmentCount = selectedFragments.filter((f) =>
    isProtectiveFragment(f),
  ).length

  const totalRiskPatterns = riskPatterns.length
  const strongRiskCount = strongObservations.filter((r) => {
    const p = patternById.get(r.id)
    return p && !isProtectivePattern(p)
  }).length
  const totalProtective = protectivePatterns.length

  // 0..100 metric values. We round at the end so consumers can render
  // them as plain integers without further math.
  const precisionValue =
    totalSelected > 0
      ? Math.round((1 - redHerringSelected / totalSelected) * 100)
      : 0
  const cautionValue =
    totalSelected > 0
      ? Math.round(
          clamp((counterOrProtectiveSelected / totalSelected) * 200),
        )
      : 0
  const completenessValue =
    totalRiskPatterns > 0
      ? Math.round((strongRiskCount / totalRiskPatterns) * 100)
      : 0
  // Protective focus: at least one protective fragment per protective pattern
  // gives full marks (scaled across both pattern slots).
  const protectiveFocusValue =
    totalProtective > 0
      ? Math.round(
          clamp((protectiveFragmentCount / Math.max(1, totalProtective)) * 100),
        )
      : 0
  const noiseValue =
    totalSelected > 0
      ? Math.round((redHerringSelected / totalSelected) * 100)
      : 0

  const metrics: ResolutionMetric[] = [
    {
      key: 'precision',
      label: 'точность',
      value: precisionValue,
      description: 'Доля закладок, относящихся к делу, а не к шуму.',
    },
    {
      key: 'caution',
      label: 'осторожность',
      value: cautionValue,
      description: 'Внимание к контр-фактам и защитному контексту.',
    },
    {
      key: 'completeness',
      label: 'полнота',
      value: completenessValue,
      description:
        'Сколько связей подтверждено опорными фрагментами относительно общего числа.',
    },
    {
      key: 'protectiveFocus',
      label: 'защитный фокус',
      value: protectiveFocusValue,
      description: 'Замечены ли внешние опоры и проверка реальности.',
    },
    {
      key: 'noise',
      label: 'шум',
      value: noiseValue,
      description: 'Доля красных селёдок в подборке.',
    },
  ]

  // ---- Achievements ----

  const notRushed = totalSelected > 0 && redHerringSelected === 0

  const externalSupport = protectiveFragmentCount >= 1

  const threeSources = content.patterns.some((p) => {
    const selectedStrong = p.strongEvidenceIds
      .filter((id) => selectedIds.has(id))
      .map((id) => fragmentById.get(id)?.sourceId)
      .filter((sid): sid is string => Boolean(sid))
    return new Set(selectedStrong).size >= 3
  })

  const realityCheck = counterOrProtectiveSelected >= 1

  const methodicReader =
    content.sources.length > 0 &&
    openedSourceCount >= Math.ceil(content.sources.length * 0.75)

  const achievements: ResolutionAchievement[] = [
    {
      id: 'a_no_rush',
      title: 'Не поспешил',
      description: 'Сводка собрана без красных селёдок в закладках.',
      earned: notRushed,
    },
    {
      id: 'a_external_support',
      title: 'Внешняя опора',
      description: 'Замечена хотя бы одна внешняя опора участника.',
      earned: externalSupport,
    },
    {
      id: 'a_three_sources',
      title: 'Три источника',
      description:
        'Связь подтверждена опорными фрагментами из трёх разных материалов.',
      earned: threeSources,
    },
    {
      id: 'a_reality_check',
      title: 'Проверка реальности',
      description:
        'Контр-факт или защитный контекст положен в закладки до сводки.',
      earned: realityCheck,
    },
    {
      id: 'a_methodical_reader',
      title: 'Методичный читатель',
      description:
        'Большая часть доступных материалов открыта до подачи сводки.',
      earned: methodicReader,
    },
  ]

  // ---- Glossary ----
  // Surface debrief entries whose underlying pattern is currently strong,
  // supported, or whose example fragments include any selected закладка.
  const surfacedPatternIds = new Set<string>([
    ...strongObservations.map((p) => p.id),
    ...supportedObservations.map((p) => p.id),
  ])

  const glossary: ResolutionGlossaryEntry[] = []
  for (const entry of content.debrief) {
    const matchedPatternId = entry.id.replace(/^d_/u, 'p_')
    const relatedPattern = patternById.get(matchedPatternId) ?? null
    const isRelated =
      (relatedPattern && surfacedPatternIds.has(relatedPattern.id)) ||
      entry.exampleEvidenceIds.some((eid) => selectedIds.has(eid))
    if (!isRelated) continue
    glossary.push({
      id: entry.id,
      term: stripParenthetical(entry.term),
      shortExplanation: entry.shortExplanation,
      relatedPatternId: relatedPattern?.id ?? null,
    })
  }

  const draft = buildSummaryDraft(content, selection)

  return {
    outcomeId: draft.outcome?.id ?? null,
    outcomeTitle: draft.outcome?.title ?? null,
    selectedFragmentCount: totalSelected,
    openedSourceCount,
    totalSourceCount: content.sources.length,
    visibleSourceCount: unlockedSourceIds.size,
    strongObservations,
    supportedObservations,
    weakObservations,
    contradictedObservations,
    protectiveObservations,
    noiseFragments,
    missedStrongTopics,
    metrics,
    achievements,
    glossary,
  }
}
