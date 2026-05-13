// Offline validator for investigation case content.
//
// Reads the JSON files directly and re-implements the schema validator semantics
// from src/game/investigation/contentSchema.ts so we can sanity-check content
// without spinning up a full TS toolchain. The TS validator remains the source
// of truth at runtime; this script adds additional content-design warnings that
// would be too noisy to enforce at runtime.
//
// The script auto-discovers every subdirectory of `src/game/cases/` that has a
// `case.json`, validates each independently, and reports counts/warnings/errors
// per case. Exit code is 1 if any case has structural errors.
//
// Errors (exit 1):
//   - structural issues (duplicate ids, dangling references, out-of-range numbers,
//     missing required fields, debrief entries pointing to unknown evidence ids).
//
// Warnings (do not fail):
//   - unreachable sources (not initial and not unlocked by any evidence);
//   - sources with no visible non-red-herring fragments;
//   - orphan patterns (no strong/weak/suggested evidence);
//   - patterns without a matching debrief entry;
//   - missing low / medium / strong report outcomes;
//   - primary-label language regressions in visible gameplay fields.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  scanCaseV2Content,
  scanInvestigationContent,
} from './lib/visible-language.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const casesRoot = join(__dirname, '..', 'src', 'game', 'cases')

const caseDirs = readdirSync(casesRoot)
  .map((name) => join(casesRoot, name))
  .filter((p) => {
    try {
      return statSync(p).isDirectory() && existsSync(join(p, 'case.json'))
    } catch {
      return false
    }
  })
  .sort()

if (caseDirs.length === 0) {
  console.error(`No case folders with case.json found under ${casesRoot}`)
  process.exit(1)
}

const isInRange = (v, min, max) =>
  Number.isFinite(v) && v >= min && v <= max

// Fallback used when `report.thresholds.minConfirmedPatternsForStrongOutcome`
// is absent. `report.thresholds` is a validator-only authoring aid and is no
// longer required by the type; the coverage check needs a concrete number to
// classify outcomes as low / medium / strong.
const DEFAULT_STRONG_THRESHOLD = 4

const deriveStrongThreshold = (content) => {
  let max = 0
  for (const o of content.report.outcomes) {
    const v = Number(o?.minPatternConfirmedCount)
    if (Number.isFinite(v) && v > max) max = v
  }
  return max > 0 ? max : DEFAULT_STRONG_THRESHOLD
}

const dupes = (label, ids) => {
  const errs = []
  const seen = new Set()
  for (const id of ids) {
    if (seen.has(id)) errs.push(`Duplicate ${label} id: ${id}`)
    else seen.add(id)
  }
  return errs
}

function loadCaseJsonOnly(caseDir) {
  return JSON.parse(readFileSync(join(caseDir, 'case.json'), 'utf8'))
}

// Dispatch helper: returns 'v2' for v2 cases, 'v1' for legacy cases. We
// require case.json to exist on disk; any other shape (missing field, value
// like 'v3') falls through to the v1 path so old content keeps loading.
function detectSchemaVersion(caseJson) {
  if (caseJson && caseJson.schemaVersion === 'v2') return 'v2'
  return 'v1'
}

