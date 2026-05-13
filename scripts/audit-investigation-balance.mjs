#!/usr/bin/env node
// Static balance audit for investigation cases.
//
// Loads every case bundled under src/game/cases/<case>/{case,sources,evidence,
// patterns,report}.json and prints a console-friendly report covering:
//
//   - source counts (initial vs locked) and the full unlock chain;
//   - per-pattern strong/weak/counter coverage and reachability;
//   - per-outcome minimum strong observations + min fragments to reach;
//   - red-herring inventory and visibility (UI-vs-model);
//   - protective / counter fragment inventory;
//   - unreachable outcomes and observations that can never reach `strong`.
//
// The script is intentionally dependency-free (node + fs) so it can run in
// any environment and so the JSON shape mirrors src/game/investigation/types.ts.
// Logic mirrors src/investigation/interactionModel.ts:
//
//   - observation `strong` ⇔ supportCount >= requiredEvidenceCount AND strongCount >= 1
//   - outcome eligible ⇔ all requiredPatternIds strong AND no forbidden strong
//                         AND strong.size >= minPatternConfirmedCount
//   - source unlocked ⇔ in case.initialSourceIds OR some selected fragment lists
//                       it in unlocksSourceIds
//
// And the view-model filter from src/investigation/investigationViewModel.ts:
//
//   - source pane hides fragments with `defaultVisible: false`
//   - red-herring fragments ARE surfaced; the player has to recognise them by
//     content and not bookmark them (they feed `шум` / `a_no_rush` in the
//     resolution)
//
// We compute "min fragments" under two views:
//
//   - **model min**: lower bound assuming the player can select any fragment.
//   - **UI min**:    realistic bound assuming the player only sees fragments
//                    surfaced by the dossier (defaultVisible), in sources
//                    currently unlocked. Source-unlock fragments are
//                    auto-counted if needed.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const CASES_DIR = join(REPO_ROOT, 'src/game/cases')

const PROTECTIVE_HINTS = ['protective', 'reality']
const isProtectivePattern = (id) =>
  PROTECTIVE_HINTS.some((hint) => id.includes(hint))

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function loadCase(caseId) {
  const dir = join(CASES_DIR, caseId)
  return {
    id: caseId,
    case: loadJson(join(dir, 'case.json')),
    persons: loadJson(join(dir, 'persons.json')),
    sources: loadJson(join(dir, 'sources.json')),
    evidence: loadJson(join(dir, 'evidence.json')),
    patterns: loadJson(join(dir, 'patterns.json')),
    report: loadJson(join(dir, 'report.json')),
  }
}

function discoverCases() {
  // Skip v2 cases: this audit models the v1 interactionModel
  // (pattern × evidence × outcome). v2 cases use a different on-disk shape
  // (hypotheses × documents × keyPhrases × recommendations) that this audit
  // cannot reason about; trying to load them would crash on the missing
  // persons.json / patterns.json / etc. A v2-aware balance audit is a
  // separate follow-up.
  return readdirSync(CASES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      const caseFile = join(CASES_DIR, name, 'case.json')
      if (!existsSync(caseFile)) return false
      try {
        const j = JSON.parse(readFileSync(caseFile, 'utf8'))
        if (j?.schemaVersion === 'v2') {
          console.log(`[${name}] skipped — v2 case (balance audit is v1-only)`)
          return false
        }
      } catch {
        return false
      }
      return true
    })
    .sort()
}

// ---- Observation status (mirrors interactionModel.ts) ----------------------

