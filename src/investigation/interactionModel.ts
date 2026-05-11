// Pure helpers for the investigation interaction model.
//
// This module is intentionally framework-agnostic: no React, no DOM, no
// localStorage. It works on the static `InvestigationContent` shape from
// `src/game/investigation/types.ts` and a small `InteractionState` value
// describing what the player has selected so far. Everything here is
// deterministic and side-effect-free, so the same module can be reused by:
//
//   - a future clickable dossier UI (PR #10 adapted on top of PR #13),
//   - the smoke fixture in `scripts/smoke-interaction-model.mjs`,
//   - any non-UI dashboards / debug screens we add later.
//
// Naming intentionally uses the player-facing vocabulary: `fragment`,
// `observation`, `summary`. We keep the canonical type names from
// `types.ts` (`EvidenceFragment`, `ControlPattern`, `ReportOutcome`)
// because those are the data shapes on disk; the helper API on top of
// them avoids the word «evidence/улика» where the player would see it.
//
// See `docs/EVIDENCE_INTERACTION_PLAN.md` for the design rationale and
// the integration plan with PR #10 / PR #13.

import type {
  ControlPattern,
  EvidenceFragment,
  InvestigationContent,
  ReportOutcome,
} from '../game/investigation/types'

// ---- Public types -----------------------------------------------------------

/**
 * Stable identifier for a selected fragment. Always equal to
 * `EvidenceFragment.id`. Aliased for readability at call sites where a bare
 * `string` would be ambiguous.
 */
export type SelectedFragmentId = string

/**
 * Status of a control pattern (observation) from the player's perspective.
 *
 *  - `hidden`    — no selected fragments are linked to this observation.
 *  - `signal`    — at least one selected fragment is linked, but it is weak
 *                  or low-weight; not enough to draw a conclusion.
 *  - `supported` — at least one strong fragment is selected, but the total
 *                  does not reach `requiredEvidenceCount`.
 *  - `strong`    — selected fragments meet `requiredEvidenceCount`, with
 *                  enough strong content to call the observation confirmed.
 */
export type ObservationStatus = 'hidden' | 'signal' | 'supported' | 'strong'

/**
 * Minimal interaction state required to compute everything in this module.
 * Stored as plain ids so it can be persisted as JSON without serialization
 * tricks.
 */
export type InteractionState = {
  selectedFragmentIds: ReadonlySet<SelectedFragmentId>
}

/**
 * Per-pattern computed status with the supporting counts used to derive it.
 * Useful both for rendering and for debugging the status transition logic.
 */
export type ObservationStatusResult = {
  patternId: string
  status: ObservationStatus
  strongCount: number
  weakCount: number
  counterCount: number
  totalWeight: number
}

/**
 * Result of `buildSummaryDraft`: which outcome we picked, why, and what we
 * could surface as supporting state in the UI.
 */
export type SummaryDraft = {
  outcome: ReportOutcome | null
  strongObservationIds: string[]
  supportedObservationIds: string[]
  selectedFragmentCount: number
  reason: string
}

// ---- Selected fragment helpers ---------------------------------------------

/**
 * Build a stable interaction state from an iterable of fragment ids.
 *
 * Accepts unknown ids; callers can pre-filter against
 * `content.evidence.map((e) => e.id)` if strictness is needed.
 */
export const createInteractionState = (
  selected: Iterable<SelectedFragmentId>,
): InteractionState => ({
  selectedFragmentIds: new Set(selected),
})

/**
 * Returns the subset of `content.evidence` that the player has selected,
 * preserving the original order from `content.evidence`. Unknown ids in
 * the state are ignored.
 */
export function getSelectedFragments(
  content: InvestigationContent,
  state: InteractionState,
): EvidenceFragment[] {
  if (state.selectedFragmentIds.size === 0) return []
  return content.evidence.filter((e) => state.selectedFragmentIds.has(e.id))
}

// ---- Unlocks ----------------------------------------------------------------