function validateCaseV1(caseDir) {
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
  const caseId = content.case.id

  const errors = []
  const warnings = []

  const sourceIds = new Set(content.sources.map((s) => s.id))
  const personIds = new Set(content.persons.map((p) => p.id))
  const evidenceIds = new Set(content.evidence.map((e) => e.id))
  const patternIds = new Set(content.patterns.map((p) => p.id))

  // ---- Hard errors (existing structural checks) -----------------------------

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

  // debrief (hard error: unknown evidence)
  errors.push(...dupes('debrief', content.debrief.map((d) => d.id)))
  for (const d of content.debrief) {
    if (!d.term) errors.push(`Debrief ${d.id} is missing term`)
    for (const eid of d.exampleEvidenceIds)
      if (!evidenceIds.has(eid)) errors.push(`Debrief ${d.id} exampleEvidenceIds references unknown evidence: ${eid}`)
  }

  // ---- Warnings -------------------------------------------------------------

  // 1. Source reachability: warn if a source is neither initial nor unlocked by any evidence.
  {
    const initial = new Set(c.initialSourceIds)
    const unlockedByEvidence = new Set()
    for (const e of content.evidence) {
      for (const sid of e.unlocksSourceIds) unlockedByEvidence.add(sid)
    }
    for (const s of content.sources) {
      if (!initial.has(s.id) && !unlockedByEvidence.has(s.id)) {
        warnings.push(`source ${s.id} is not in case.initialSourceIds and is not unlocked by any evidence; it may be unreachable in play`)
      }
    }
  }

  // 2. Empty source display: warn if a source has no visible non-red-herring fragments.
  {
    const visibleBySource = new Map()
    for (const e of content.evidence) {
      if (e.defaultVisible && !e.isRedHerring) {
        visibleBySource.set(e.sourceId, (visibleBySource.get(e.sourceId) ?? 0) + 1)
      }
    }
    for (const s of content.sources) {
      if (!visibleBySource.has(s.id)) {
        warnings.push(`source ${s.id} has no visible non-red-herring fragments; opening it in the dossier will look empty`)
      }
    }
  }

  // 3. Orphan patterns: warn if a pattern has no strong/weak evidence AND no evidence suggests it.
  {
    const suggestedByEvidence = new Set()
    for (const e of content.evidence) {
      for (const pid of e.suggestedPatternIds) suggestedByEvidence.add(pid)
    }
    for (const p of content.patterns) {
      const linked =
        p.strongEvidenceIds.length > 0 ||
        p.weakEvidenceIds.length > 0 ||
        suggestedByEvidence.has(p.id)
      if (!linked) {
        warnings.push(`pattern ${p.id} has no strong/weak evidence and no evidence suggests it; it is unreachable from gameplay`)
      }
    }
  }

  // 4. Debrief coverage: warn if a pattern has no matching debrief entry.
  // Heuristic: a pattern p_X is covered if there is a debrief whose id is the
  // p_X → d_X transform, OR whose exampleEvidenceIds intersects the pattern's
  // strong/weak evidence.
  {
    const debriefIds = new Set(content.debrief.map((d) => d.id))
    for (const p of content.patterns) {
      const expected = p.id.replace(/^p_/, 'd_')
      let covered = debriefIds.has(expected)
      if (!covered) {
        const patternEvidence = new Set([...p.strongEvidenceIds, ...p.weakEvidenceIds])
        for (const d of content.debrief) {
          for (const eid of d.exampleEvidenceIds) {
            if (patternEvidence.has(eid)) {
              covered = true
              break
            }
          }
          if (covered) break
        }
      }
      if (!covered) {
        warnings.push(`pattern ${p.id} has no matching debrief entry (expected debrief id ${expected} or an entry sharing one of its evidence fragments)`)
      }
    }
  }

  // 5. Report outcome coverage: warn if low/medium/strong outcomes are missing.
  {
    const authoredStrong =
      content?.report?.thresholds?.minConfirmedPatternsForStrongOutcome
    const strongThreshold = Number.isFinite(authoredStrong)
      ? authoredStrong
      : deriveStrongThreshold(content)
    if (!content?.report?.thresholds) {
      warnings.push(
        `report.thresholds is absent; using derived strong threshold = ${strongThreshold} for coverage check`,
      )
    }
    let hasLow = false
    let hasMedium = false
    let hasStrong = false
    for (const o of content.report.outcomes) {
      const min = o.minPatternConfirmedCount ?? 0
      if (min === 0) hasLow = true
      else if (min > 0 && min < strongThreshold) hasMedium = true
      else if (min >= strongThreshold) hasStrong = true
    }
    if (!hasLow) {
      warnings.push('report has no low-information outcome (minPatternConfirmedCount === 0); player has no graceful early-exit summary')
    }
    if (!hasMedium) {
      warnings.push(`report has no medium/warning outcome (minPatternConfirmedCount between 1 and ${strongThreshold - 1}); player has no middle-ground framing`)
    }
    if (!hasStrong) {
      warnings.push(`report has no strong/system outcome (minPatternConfirmedCount >= ${strongThreshold}); fully-resolved play has no payoff`)
    }
  }

  // 6. Language guardrails: warn for primary-label terms in visible gameplay
  //    fields. The deny list and per-field scan live in
  //    scripts/lib/visible-language.mjs so the standalone
  //    `audit:visible-language` CLI can reuse the exact same rules.
  for (const w of scanInvestigationContent(content)) warnings.push(w)

  return {
    caseId,
    schemaVersion: 'v1',
    summary: `Counts: persons=${content.persons.length}, sources=${content.sources.length}, evidence=${content.evidence.length}, patterns=${content.patterns.length}, outcomes=${content.report.outcomes.length}, debrief=${content.debrief.length}`,
    errors,
    warnings,
  }
}