function observationStatus(pattern, selectedSet, evidenceById) {
  if (selectedSet.size === 0) {
    return {
      status: 'hidden',
      strong: 0,
      weak: 0,
      counter: 0,
      support: 0,
    }
  }
  const strongSet = new Set(pattern.strongEvidenceIds)
  const weakSet = new Set(pattern.weakEvidenceIds)
  const counterSet = new Set(pattern.counterEvidenceIds)
  let strong = 0
  let weak = 0
  let counter = 0
  for (const fid of selectedSet) {
    const e = evidenceById.get(fid)
    if (!e) continue
    if (strongSet.has(fid)) {
      strong += 1
      continue
    }
    if (weakSet.has(fid)) {
      weak += 1
      continue
    }
    if (counterSet.has(fid)) {
      counter += 1
      continue
    }
    if ((e.suggestedPatternIds ?? []).includes(pattern.id)) {
      weak += 1
    }
  }
  const support = strong + weak
  let status
  if (support === 0) status = 'hidden'
  else if (support >= pattern.requiredEvidenceCount && strong >= 1)
    status = 'strong'
  else if (strong >= 1) status = 'supported'
  else status = 'signal'
  return { status, strong, weak, counter, support }
}

// ---- UI accessibility ------------------------------------------------------

function buildUiVisibleEvidenceIds(content, unlockedSourceIds) {
  // What the dossier source pane actually shows. Red-herrings are surfaced
  // alongside real fragments; the player has to recognise them by content.
  const visible = new Set()
  for (const e of content.evidence) {
    if (!e.defaultVisible) continue
    if (!unlockedSourceIds.has(e.sourceId)) continue
    visible.add(e.id)
  }
  return visible
}

function unlockedSourcesFromSelection(content, selectedIds) {
  const visible = new Set(content.case.initialSourceIds)
  for (const fid of selectedIds) {
    const e = content.evidence.find((x) => x.id === fid)
    if (!e) continue
    for (const sid of e.unlocksSourceIds ?? []) visible.add(sid)
  }
  return visible
}

// ---- Min-fragments-to-strong (UI view) -------------------------------------

// Walks pattern.strongEvidenceIds + weakEvidenceIds + suggestedPatternIds and
// looks for the smallest selectable subset that brings the pattern to `strong`.
//
// "Selectable" means the fragment is `defaultVisible` and its source is
// either initially visible OR unlocked by another selected fragment. (Red-
// herrings are selectable too — choosing them is a player mistake that
// shows up in the resolution's `шум` metric.)
// We resolve unlock chains by trying every candidate fragment plus, if needed,
// any single unlock-source fragment that opens its source.
//
// Returns `{ minCount, exampleSelection }` or `null` if unreachable.

function buildPatternSupportList(pattern, content) {
  const out = []
  const strongSet = new Set(pattern.strongEvidenceIds)
  const weakSet = new Set(pattern.weakEvidenceIds)
  for (const e of content.evidence) {
    if (strongSet.has(e.id)) out.push({ id: e.id, kind: 'strong', e })
    else if (weakSet.has(e.id)) out.push({ id: e.id, kind: 'weak', e })
    else if ((e.suggestedPatternIds ?? []).includes(pattern.id))
      out.push({ id: e.id, kind: 'suggested', e })
  }
  return out
}

function sourceUnlockers(content) {
  const map = new Map() // sourceId → fragments that unlock it
  for (const e of content.evidence) {
    for (const sid of e.unlocksSourceIds ?? []) {
      if (!map.has(sid)) map.set(sid, [])
      map.get(sid).push(e)
    }
  }
  return map
}