/**
 * Compute the full set of source ids visible to the player given the
 * current selection. Always includes `case.initialSourceIds`.
 *
 * A source becomes visible when at least one selected fragment lists it
 * in `unlocksSourceIds`. Selecting a fragment does NOT require its source
 * to already be visible — that's a UI rule, not a model rule.
 */
export function computeUnlockedSourceIds(
  content: InvestigationContent,
  state: InteractionState,
): Set<string> {
  const visible = new Set<string>(content.case.initialSourceIds)
  if (state.selectedFragmentIds.size === 0) return visible

  for (const fragment of content.evidence) {
    if (!state.selectedFragmentIds.has(fragment.id)) continue
    for (const sid of fragment.unlocksSourceIds) {
      visible.add(sid)
    }
  }
  return visible
}

// ---- Observation statuses ---------------------------------------------------

/**
 * Decide the status of a single pattern from selected fragments.
 *
 * Algorithm (deterministic, see docs/EVIDENCE_INTERACTION_PLAN.md §3):
 *
 * 1. Count selected fragments that are in the pattern's `strongEvidenceIds`,
 *    `weakEvidenceIds`, and `counterEvidenceIds` lists.
 * 2. Also count any selected fragment that lists the pattern in its
 *    `suggestedPatternIds` — those count as `weak` unless they are already
 *    listed as strong on the pattern.
 * 3. Compute `totalWeight = sum of fragment.weight for strong + weak`.
 * 4. Map counts to a status:
 *      - `hidden`    if `strong + weak === 0`,
 *      - `strong`    if `strong + weak >= requiredEvidenceCount` AND
 *                    `strongCount >= 1`,
 *      - `supported` if `strongCount >= 1` and not yet `strong`,
 *      - `signal`    otherwise (only weak selections).
 *
 * Counter-evidence is currently informational only — it is reported back
 * in the result so UI / report logic can treat patterns with many counters
 * differently, but it does NOT downgrade the status. That keeps the
 * function monotonic in selections (selecting more never makes a status
 * worse), which the UI relies on.
 */
export function computeObservationStatus(
  pattern: ControlPattern,
  state: InteractionState,
  fragmentsById: ReadonlyMap<string, EvidenceFragment>,
): ObservationStatusResult {
  if (state.selectedFragmentIds.size === 0) {
    return {
      patternId: pattern.id,
      status: 'hidden',
      strongCount: 0,
      weakCount: 0,
      counterCount: 0,
      totalWeight: 0,
    }
  }

  const strongSet = new Set(pattern.strongEvidenceIds)
  const weakSet = new Set(pattern.weakEvidenceIds)
  const counterSet = new Set(pattern.counterEvidenceIds)

  let strongCount = 0
  let weakCount = 0
  let counterCount = 0
  let totalWeight = 0

  for (const fid of state.selectedFragmentIds) {
    const fragment = fragmentsById.get(fid)
    if (!fragment) continue

    if (strongSet.has(fid)) {
      strongCount += 1
      totalWeight += fragment.weight
      continue
    }
    if (weakSet.has(fid)) {
      weakCount += 1
      totalWeight += fragment.weight
      continue
    }
    if (counterSet.has(fid)) {
      counterCount += 1
      continue
    }
    if (fragment.suggestedPatternIds.includes(pattern.id)) {
      weakCount += 1
      totalWeight += fragment.weight
    }
  }

  const supportCount = strongCount + weakCount
  let status: ObservationStatus
  if (supportCount === 0) {
    status = 'hidden'
  } else if (
    supportCount >= pattern.requiredEvidenceCount &&
    strongCount >= 1
  ) {
    status = 'strong'
  } else if (strongCount >= 1) {
    status = 'supported'
  } else {
    status = 'signal'
  }

  return {
    patternId: pattern.id,
    status,
    strongCount,
    weakCount,
    counterCount,
    totalWeight,
  }
}

/**
 * Convenience: compute statuses for every pattern in the case.
 *
 * Returns results in the same order as `content.patterns`.
 */
