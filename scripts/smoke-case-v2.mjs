#!/usr/bin/env node
// Smoke test for the v2 case bundle.
//
// Loads `src/game/cases/case-01-proryv/*.json` straight from disk, runs the v2
// validator path (mirroring scripts/validate-investigation.mjs), and prints a
// short summary. Exits 0 on success, non-zero on any v2 validation error.
//
// The point of this script is to fail fast on the new case shape during dev
// (e.g. β editing prose, γ wiring the runtime) without forcing the full
// `validate:investigation` run over every case. It also serves as a tiny
// reference for how a future v2 loader should consume these JSONs.
//
// Usage:
//   npm run smoke:v2
//   node scripts/smoke-case-v2.mjs

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { scanCaseV2Content } from './lib/visible-language.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const caseDir = join(__dirname, '..', 'src', 'game', 'cases', 'case-01-proryv')

if (!existsSync(join(caseDir, 'case.json'))) {
  console.error(`case-01-proryv not found at ${caseDir}`)
  process.exit(1)
}

const load = (file) => JSON.parse(readFileSync(join(caseDir, file), 'utf8'))
const bundle = {
  case: load('case.json'),
  hypotheses: load('hypotheses.json'),
  documents: load('documents.json'),
  contacts: load('contacts.json'),
  interviews: load('interviews.json'),
  actions: load('actions.json'),
  recommendations: load('recommendations.json'),
  epilogues: load('epilogues.json'),
}

const errors = []

if (bundle.case.schemaVersion !== 'v2') {
  errors.push(`case.schemaVersion must be "v2", got ${JSON.stringify(bundle.case.schemaVersion)}`)
}

// Mirror of validate-investigation.mjs's v2 path, intentionally a separate
// implementation so this smoke can run in isolation. Keep in sync.
const dupes = (label, ids) => {
  const seen = new Set()
  for (const id of ids) {
    if (seen.has(id)) errors.push(`Duplicate ${label} id: ${id}`)
    seen.add(id)
  }
}
dupes('hypothesis', bundle.hypotheses.map((h) => h.id))
dupes('document', bundle.documents.map((d) => d.id))
dupes('contact', bundle.contacts.map((c) => c.id))
dupes('interview', bundle.interviews.map((i) => i.id))
dupes('action', bundle.actions.map((a) => a.id))
dupes('recommendation', bundle.recommendations.map((r) => r.id))
dupes('epilogue', bundle.epilogues.map((e) => e.id))

const hypothesisIds = new Set(bundle.hypotheses.map((h) => h.id))
const documentIds = new Set(bundle.documents.map((d) => d.id))
const contactIds = new Set(bundle.contacts.map((c) => c.id))
const interviewIds = new Set(bundle.interviews.map((i) => i.id))
const actionIds = new Set(bundle.actions.map((a) => a.id))
const recommendationIds = new Set(bundle.recommendations.map((r) => r.id))

// keyPhrase.range bounds + effects references
for (const d of bundle.documents) {
  for (let i = 0; i < (d.keyPhrases ?? []).length; i++) {
    const kp = d.keyPhrases[i]
    const where = `Document ${d.id}.keyPhrases[${i}]`
    if (!Array.isArray(kp.range) || kp.range.length !== 2) {
      errors.push(`${where}.range must be [start, end)`)
      continue
    }
    const [s, e] = kp.range
    if (s < 0 || e > d.body.length || s >= e) {
      errors.push(`${where}.range out of [0, ${d.body.length}) or non-positive width`)
    }
    if (!Array.isArray(kp.effects) || kp.effects.length === 0) {
      errors.push(`${where}.effects must be a non-empty array`)
      continue
    }
    for (let j = 0; j < kp.effects.length; j++) {
      const ef = kp.effects[j]
      if (!hypothesisIds.has(ef.hypothesisId)) {
        errors.push(`${where}.effects[${j}].hypothesisId unknown: ${ef.hypothesisId}`)
      }
      if (!['strong', 'weak', 'counter'].includes(ef.weight)) {
        errors.push(`${where}.effects[${j}].weight must be strong|weak|counter`)
      }
    }
  }
  if (d.unlockedByAction && !actionIds.has(d.unlockedByAction)) {
    errors.push(`Document ${d.id} unlockedByAction unknown: ${d.unlockedByAction}`)
  }
}