// ---- v2 validator -----------------------------------------------------------
//
// v2 cases use a different on-disk shape (see src/game/investigation/types.ts).
// Hard errors here mirror Dev α brief §3 cross-checks; warnings flag
// quality-of-life concerns (e.g. quality coverage that's "technically valid"
// but produces a player-unfriendly experience).

function validateCaseV2(caseDir) {
  const loadOptional = (file) => {
    const p = join(caseDir, file)
    if (!existsSync(p)) return null
    return JSON.parse(readFileSync(p, 'utf8'))
  }
  const load = (file) => {
    const v = loadOptional(file)
    if (v === null) {
      throw new Error(`v2 case ${caseDir} is missing required file: ${file}`)
    }
    return v
  }

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
  const caseId = bundle.case.id
  const errors = []
  const warnings = []

  // ---- case.json shape ------------------------------------------------------
  const c = bundle.case
  if (!c.id) errors.push('Case is missing id')
  if (!c.title) errors.push(`Case ${c.id} is missing title`)
  if (!c.protagonist || !c.protagonist.name) {
    errors.push(`Case ${c.id} is missing protagonist.name`)
  }
  if (!c.brief || typeof c.brief.from !== 'string' || typeof c.brief.body !== 'string') {
    errors.push(`Case ${c.id} is missing brief.from / brief.body`)
  }
  if (!Number.isFinite(c.actionBudget) || c.actionBudget < 1) {
    errors.push(`Case ${c.id} actionBudget must be >= 1`)
  }

  // ---- id sets used for cross-references ------------------------------------
  errors.push(...dupes('hypothesis', bundle.hypotheses.map((h) => h.id)))
  errors.push(...dupes('document', bundle.documents.map((d) => d.id)))
  errors.push(...dupes('contact', bundle.contacts.map((ct) => ct.id)))
  errors.push(...dupes('interview', bundle.interviews.map((it) => it.id)))
  errors.push(...dupes('action', bundle.actions.map((a) => a.id)))
  errors.push(...dupes('recommendation', bundle.recommendations.map((r) => r.id)))
  errors.push(...dupes('epilogue', bundle.epilogues.map((e) => e.id)))

  const hypothesisIds = new Set(bundle.hypotheses.map((h) => h.id))
  const documentIds = new Set(bundle.documents.map((d) => d.id))
  const contactIds = new Set(bundle.contacts.map((ct) => ct.id))
  const interviewIds = new Set(bundle.interviews.map((it) => it.id))
  const actionIds = new Set(bundle.actions.map((a) => a.id))
  const recommendationIds = new Set(bundle.recommendations.map((r) => r.id))

  // ---- documents ------------------------------------------------------------
  for (const d of bundle.documents) {
    if (!d.id) errors.push('Document is missing id')
    if (typeof d.body !== 'string') {
      errors.push(`Document ${d.id} body must be a string`)
      continue
    }
    if (d.unlockedByAction && !actionIds.has(d.unlockedByAction)) {
      errors.push(
        `Document ${d.id} unlockedByAction references unknown action: ${d.unlockedByAction}`,
      )
    }
    if (!Array.isArray(d.keyPhrases)) {
      errors.push(`Document ${d.id} keyPhrases must be an array`)
      continue
    }
    for (let i = 0; i < d.keyPhrases.length; i++) {
      const kp = d.keyPhrases[i]
      const where = `Document ${d.id}.keyPhrases[${i}]`
      if (!Array.isArray(kp.range) || kp.range.length !== 2) {
        errors.push(`${where}.range must be [start, end)`)
        continue
      }
      const [s, e] = kp.range
      if (!Number.isInteger(s) || !Number.isInteger(e)) {
        errors.push(`${where}.range must be integers`)
      } else if (s < 0 || e > d.body.length || s >= e) {
        errors.push(
          `${where}.range [${s}, ${e}) out of [0, ${d.body.length}) or non-positive width`,
        )
      }
      if (!Array.isArray(kp.effects) || kp.effects.length === 0) {
        errors.push(`${where}.effects must be a non-empty array of {hypothesisId, weight}`)
      } else {
        for (let j = 0; j < kp.effects.length; j++) {
          const ef = kp.effects[j]
          const ewhere = `${where}.effects[${j}]`
          if (typeof ef.hypothesisId !== 'string' || !ef.hypothesisId) {
            errors.push(`${ewhere}.hypothesisId must be a non-empty string`)
          } else if (!hypothesisIds.has(ef.hypothesisId)) {
            errors.push(`${ewhere}.hypothesisId references unknown hypothesis: ${ef.hypothesisId}`)
          }
          if (!['strong', 'weak', 'counter'].includes(ef.weight)) {
            errors.push(`${ewhere}.weight must be strong|weak|counter`)
          }
        }
      }
    }
  }

  // ---- contacts -------------------------------------------------------------
  for (const ct of bundle.contacts) {
    if (!['public', 'gated', 'hostile', 'unknown'].includes(ct.initialState)) {
      errors.push(`Contact ${ct.id} has invalid initialState ${ct.initialState}`)
    }
    if (!interviewIds.has(ct.interviewId)) {
      errors.push(
        `Contact ${ct.id} interviewId references unknown interview: ${ct.interviewId}`,
      )
    }
    const gate = ct.gateRequirement
    if (gate) {
      if (gate.requiredHypothesis && !hypothesisIds.has(gate.requiredHypothesis)) {
        errors.push(
          `Contact ${ct.id} gateRequirement.requiredHypothesis references unknown hypothesis: ${gate.requiredHypothesis}`,
        )
      }
      if (gate.minWeight && !['weak', 'strong'].includes(gate.minWeight)) {
        errors.push(`Contact ${ct.id} gateRequirement.minWeight must be weak|strong`)
      }
      if (
        gate.minSupportingPhrases !== undefined &&
        (!Number.isInteger(gate.minSupportingPhrases) || gate.minSupportingPhrases < 0)
      ) {
        errors.push(`Contact ${ct.id} gateRequirement.minSupportingPhrases must be a non-negative integer`)
      }
      if (gate.requiredDocumentId && !documentIds.has(gate.requiredDocumentId)) {
        errors.push(
          `Contact ${ct.id} gateRequirement.requiredDocumentId references unknown document: ${gate.requiredDocumentId}`,
        )
      }
    }
    if (ct.initialState === 'gated') {
      if (!gate || (!gate.requiredHypothesis && !gate.requiredDocumentId)) {
        errors.push(
          `Contact ${ct.id} is gated but has no requiredHypothesis or requiredDocumentId`,
        )
      }
    }
  }

  // ---- interviews -----------------------------------------------------------
  for (const it of bundle.interviews) {
    if (!contactIds.has(it.contactId)) {
      errors.push(`Interview ${it.id} contactId references unknown contact: ${it.contactId}`)
    }
    const nodeIds = new Set(it.nodes.map((n) => n.id))
    errors.push(...dupes(`interview ${it.id} node`, it.nodes.map((n) => n.id)))
    if (!nodeIds.has(it.startNodeId)) {
      errors.push(`Interview ${it.id} startNodeId references unknown node: ${it.startNodeId}`)
    }
    for (const n of it.nodes) {
      if (!['expert', 'contact'].includes(n.speaker)) {
        errors.push(`Interview ${it.id} node ${n.id} speaker must be expert|contact`)
      }
      if (n.next !== undefined && !nodeIds.has(n.next)) {
        errors.push(`Interview ${it.id} node ${n.id} next references unknown node: ${n.next}`)
      }
      for (const ch of n.choices ?? []) {
        if (!nodeIds.has(ch.next)) {
          errors.push(
            `Interview ${it.id} node ${n.id} choice ${ch.id} next references unknown node: ${ch.next}`,
          )
        }
        if (ch.requiresPhraseFromHypothesis && !hypothesisIds.has(ch.requiresPhraseFromHypothesis)) {
          errors.push(
            `Interview ${it.id} node ${n.id} choice ${ch.id} requiresPhraseFromHypothesis references unknown hypothesis: ${ch.requiresPhraseFromHypothesis}`,
          )
        }
      }
    }
  }

  // ---- actions --------------------------------------------------------------
  for (const a of bundle.actions) {
    if (!Number.isInteger(a.cost) || a.cost < 0) {
      errors.push(`Action ${a.id} cost must be a non-negative integer`)
    }
    if (!Array.isArray(a.effects)) {
      errors.push(`Action ${a.id} effects must be an array`)
      continue
    }
    for (const fx of a.effects) {
      if (fx.kind === 'unlockDocument') {
        if (!documentIds.has(fx.documentId)) {
          errors.push(`Action ${a.id} unlockDocument references unknown document: ${fx.documentId}`)
        }
      } else if (fx.kind === 'unlockContact') {
        if (!contactIds.has(fx.contactId)) {
          errors.push(`Action ${a.id} unlockContact references unknown contact: ${fx.contactId}`)
        }
      } else {
        errors.push(`Action ${a.id} has unknown effect kind: ${fx.kind}`)
      }
    }
  }

  // ---- recommendations ------------------------------------------------------
  for (const r of bundle.recommendations) {
    if (!Array.isArray(r.requiresHypotheses)) {
      errors.push(`Recommendation ${r.id} requiresHypotheses must be an array`)
      continue
    }
    for (const req of r.requiresHypotheses) {
      if (!hypothesisIds.has(req.hypothesisId)) {
        errors.push(
          `Recommendation ${r.id} requiresHypotheses references unknown hypothesis: ${req.hypothesisId}`,
        )
      }
      if (!['weak', 'strong'].includes(req.minWeight)) {
        errors.push(`Recommendation ${r.id} requiresHypotheses[${req.hypothesisId}].minWeight must be weak|strong`)
      }
      if (!Number.isInteger(req.minSupportingPhrases) || req.minSupportingPhrases < 0) {
        errors.push(
          `Recommendation ${r.id} requiresHypotheses[${req.hypothesisId}].minSupportingPhrases must be a non-negative integer`,
        )
      }
    }
  }

  // ---- epilogues ------------------------------------------------------------
  const epiloguesByRec = new Map()
  for (const e of bundle.epilogues) {
    if (!recommendationIds.has(e.recommendationId)) {
      errors.push(`Epilogue ${e.id} recommendationId references unknown recommendation: ${e.recommendationId}`)
    }
    if (!['precise', 'imprecise', 'incorrect'].includes(e.quality)) {
      errors.push(`Epilogue ${e.id} quality must be precise|imprecise|incorrect`)
    }
    if (![3, 6, 12].includes(e.monthsAhead)) {
      errors.push(`Epilogue ${e.id} monthsAhead must be 3|6|12`)
    }
    const bucket = epiloguesByRec.get(e.recommendationId) ?? new Set()
    bucket.add(e.quality)
    epiloguesByRec.set(e.recommendationId, bucket)
  }
  for (const r of bundle.recommendations) {
    const qualities = epiloguesByRec.get(r.id) ?? new Set()
    for (const q of ['precise', 'imprecise', 'incorrect']) {
      if (!qualities.has(q)) {
        errors.push(`Recommendation ${r.id} is missing a "${q}" epilogue`)
      }
    }
  }

  // ---- visible-language scan ------------------------------------------------
  for (const w of scanCaseV2Content(bundle)) warnings.push(w)

  return {
    caseId,
    schemaVersion: 'v2',
    summary: `Counts: documents=${bundle.documents.length}, contacts=${bundle.contacts.length}, hypotheses=${bundle.hypotheses.length}, interviews=${bundle.interviews.length}, actions=${bundle.actions.length}, recommendations=${bundle.recommendations.length}, epilogues=${bundle.epilogues.length}`,
    errors,
    warnings,
  }
}

// ---- Dispatch ---------------------------------------------------------------

function validateCase(caseDir) {
  const caseJson = loadCaseJsonOnly(caseDir)
  const version = detectSchemaVersion(caseJson)
  if (version === 'v2') return validateCaseV2(caseDir)
  return validateCaseV1(caseDir)
}

// ---- Run for every case folder ---------------------------------------------

let totalErrors = 0

for (const caseDir of caseDirs) {
  const { caseId, schemaVersion, summary, errors, warnings } = validateCase(caseDir)
  console.log(`\n[${caseId}] (${schemaVersion})`)
  console.log(`  ${summary}`)

  if (warnings.length > 0) {
    console.log('  Warnings:')
    for (const w of warnings) console.log('   - ' + w)
  }

  if (errors.length === 0) {
    console.log('  OK: investigation content is valid')
  } else {
    totalErrors += errors.length
    console.error('  Errors:')
    for (const e of errors) console.error('   - ' + e)
  }
}

console.log()
if (totalErrors === 0) {
  console.log('OK: all investigation cases are valid')
  process.exit(0)
} else {
  console.error(`Investigation content validation failed (${totalErrors} error(s) across ${caseDirs.length} case(s))`)
  process.exit(1)
}