function smallestUiReach(pattern, content) {
  // Generate candidate strong-fragment combinations of size 1..requiredEvidenceCount
  // and pad with weak/suggested fragments to reach requiredEvidenceCount.
  const support = buildPatternSupportList(pattern, content)
  const strongOnly = support.filter((s) => s.kind === 'strong')
  if (strongOnly.length === 0) return null
  const initial = new Set(content.case.initialSourceIds)
  const unlockMap = sourceUnlockers(content)
  const evidenceById = new Map(content.evidence.map((e) => [e.id, e]))
  const need = pattern.requiredEvidenceCount

  let best = null

  function isUiVisible(fid, currentUnlocked) {
    const e = evidenceById.get(fid)
    if (!e) return false
    if (!e.defaultVisible) return false
    return currentUnlocked.has(e.sourceId)
  }

  function tryClose(selection) {
    // Make sure every selected fragment is reachable. If a fragment's source
    // is locked, recursively add an unlock-chain fragment that opens it,
    // even if that opener itself lives on a still-locked source — a later
    // iteration will pick up its opener too. Bounded by sources.length to
    // avoid runaway loops on malformed data.
    const sel = new Set(selection)
    const safety = content.sources.length * 2 + 4
    let i = 0
    while (i < safety) {
      i += 1
      const unlocked = unlockedSourcesFromSelection(content, sel)
      let locked = null
      for (const fid of sel) {
        const e = evidenceById.get(fid)
        if (!e) continue
        if (unlocked.has(e.sourceId)) continue
        locked = e
        break
      }
      if (!locked) break
      const openers = unlockMap.get(locked.sourceId) ?? []
      // Prefer a UI-visible opener; otherwise fall back to any default-visible
      // opener whose source may itself need unlocking. (Red-herrings shouldn't
      // appear as openers in authored content, but we don't filter them out
      // here — picking one is a player mistake, not unreachable content.)
      const sortedOpeners = [...openers].sort((a, b) => {
        const av = isUiVisible(a.id, unlocked) ? 0 : 1
        const bv = isUiVisible(b.id, unlocked) ? 0 : 1
        return av - bv
      })
      const opener = sortedOpeners.find(
        (o) => o.defaultVisible,
      )
      if (!opener) return null
      if (sel.has(opener.id)) {
        // Would loop forever — abort
        return null
      }
      sel.add(opener.id)
    }
    if (i >= safety) return null
    const unlocked = unlockedSourcesFromSelection(content, sel)
    for (const fid of sel) {
      if (!isUiVisible(fid, unlocked)) return null
    }
    return sel
  }

  // Try every subset of `support` of size `need`.
  const items = support
  const n = items.length
  if (n === 0) return null

  // Bound the search: at most C(n, need) iterations.
  function* subsets(k, start = 0, current = []) {
    if (current.length === k) {
      yield current.slice()
      return
    }
    for (let i = start; i < n; i++) {
      current.push(i)
      yield* subsets(k, i + 1, current)
      current.pop()
    }
  }

  for (const indices of subsets(need)) {
    const chosen = indices.map((i) => items[i])
    if (!chosen.some((c) => c.kind === 'strong')) continue
    const sel = tryClose(chosen.map((c) => c.id))
    if (!sel) continue
    if (!best || sel.size < best.size) {
      best = sel
      if (best.size === need) break
    }
  }

  if (!best) return null
  return { minCount: best.size, exampleSelection: [...best] }
}

// ---- Outcome reachability --------------------------------------------------

function eligibleOutcome(outcome, strongPatternIds) {
  if (strongPatternIds.size < outcome.minPatternConfirmedCount) return false
  for (const r of outcome.requiredPatternIds)
    if (!strongPatternIds.has(r)) return false
  for (const f of outcome.forbiddenPatternIds)
    if (strongPatternIds.has(f)) return false
  return true
}