// Contact gates + interview wiring
for (const c of bundle.contacts) {
  if (!interviewIds.has(c.interviewId)) {
    errors.push(`Contact ${c.id} interviewId unknown: ${c.interviewId}`)
  }
  const g = c.gateRequirement
  if (g?.requiredHypothesis && !hypothesisIds.has(g.requiredHypothesis)) {
    errors.push(`Contact ${c.id} gateRequirement.requiredHypothesis unknown: ${g.requiredHypothesis}`)
  }
  if (g?.requiredDocumentId && !documentIds.has(g.requiredDocumentId)) {
    errors.push(`Contact ${c.id} gateRequirement.requiredDocumentId unknown: ${g.requiredDocumentId}`)
  }
  if (c.initialState === 'gated' && !(g?.requiredHypothesis || g?.requiredDocumentId)) {
    errors.push(`Contact ${c.id} is gated but has no requiredHypothesis or requiredDocumentId`)
  }
}
for (const it of bundle.interviews) {
  if (!contactIds.has(it.contactId)) {
    errors.push(`Interview ${it.id} contactId unknown: ${it.contactId}`)
  }
  const nodeIds = new Set(it.nodes.map((n) => n.id))
  if (!nodeIds.has(it.startNodeId)) {
    errors.push(`Interview ${it.id} startNodeId unknown: ${it.startNodeId}`)
  }
  for (const n of it.nodes) {
    if (n.next !== undefined && !nodeIds.has(n.next)) {
      errors.push(`Interview ${it.id} node ${n.id} next unknown: ${n.next}`)
    }
    for (const ch of n.choices ?? []) {
      if (!nodeIds.has(ch.next)) {
        errors.push(`Interview ${it.id} node ${n.id} choice ${ch.id} next unknown: ${ch.next}`)
      }
      if (ch.requiresPhraseFromHypothesis && !hypothesisIds.has(ch.requiresPhraseFromHypothesis)) {
        errors.push(`Interview ${it.id} node ${n.id} choice ${ch.id} requiresPhraseFromHypothesis unknown: ${ch.requiresPhraseFromHypothesis}`)
      }
    }
  }
}

// Action effects
for (const a of bundle.actions) {
  for (const fx of a.effects ?? []) {
    if (fx.kind === 'unlockDocument' && !documentIds.has(fx.documentId)) {
      errors.push(`Action ${a.id} unlockDocument unknown: ${fx.documentId}`)
    }
    if (fx.kind === 'unlockContact' && !contactIds.has(fx.contactId)) {
      errors.push(`Action ${a.id} unlockContact unknown: ${fx.contactId}`)
    }
  }
}

// Recommendation requires
for (const r of bundle.recommendations) {
  for (const req of r.requiresHypotheses ?? []) {
    if (!hypothesisIds.has(req.hypothesisId)) {
      errors.push(`Recommendation ${r.id} requiresHypotheses unknown: ${req.hypothesisId}`)
    }
  }
}

// Epilogue coverage: 3 qualities × every recommendation
const byRec = new Map()
for (const e of bundle.epilogues) {
  if (!recommendationIds.has(e.recommendationId)) {
    errors.push(`Epilogue ${e.id} recommendationId unknown: ${e.recommendationId}`)
  }
  const set = byRec.get(e.recommendationId) ?? new Set()
  set.add(e.quality)
  byRec.set(e.recommendationId, set)
}
for (const r of bundle.recommendations) {
  for (const q of ['precise', 'imprecise', 'incorrect']) {
    if (!(byRec.get(r.id)?.has(q) ?? false)) {
      errors.push(`Recommendation ${r.id} missing "${q}" epilogue`)
    }
  }
}

const highlightEffects = (highlight) => {
  const document = bundle.documents.find((d) => d.id === highlight.documentId)
  if (!document) return []
  const byHypothesis = new Map()
  for (const kp of document.keyPhrases ?? []) {
    const [start, end] = highlight.range
    const [kpStart, kpEnd] = kp.range
    if (start >= kpEnd || end <= kpStart) continue
    for (const effect of kp.effects ?? []) {
      const previous = byHypothesis.get(effect.hypothesisId)
      const rank = { counter: 1, weak: 2, strong: 3 }
      if (!previous || rank[effect.weight] > rank[previous.weight]) {
        byHypothesis.set(effect.hypothesisId, effect)
      }
    }
  }
  return [...byHypothesis.values()]
}

const countNotebookSlots = (highlights) => {
  const counts = {}
  for (const h of bundle.hypotheses) counts[h.id] = { weak: 0, strong: 0, counter: 0 }
  for (const highlight of highlights) {
    for (const effect of highlightEffects(highlight)) {
      counts[effect.hypothesisId][effect.weight]++
    }
  }
  return counts
}

const computeQuality = (recommendation, highlights) => {
  if (recommendation.id === 'rec-respect-choice') {
    if (highlights.length < 3) return 'precise'
    if (highlights.length <= 6) return 'imprecise'
    return 'incorrect'
  }
  const counts = countNotebookSlots(highlights)
  const results = recommendation.requiresHypotheses.map((req) => {
    const slot = counts[req.hypothesisId]
    const available = req.minWeight === 'strong' ? slot.strong : slot.strong + slot.weak
    return available >= req.minSupportingPhrases
  })
  if (results.every(Boolean)) return 'precise'
  if (results.some(Boolean)) return 'imprecise'
  return 'incorrect'
}

