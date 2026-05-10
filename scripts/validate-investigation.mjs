// One-off validation runner for the seed investigation case.
// Reads the JSON files directly and re-implements the same validator semantics
// as src/game/investigation/contentSchema.ts so we can sanity-check the seed
// without spinning up a full TS toolchain. The TS validator remains the
// source of truth at runtime.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const base = join(__dirname, '..', 'src', 'game', 'cases', 'info-business-marathon')
const load = (file) => JSON.parse(readFileSync(join(base, file), 'utf8'))

const content = {
  case: load('case.json'),
  persons: load('persons.json'),
  sources: load('sources.json'),
  evidence: load('evidence.json'),
  patterns: load('patterns.json'),
  report: load('report.json'),
  debrief: load('debrief.json'),
}

const isInRange = (v, min, max) =>
  Number.isFinite(v) && v >= min && v <= max

const dupes = (label, ids) => {
  const errs = []
  const seen = new Set()
  for (const id of ids) {
    if (seen.has(id)) errs.push(`Duplicate ${label} id: ${id}`)
    else seen.add(id)
  }
  return errs
}

const errors = []
const sourceIds = new Set(content.sources.map((s) => s.id))
const personIds = new Set(content.persons.map((p) => p.id))
const evidenceIds = new Set(content.evidence.map((e) => e.id))
const patternIds = new Set(content.patterns.map((p) => p.id))

// case
const c = content.case
if (!c.id) errors.push('Case is missing id')
if (!c.title) errors.push(`Case ${c.id} is missing title`)
if (c.initialSourceIds.length === 0) errors.push(`Case ${c.id} has empty initialSourceIds`)
if (c.initialPersonIds.length === 0) errors.push(`Case ${c.id} has empty initialPersonIds`)
if (c.themeTags.length === 0) errors.push(`Case ${c.id} has empty themeTags`)
for (const id of c.initialSourceIds)
  if (!sourceIds.has(id)) errors.push(`Case initialSourceIds references unknown source: ${id}`)
for (const id of c.initialPersonIds)
  if (!personIds.has(id)) errors.push(`Case initialPersonIds references unknown person: ${id}`)

// persons
errors.push(...dupes('person', content.persons.map((p) => p.id)))
for (const p of content.persons) {
  if (!p.name) errors.push(`Person ${p.id} is missing name`)
  if (!isInRange(p.riskLevel, 0, 100)) errors.push(`Person ${p.id} riskLevel out of range`)
  if (!isInRange(p.influenceLevel, 0, 100)) errors.push(`Person ${p.id} influenceLevel out of range`)
  if (!isInRange(p.credibility, 0, 100)) errors.push(`Person ${p.id} credibility out of range`)
  for (const sid of p.sourceIds)
    if (!sourceIds.has(sid)) errors.push(`Person ${p.id} sourceIds references unknown source: ${sid}`)
}

// sources
errors.push(...dupes('source', content.sources.map((s) => s.id)))
for (const s of content.sources) {
  if (!s.title) errors.push(`Source ${s.id} is missing title`)
  if (!isInRange(s.reliability, 0, 100)) errors.push(`Source ${s.id} reliability out of range`)
  for (const eid of s.unlockedByEvidenceIds)
    if (!evidenceIds.has(eid)) errors.push(`Source ${s.id} unlockedByEvidenceIds references unknown evidence: ${eid}`)
}

// evidence
errors.push(...dupes('evidence', content.evidence.map((e) => e.id)))
for (const e of content.evidence) {
  if (!e.text) errors.push(`Evidence ${e.id} has empty text`)
  if (!sourceIds.has(e.sourceId)) errors.push(`Evidence ${e.id} sourceId references unknown source: ${e.sourceId}`)
  if (!isInRange(e.reliability, 0, 100)) errors.push(`Evidence ${e.id} reliability out of range`)
  if (![1, 2, 3, 4, 5].includes(e.weight)) errors.push(`Evidence ${e.id} weight must be 1..5`)
  for (const id of e.linksToPersonIds)
    if (!personIds.has(id)) errors.push(`Evidence ${e.id} linksToPersonIds references unknown person: ${id}`)
  for (const id of e.suggestedPatternIds)
    if (!patternIds.has(id)) errors.push(`Evidence ${e.id} suggestedPatternIds references unknown pattern: ${id}`)
  for (const sid of e.unlocksSourceIds) {
    if (!sourceIds.has(sid)) errors.push(`Evidence ${e.id} unlocksSourceIds references unknown source: ${sid}`)
    if (sid === e.sourceId) errors.push(`Evidence ${e.id} cannot unlock its own source: ${sid}`)
  }
}

// patterns
errors.push(...dupes('pattern', content.patterns.map((p) => p.id)))
for (const p of content.patterns) {
  if (!p.title) errors.push(`Pattern ${p.id} is missing title`)
  if (p.requiredEvidenceCount < 1) errors.push(`Pattern ${p.id} requiredEvidenceCount must be >= 1`)
  for (const id of [...p.strongEvidenceIds, ...p.weakEvidenceIds, ...p.counterEvidenceIds])
    if (!evidenceIds.has(id)) errors.push(`Pattern ${p.id} references unknown evidence: ${id}`)
}

// report
if (content.report.outcomes.length === 0) errors.push('Report has no outcomes')
errors.push(...dupes('report outcome', content.report.outcomes.map((o) => o.id)))
for (const o of content.report.outcomes) {
  if (!o.title) errors.push(`Report outcome ${o.id} is missing title`)
  for (const id of [...o.requiredPatternIds, ...o.forbiddenPatternIds])
    if (!patternIds.has(id)) errors.push(`Report outcome ${o.id} references unknown pattern: ${id}`)
  const req = new Set(o.requiredPatternIds)
  for (const id of o.forbiddenPatternIds)
    if (req.has(id)) errors.push(`Report outcome ${o.id} has pattern ${id} in both required and forbidden`)
}

// debrief
errors.push(...dupes('debrief', content.debrief.map((d) => d.id)))
for (const d of content.debrief) {
  if (!d.term) errors.push(`Debrief ${d.id} is missing term`)
  for (const eid of d.exampleEvidenceIds)
    if (!evidenceIds.has(eid)) errors.push(`Debrief ${d.id} exampleEvidenceIds references unknown evidence: ${eid}`)
}

console.log(`Counts: persons=${content.persons.length}, sources=${content.sources.length}, evidence=${content.evidence.length}, patterns=${content.patterns.length}, outcomes=${content.report.outcomes.length}, debrief=${content.debrief.length}`)

if (errors.length === 0) {
  console.log('OK: investigation content is valid')
  process.exit(0)
} else {
  console.error(`FAIL: ${errors.length} validation errors`)
  for (const e of errors) console.error(' - ' + e)
  process.exit(1)
}