export function computeObservationStatuses(
  content: InvestigationContent,
  state: InteractionState,
): ObservationStatusResult[] {
  const fragmentsById = new Map<string, EvidenceFragment>()
  for (const fragment of content.evidence) {
    fragmentsById.set(fragment.id, fragment)
  }
  return content.patterns.map((pattern) =>
    computeObservationStatus(pattern, state, fragmentsById),
  )
}

// ---- Summary draft ----------------------------------------------------------

/**
 * Determines whether an outcome is currently eligible given the set of
 * `strong` observations. An outcome is eligible if:
 *
 *   - every id in `requiredPatternIds` is in the strong set;
 *   - no id in `forbiddenPatternIds` is in the strong set;
 *   - the strong set size meets `minPatternConfirmedCount`.
 */
function isOutcomeEligible(
  outcome: ReportOutcome,
  strongPatternIds: ReadonlySet<string>,
): boolean {
  if (strongPatternIds.size < outcome.minPatternConfirmedCount) return false
  for (const required of outcome.requiredPatternIds) {
    if (!strongPatternIds.has(required)) return false
  }
  for (const forbidden of outcome.forbiddenPatternIds) {
    if (strongPatternIds.has(forbidden)) return false
  }
  return true
}

/**
 * Pick a summary draft from the report's outcomes given the current state.
 *
 * Selection rule (see docs/EVIDENCE_INTERACTION_PLAN.md §4):
 *
 * 1. Compute observation statuses; collect `strongPatternIds` and
 *    `supportedPatternIds`.
 * 2. From `report.outcomes`, take all outcomes eligible against the strong
 *    set.
 * 3. Among eligible outcomes, pick the one with the highest
 *    `minPatternConfirmedCount`. Ties are broken by the more specific
 *    outcome (more `requiredPatternIds`), then by stable order in
 *    `report.outcomes`.
 * 4. If no outcome is eligible, fall back to the first outcome with
 *    `minPatternConfirmedCount === 0` (e.g. `ro_too_early` / `ro_insufficient`).
 *    If none exists, return `outcome: null` with `reason: 'no-eligible-outcome'`.
 *
 * The draft is informational. Final wording is `outcome.summary` /
 * `outcome.recommendedFraming`; this helper just picks which one applies.
 */
export function buildSummaryDraft(
  content: InvestigationContent,
  state: InteractionState,
): SummaryDraft {
  const statuses = computeObservationStatuses(content, state)
  const strongPatternIds = new Set<string>()
  const supportedPatternIds: string[] = []
  for (const result of statuses) {
    if (result.status === 'strong') {
      strongPatternIds.add(result.patternId)
    } else if (result.status === 'supported') {
      supportedPatternIds.push(result.patternId)
    }
  }

  const eligible = content.report.outcomes.filter((o) =>
    isOutcomeEligible(o, strongPatternIds),
  )

  let chosen: ReportOutcome | null = null
  let reason: string

  if (eligible.length > 0) {
    eligible.sort((a, b) => {
      if (b.minPatternConfirmedCount !== a.minPatternConfirmedCount) {
        return b.minPatternConfirmedCount - a.minPatternConfirmedCount
      }
      if (b.requiredPatternIds.length !== a.requiredPatternIds.length) {
        return b.requiredPatternIds.length - a.requiredPatternIds.length
      }
      return (
        content.report.outcomes.indexOf(a) -
        content.report.outcomes.indexOf(b)
      )
    })
    chosen = eligible[0]
    reason = `picked highest-threshold eligible outcome (${chosen.id})`
  } else {
    const fallback = content.report.outcomes.find(
      (o) =>
        o.minPatternConfirmedCount === 0 &&
        o.requiredPatternIds.length === 0,
    )
    if (fallback) {
      chosen = fallback
      reason = `no strong-pattern outcome eligible; fell back to ${fallback.id}`
    } else {
      reason = 'no-eligible-outcome'
    }
  }

  return {
    outcome: chosen,
    strongObservationIds: Array.from(strongPatternIds),
    supportedObservationIds: supportedPatternIds,
    selectedFragmentCount: state.selectedFragmentIds.size,
    reason,
  }
}