const resolveEpilogueId = (recommendationId, highlights) => {
  const recommendation = bundle.recommendations.find((r) => r.id === recommendationId)
  const quality = computeQuality(recommendation, highlights)
  return bundle.epilogues.find(
    (e) => e.recommendationId === recommendationId && e.quality === quality,
  )?.id
}

const firstHighlight = (hypothesisId, weight) => {
  for (const document of bundle.documents) {
    for (const kp of document.keyPhrases ?? []) {
      if (kp.effects?.some((effect) => effect.hypothesisId === hypothesisId && effect.weight === weight)) {
        return { documentId: document.id, range: kp.range }
      }
    }
  }
  errors.push(`No test keyPhrase for ${hypothesisId}/${weight}`)
  return null
}

const allTestHighlights = []
for (const document of bundle.documents) {
  for (const kp of document.keyPhrases ?? []) {
    allTestHighlights.push({ documentId: document.id, range: kp.range })
  }
}
const compact = (items) => items.filter(Boolean)
const resolverStates = [
  { name: 'empty', highlights: [] },
  { name: 'sparse', highlights: compact([firstHighlight('h-mentor-dep', 'weak')]) },
  { name: 'moderate', highlights: allTestHighlights.slice(0, 4) },
  { name: 'dense', highlights: allTestHighlights.slice(0, 7) },
  {
    name: 'intervene-ready',
    highlights: compact([
      firstHighlight('h-financial', 'strong'),
      firstHighlight('h-financial', 'strong'),
      firstHighlight('h-isolation', 'weak'),
    ]),
  },
  {
    name: 'wait-ready',
    highlights: compact([
      firstHighlight('h-isolation', 'weak'),
      firstHighlight('h-mentor-dep', 'weak'),
    ]),
  },
]

let resolverCombos = 0
for (const state of resolverStates) {
  for (const recommendation of bundle.recommendations) {
    resolverCombos++
    const epilogueId = resolveEpilogueId(recommendation.id, state.highlights)
    if (!epilogueId || !bundle.epilogues.some((e) => e.id === epilogueId)) {
      errors.push(
        `Resolver combo ${state.name}/${recommendation.id} did not resolve to an epilogue`,
      )
    }
  }
}
const intervenePrecise = resolveEpilogueId(
  'rec-intervene',
  resolverStates.find((state) => state.name === 'intervene-ready').highlights,
)
if (intervenePrecise !== 'ep-intervene-precise-3') {
  errors.push(`rec-intervene precise fixture resolved to ${intervenePrecise}`)
}

// Visible-language scan: not an error gate, just surfaced.
const languageWarnings = scanCaseV2Content(bundle)

console.log(`[case-01-proryv]`)
console.log(`  schemaVersion: ${bundle.case.schemaVersion}`)
console.log(`  title: ${bundle.case.title}`)
console.log(`  protagonist: ${bundle.case.protagonist.name}`)
console.log(`  actionBudget: ${bundle.case.actionBudget}`)
console.log(
  `  counts: documents=${bundle.documents.length}, contacts=${bundle.contacts.length}, hypotheses=${bundle.hypotheses.length}, interviews=${bundle.interviews.length}, actions=${bundle.actions.length}, recommendations=${bundle.recommendations.length}, epilogues=${bundle.epilogues.length}`,
)
console.log(`  visible-language warnings: ${languageWarnings.length}`)
for (const w of languageWarnings) console.log(`   - ${w}`)
console.log(`  epilogue resolver combos: ${resolverCombos} checked`)

// keyPhrase totals — per-hypothesis breakdown so it's obvious by eyeball
// whether the wire-in step actually attached phrases to each hypothesis.
const totals = { all: 0 }
for (const h of bundle.hypotheses) {
  totals[h.id] = { strong: 0, weak: 0, counter: 0 }
}
for (const d of bundle.documents) {
  for (const kp of d.keyPhrases ?? []) {
    totals.all++
    for (const ef of kp.effects ?? []) {
      const slot = totals[ef.hypothesisId]
      if (slot && (ef.weight in slot)) slot[ef.weight]++
    }
  }
}
const formatSlot = (slot) => {
  if (!slot) return '(no data)'
  const counter = slot.counter
  if (counter > 0) return `${slot.strong}s/${slot.weak}w/${counter}c`
  return `${slot.strong}s/${slot.weak}w`
}
const lines = bundle.hypotheses.map((h) => `${h.id} (${formatSlot(totals[h.id])})`)
console.log(`  keyPhrase totals: ${totals.all} total, ${lines.join(', ')}`)

if (errors.length === 0) {
  console.log('\nOK: case-01-proryv v2 bundle is valid')
  process.exit(0)
} else {
  console.error('\nFAIL: case-01-proryv v2 bundle has errors:')
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}