function smallestUiReachOutcome(outcome, content, perPatternReach) {
  // Need to bring every requiredPattern to strong + reach
  // minPatternConfirmedCount strong patterns overall.
  const requiredIds = outcome.requiredPatternIds
  const requiredReach = []
  for (const pid of requiredIds) {
    const r = perPatternReach[pid]
    if (!r) return null
    requiredReach.push({ pid, reach: r })
  }
  // Start with required selections (union of their selections)
  const union = new Set()
  for (const r of requiredReach) for (const fid of r.reach.exampleSelection) union.add(fid)

  // Re-check that this selection actually produces strong for every required pattern
  // (greedy union may not — e.g. dedup might drop a strong).
  const evidenceById = new Map(content.evidence.map((e) => [e.id, e]))
  function check(set) {
    const unlocked = unlockedSourcesFromSelection(content, set)
    const strongSet = new Set()
    for (const p of content.patterns) {
      const st = observationStatus(p, set, evidenceById)
      if (st.status === 'strong') strongSet.add(p.id)
    }
    return { strongSet, unlocked }
  }

  let cur = new Set(union)
  let attempts = 8
  while (attempts-- > 0) {
    const { strongSet } = check(cur)
    let missing = false
    for (const pid of requiredIds) {
      if (!strongSet.has(pid)) {
        missing = true
        const r = perPatternReach[pid]
        if (!r) return null
        for (const fid of r.exampleSelection) cur.add(fid)
      }
    }
    if (!missing) break
  }
  // Top up to minPatternConfirmedCount if we still need more strong patterns.
  attempts = 12
  while (attempts-- > 0) {
    const { strongSet } = check(cur)
    if (strongSet.size >= outcome.minPatternConfirmedCount) {
      if (eligibleOutcome(outcome, strongSet)) {
        return { minCount: cur.size, exampleSelection: [...cur], strongSet: [...strongSet] }
      }
      // Forbidden pattern is strong — try to drop it (rare; we just abort here)
      return null
    }
    // Find the cheapest non-required, non-forbidden pattern to add.
    const forbidden = new Set(outcome.forbiddenPatternIds)
    let bestAdd = null
    for (const p of content.patterns) {
      if (strongSet.has(p.id)) continue
      if (forbidden.has(p.id)) continue
      const r = perPatternReach[p.id]
      if (!r) continue
      const before = cur.size
      const trial = new Set(cur)
      for (const fid of r.exampleSelection) trial.add(fid)
      const cost = trial.size - before
      if (!bestAdd || cost < bestAdd.cost) bestAdd = { trial, cost, p }
    }
    if (!bestAdd) return null
    cur = bestAdd.trial
  }
  return null
}

// ---- Main report -----------------------------------------------------------

function pad(s, n) {
  s = String(s)
  if (s.length >= n) return s
  return s + ' '.repeat(n - s.length)
}

