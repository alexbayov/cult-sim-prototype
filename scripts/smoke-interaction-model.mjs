// Smoke test for src/investigation/interactionModel.ts.
//
// Reads the same JSON case files the TS module would consume, runs a
// hand-rolled JS port of the helpers, and prints the results for three
// canonical states:
//
//   1. empty state              — nothing selected;
//   2. minimal/early state      — a couple of weak fragments;
//   3. strong state             — enough strong fragments to confirm
//                                 multiple patterns and pick a system-level
//                                 outcome.
//
// This script is intentionally a smoke test, not a unit test: it prints
// what happened so a reviewer can sanity-check the algorithm without
// running a TS test framework. The TS module remains the source of truth;
// keep the algorithm here in sync if you edit interactionModel.ts.
//
// Usage:
//   npm run smoke:interaction
//
// Exit code is always 0 unless reading files fails or a basic invariant
// breaks (e.g. the strong state fails to confirm any observation).

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const caseDir = join(
  __dirname,
  '..',
  'src',
  'game',
  'cases',
  'info-business-marathon',
)
const load = (file) => JSON.parse(readFileSync(join(caseDir, file), 'utf8'))

const content = {
  case: load('case.json'),
  persons: load('persons.json'),
  sources: load('sources.json'),
  evidence: load('evidence.json'),
  patterns: load('patterns.json'),
  report: load('report.json'),
  debrief: load('debrief.json'),
}

const fragmentsById = new Map()
for (const e of content.evidence) fragmentsById.set(e.id, e)

const computeUnlockedSourceIds = (selected) => {
  const visible = new Set(content.case.initialSourceIds)
  for (const id of selected) {
    const fragment = fragmentsById.get(id)
    if (!fragment) continue
    for (const sid of fragment.unlocksSourceIds) visible.add(sid)
  }
  return visible
}

const computeObservationStatus = (pattern, selected) => {
  if (selected.size === 0) {
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

  for (const fid of selected) {
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
  let status
  if (supportCount === 0) status = 'hidden'
  else if (supportCount >= pattern.requiredEvidenceCount && strongCount >= 1)
    status = 'strong'
  else if (strongCount >= 1) status = 'supported'
  else status = 'signal'

  return {
    patternId: pattern.id,
    status,
    strongCount,
    weakCount,
    counterCount,
    totalWeight,
  }
}

const isEligible = (outcome, strongIds) => {
  if (strongIds.size < outcome.minPatternConfirmedCount) return false
  for (const required of outcome.requiredPatternIds) {
    if (!strongIds.has(required)) return false
  }
  for (const forbidden of outcome.forbiddenPatternIds) {
    if (strongIds.has(forbidden)) return false
  }
  return true
}

const buildSummary = (selected) => {
  const statuses = content.patterns.map((p) =>
    computeObservationStatus(p, selected),
  )
  const strongIds = new Set()
  const supportedIds = []
  for (const r of statuses) {
    if (r.status === 'strong') strongIds.add(r.patternId)
    else if (r.status === 'supported') supportedIds.push(r.patternId)
  }

  const eligible = content.report.outcomes.filter((o) =>
    isEligible(o, strongIds),
  )
  let outcome = null
  let reason = 'no-eligible-outcome'
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
    outcome = eligible[0]
    reason = `picked highest-threshold eligible outcome (${outcome.id})`
  } else {
    const fallback = content.report.outcomes.find(
      (o) =>
        o.minPatternConfirmedCount === 0 &&
        o.requiredPatternIds.length === 0,
    )
    if (fallback) {
      outcome = fallback
      reason = `no strong-pattern outcome eligible; fell back to ${fallback.id}`
    }
  }

  return {
    outcome,
    strongObservationIds: Array.from(strongIds),
    supportedObservationIds: supportedIds,
    selectedFragmentCount: selected.size,
    reason,
  }
}

const printScenario = (label, selectedArray) => {
  const selected = new Set(selectedArray)
  console.log(`\n=== ${label} ===`)
  console.log(`selectedFragmentIds: [${selectedArray.join(', ') || '<empty>'}]`)

  const visible = computeUnlockedSourceIds(selected)
  console.log(`visible sources (${visible.size}):`)
  for (const sid of visible) console.log(`  - ${sid}`)

  const statuses = content.patterns.map((p) =>
    computeObservationStatus(p, selected),
  )
  console.log('observations:')
  for (const r of statuses) {
    if (r.status === 'hidden') continue
    console.log(
      `  - ${r.patternId} → ${r.status}  ` +
        `(strong=${r.strongCount}, weak=${r.weakCount}, counter=${r.counterCount}, weight=${r.totalWeight})`,
    )
  }

  const draft = buildSummary(selected)
  console.log(
    `summary draft: outcome=${draft.outcome ? draft.outcome.id : '<none>'}, reason=${draft.reason}`,
  )
  console.log(
    `  strong observations: [${draft.strongObservationIds.join(', ') || '<none>'}]`,
  )
  console.log(
    `  supported observations: [${draft.supportedObservationIds.join(', ') || '<none>'}]`,
  )

  return draft
}

printScenario('1. empty state', [])
printScenario('2. early state — single observation seeded', [
  // an evidence pointing at p_isolation via suggestedPatternIds + a weak one
  'e_ex_isolation_request',
])
const strongDraft = printScenario(
  '3. strong state — enough fragments to confirm system-level outcome',
  [
    // p_isolation (strong x4)
    'e_ex_isolation_request',
    'e_relative_no_contact',
    'e_calendar_silent_week',
    'e_refund_outside_warning',
    // p_financial_pressure (strong x3)
    'e_closed_finance_push',
    'e_ex_financial_pressure',
    'e_payment_tiers',
    // p_coercive_control (strong x3, enough for >= requiredEvidenceCount)
    'e_payment_pressure_script',
    'e_checklist_doubt_response',
    'e_refund_curator_pushback',
    // p_leader_control (strong x2)
    'e_closed_loyalty_term',
    'e_ex_shame_public',
    // p_information_control (strong x1 + weak x1)
    'e_chat_dont_tell_outside',
    'e_chat_refund_hint',
  ],
)

if (strongDraft.strongObservationIds.length === 0) {
  console.error(
    '\nINVARIANT FAILED: strong scenario produced zero strong observations',
  )
  process.exit(1)
}

console.log('\nOK: smoke run completed')