function reportCase(content) {
  const lines = []
  const c = content.case
  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Case: ${c.id} — ${c.title}`)
  lines.push('═══════════════════════════════════════════════════════════════')

  // ---- Sources -----------------------------------------------------------
  const initial = new Set(c.initialSourceIds)
  const lockedSources = content.sources.filter((s) => !initial.has(s.id))
  lines.push('')
  lines.push(`Materials: ${content.sources.length} total — ${initial.size} initial, ${lockedSources.length} locked`)
  lines.push('')
  lines.push('Initial materials:')
  for (const sid of c.initialSourceIds) {
    const s = content.sources.find((x) => x.id === sid)
    lines.push(`  · ${sid} — ${s?.title ?? '(missing)'} [reliability=${s?.reliability}]`)
  }
  if (lockedSources.length > 0) {
    lines.push('')
    lines.push('Locked materials & unlock chains:')
    for (const s of lockedSources) {
      const unlockers = content.evidence.filter((e) =>
        (e.unlocksSourceIds ?? []).includes(s.id),
      )
      if (unlockers.length === 0) {
        lines.push(`  · ${s.id} — ${s.title} ← NO unlockers (UNREACHABLE)`)
        continue
      }
      lines.push(`  · ${s.id} — ${s.title}`)
      for (const u of unlockers) {
        const srcInitial = initial.has(u.sourceId) ? 'initial' : 'locked'
        const vis = u.defaultVisible ? 'visible' : 'hidden'
        const rh = u.isRedHerring ? ' RED-HERRING' : ''
        lines.push(`      ← ${u.id} from ${u.sourceId} (${srcInitial}, ${vis})${rh}`)
      }
    }
  }

  // ---- Evidence inventory ----------------------------------------------
  const total = content.evidence.length
  const redHerrings = content.evidence.filter((e) => e.isRedHerring)
  const nonVisible = content.evidence.filter((e) => !e.defaultVisible)
  const allCounterIds = new Set()
  for (const p of content.patterns)
    for (const id of p.counterEvidenceIds ?? []) allCounterIds.add(id)
  const counters = content.evidence.filter((e) => allCounterIds.has(e.id))
  const protectivePatternIds = new Set(
    content.patterns.filter((p) => isProtectivePattern(p.id)).map((p) => p.id),
  )
  const protectiveEvidence = content.evidence.filter((e) => {
    const s = e.suggestedPatternIds ?? []
    if (s.some((pid) => protectivePatternIds.has(pid))) return true
    for (const p of content.patterns) {
      if (!protectivePatternIds.has(p.id)) continue
      if (
        p.strongEvidenceIds.includes(e.id) ||
        p.weakEvidenceIds.includes(e.id)
      )
        return true
    }
    return false
  })

  lines.push('')
  lines.push(`Fragments: ${total} total`)
  lines.push(`  · default-visible: ${total - nonVisible.length}`)
  lines.push(`  · default-hidden:  ${nonVisible.length}`)
  lines.push(`  · red herrings:    ${redHerrings.length}`)
  lines.push(`  · counter context: ${counters.length}`)
  lines.push(`  · protective ctx:  ${protectiveEvidence.length}`)

  if (redHerrings.length > 0) {
    lines.push('')
    lines.push(
      'Red herrings (surfaced in the source pane when defaultVisible):',
    )
    for (const e of redHerrings) {
      const vis = e.defaultVisible ? 'defaultVisible' : 'defaultHidden'
      lines.push(`  · ${e.id} (${e.sourceId}, ${vis}) — "${e.text.slice(0, 64)}…"`)
    }
  }

  if (counters.length > 0) {
    lines.push('')
    lines.push('Counter/protective fragments:')
    for (const e of counters) {
      const inPatterns = content.patterns
        .filter((p) => p.counterEvidenceIds.includes(e.id))
        .map((p) => p.id)
      lines.push(
        `  · ${e.id} (${e.sourceId}) — counter for: ${inPatterns.join(', ')}`,
      )
    }
  }

  // ---- Patterns (observations) ------------------------------------------
  lines.push('')
  lines.push('Observations (patterns):')
  const perPatternReach = {}
  for (const p of content.patterns) {
    const reach = smallestUiReach(p, content)
    perPatternReach[p.id] = reach
    const flags = []
    if (isProtectivePattern(p.id)) flags.push('protective')
    if (p.strongEvidenceIds.length === 0) flags.push('NO STRONG FRAGMENTS')
    if (!reach) flags.push('UNREACHABLE-IN-UI')
    const flagText = flags.length ? `  [${flags.join(', ')}]` : ''
    lines.push(
      `  · ${pad(p.id, 22)} req=${p.requiredEvidenceCount}  strong=${pad(p.strongEvidenceIds.length, 2)}` +
        ` weak=${pad(p.weakEvidenceIds.length, 2)} counter=${pad(p.counterEvidenceIds.length, 2)}` +
        ` ui-min=${reach ? reach.minCount : 'X'}${flagText}`,
    )
  }

  // ---- First supported / first strong (cheapest pattern) ----------------
  const firstSupported = (() => {
    // Smallest 1-strong-fragment select for any pattern that brings it to
    // `supported` or `strong`. Equal to 1 if any strong fragment is UI-visible.
    for (const p of content.patterns) {
      for (const fid of p.strongEvidenceIds) {
        const e = content.evidence.find((x) => x.id === fid)
        if (!e) continue
        if (!e.defaultVisible) continue
        if (initial.has(e.sourceId))
          return { count: 1, patternId: p.id, fid }
      }
    }
    return null
  })()
  lines.push('')
  lines.push(
    `First supported observation in ≥1 fragment: ` +
      (firstSupported
        ? `1 fragment (pick ${firstSupported.fid} → ${firstSupported.patternId})`
        : 'no single visible strong fragment in initial materials'),
  )

  const firstStrong = (() => {
    let best = null
    for (const p of content.patterns) {
      const r = perPatternReach[p.id]
      if (!r) continue
      if (!best || r.minCount < best.minCount)
        best = { patternId: p.id, ...r }
    }
    return best
  })()
  lines.push(
    `First strong observation: ` +
      (firstStrong
        ? `${firstStrong.minCount} fragments → ${firstStrong.patternId}`
        : 'no strong observation reachable'),
  )

  // ---- Outcomes --------------------------------------------------------
  lines.push('')
  lines.push('Outcomes:')
  for (const o of content.report.outcomes) {
    const flags = []
    const hasUnreachableRequired = o.requiredPatternIds.some(
      (pid) => !perPatternReach[pid],
    )
    if (hasUnreachableRequired) flags.push('UNREACHABLE')
    if (o.minPatternConfirmedCount === 0 && o.requiredPatternIds.length === 0)
      flags.push('fallback')
    const protectiveOnly =
      o.requiredPatternIds.length > 0 &&
      o.requiredPatternIds.every((pid) => isProtectivePattern(pid))
    if (protectiveOnly) flags.push('protective-focus')
    const reach = hasUnreachableRequired
      ? null
      : smallestUiReachOutcome(o, content, perPatternReach)
    if (reach && reach.minCount > 0) {
      lines.push(
        `  · ${pad(o.id, 22)} min=${o.minPatternConfirmedCount} req=[${o.requiredPatternIds.join(',') || '—'}]` +
          ` forbid=[${o.forbiddenPatternIds.join(',') || '—'}]` +
          ` ui-min=${reach.minCount} (strong=${reach.strongSet.length})` +
          (flags.length ? `  [${flags.join(', ')}]` : ''),
      )
    } else {
      lines.push(
        `  · ${pad(o.id, 22)} min=${o.minPatternConfirmedCount} req=[${o.requiredPatternIds.join(',') || '—'}]` +
          ` forbid=[${o.forbiddenPatternIds.join(',') || '—'}]` +
          ` ui-min=${o.minPatternConfirmedCount === 0 ? 0 : 'X'}` +
          (flags.length ? `  [${flags.join(', ')}]` : ''),
      )
    }
  }

  // ---- Balance risks ---------------------------------------------------
  const risks = []
  const totalRedHerrings = redHerrings.length
  const uiVisibleRedHerrings = redHerrings.filter(
    (e) => e.defaultVisible && initial.has(e.sourceId),
  ).length
  if (totalRedHerrings > 0) {
    risks.push(
      `red herrings (${totalRedHerrings}) are surfaced in the source pane; ` +
        `verify 'noise' authoring matches the playtest expectation.`,
    )
  } else {
    risks.push(
      `no red herrings authored; 'noise' metric will always be 0 and ` +
        `'a_no_rush' achievement is trivially earned.`,
    )
  }
  for (const p of content.patterns) {
    if (p.strongEvidenceIds.length === 0)
      risks.push(`pattern ${p.id} has 0 strong fragments — never reaches 'strong'.`)
    if (
      p.strongEvidenceIds.length > 0 &&
      p.strongEvidenceIds.length < p.requiredEvidenceCount &&
      p.weakEvidenceIds.length === 0 &&
      (content.evidence.filter((e) => (e.suggestedPatternIds ?? []).includes(p.id)).length === 0)
    )
      risks.push(`pattern ${p.id}: requiredEvidenceCount=${p.requiredEvidenceCount} but only ${p.strongEvidenceIds.length} strong + 0 weak/suggested fragments available.`)
  }
  for (const s of content.sources) {
    if (initial.has(s.id)) continue
    const unlockers = content.evidence.filter((e) =>
      (e.unlocksSourceIds ?? []).includes(s.id),
    )
    if (unlockers.length === 0)
      risks.push(`material ${s.id} is locked but has no unlockers — UNREACHABLE.`)
  }
  for (const o of content.report.outcomes) {
    const unreachable = o.requiredPatternIds.some(
      (pid) => !perPatternReach[pid],
    )
    if (unreachable) risks.push(`outcome ${o.id} requires unreachable pattern(s).`)
  }
  if (risks.length === 0) {
    lines.push('')
    lines.push('Balance risks: none flagged.')
  } else {
    lines.push('')
    lines.push('Balance risks:')
    for (const r of risks) lines.push(`  · ${r}`)
  }

  return lines.join('\n')
}

function main() {
  const cases = discoverCases()
  if (cases.length === 0) {
    console.error('no cases found under', CASES_DIR)
    process.exit(1)
  }
  const out = []
  out.push('Investigation balance audit')
  out.push(`Cases: ${cases.join(', ')}`)
  for (const id of cases) {
    const content = loadCase(id)
    out.push(reportCase(content))
  }
  out.push('')
  console.log(out.join('\n'))
}

main()
