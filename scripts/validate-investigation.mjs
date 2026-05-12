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

import { scanInvestigationContent, scanV2Content } from './lib/visible-language.mjs'

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

// ---------------------------------------------------------------------------
// v2 validator
// ---------------------------------------------------------------------------

function validateCaseV2(caseDir, caseManifest) {
  const load = (file) => JSON.parse(readFileSync(join(caseDir, file), 'utf8'))
  const hypotheses = load('hypotheses.json')
  const documents = load('documents.json')
  const contacts = load('contacts.json')
  const interviews = load('interviews.json')
  const actions = load('actions.json')
  const recommendations = load('recommendations.json')
  const epilogues = load('epilogues.json')

  const caseId = caseManifest.id
  const errors = []
  const warnings = []

  // Collect id sets
  const hypothesisIds = new Set(hypotheses.map((h) => h.id))
  const documentIds = new Set(documents.map((d) => d.id))
  const contactIds = new Set(contacts.map((c) => c.id))
  const interviewIds = new Set(interviews.map((i) => i.id))
  const actionIds = new Set(actions.map((a) => a.id))
  const recommendationIds = new Set(recommendations.map((r) => r.id))

  // Duplicate ids
  errors.push(...dupes('hypothesis', hypotheses.map((h) => h.id)))
  errors.push(...dupes('document', documents.map((d) => d.id)))
  errors.push(...dupes('contact', contacts.map((c) => c.id)))
  errors.push(...dupes('interview', interviews.map((i) => i.id)))
  errors.push(...dupes('action', actions.map((a) => a.id)))
  errors.push(...dupes('recommendation', recommendations.map((r) => r.id)))
  errors.push(...dupes('epilogue', epilogues.map((e) => e.id)))

  // KeyPhrase validation
  for (const doc of documents) {
    for (let i = 0; i < doc.keyPhrases.length; i++) {
      const kp = doc.keyPhrases[i]
      const prefix = `document[${doc.id}].keyPhrases[${i}]`
      if (!Array.isArray(kp.range) || kp.range.length !== 2) {
        errors.push(`${prefix}: range must be a [start, end) pair`)
      } else {
        const [start, end] = kp.range
        if (start < 0 || end > doc.body.length || start >= end) {
          errors.push(`${prefix}: range [${start}, ${end}) out of bounds (body length ${doc.body.length})`)
        }
      }
      if (Array.isArray(kp.worksOn)) {
        for (const hid of kp.worksOn) {
          if (!hypothesisIds.has(hid)) {
            errors.push(`${prefix}.worksOn references unknown hypothesis: ${hid}`)
          }
        }
      }
    }
  }

  // Contact.gateRequirement.requiredHypothesis
  for (const ct of contacts) {
    if (ct.gateRequirement?.requiredHypothesis) {
      if (!hypothesisIds.has(ct.gateRequirement.requiredHypothesis)) {
        errors.push(`contact[${ct.id}].gateRequirement.requiredHypothesis references unknown hypothesis: ${ct.gateRequirement.requiredHypothesis}`)
      }
    }
    // Contact.interviewId
    if (!interviewIds.has(ct.interviewId)) {
      errors.push(`contact[${ct.id}].interviewId references unknown interview: ${ct.interviewId}`)
    }
  }

  // Interview.contactId + node references
  for (const intv of interviews) {
    if (!contactIds.has(intv.contactId)) {
      errors.push(`interview[${intv.id}].contactId references unknown contact: ${intv.contactId}`)
    }
    const nodeIds = new Set(intv.nodes.map((n) => n.id))
    errors.push(...dupes(`interview[${intv.id}] node`, intv.nodes.map((n) => n.id)))
    if (!nodeIds.has(intv.startNodeId)) {
      errors.push(`interview[${intv.id}].startNodeId references unknown node: ${intv.startNodeId}`)
    }
    for (const node of intv.nodes) {
      if (node.next !== undefined && !nodeIds.has(node.next)) {
        errors.push(`interview[${intv.id}].node[${node.id}].next references unknown node: ${node.next}`)
      }
      if (Array.isArray(node.choices)) {
        for (const ch of node.choices) {
          if (!nodeIds.has(ch.next)) {
            errors.push(`interview[${intv.id}].node[${node.id}].choice[${ch.id}].next references unknown node: ${ch.next}`)
          }
          if (ch.requiresPhraseFromHypothesis && !hypothesisIds.has(ch.requiresPhraseFromHypothesis)) {
            errors.push(`interview[${intv.id}].node[${node.id}].choice[${ch.id}].requiresPhraseFromHypothesis references unknown hypothesis: ${ch.requiresPhraseFromHypothesis}`)
          }
        }
      }
    }
  }

  // Action effects
  for (const act of actions) {
    for (const eff of act.effects) {
      if (eff.kind === 'unlockDocument' && !documentIds.has(eff.documentId)) {
        errors.push(`action[${act.id}].effect unlockDocument references unknown document: ${eff.documentId}`)
      }
      if (eff.kind === 'unlockContact' && !contactIds.has(eff.contactId)) {
        errors.push(`action[${act.id}].effect unlockContact references unknown contact: ${eff.contactId}`)
      }
    }
  }

  // Recommendation.requiresHypotheses
  for (const rec of recommendations) {
    for (const req of rec.requiresHypotheses) {
      if (!hypothesisIds.has(req.hypothesisId)) {
        errors.push(`recommendation[${rec.id}].requiresHypotheses references unknown hypothesis: ${req.hypothesisId}`)
      }
    }
  }

  // Epilogue.recommendationId + quality coverage
  const epiloguesByRec = new Map()
  for (const ep of epilogues) {
    if (!recommendationIds.has(ep.recommendationId)) {
      errors.push(`epilogue[${ep.id}].recommendationId references unknown recommendation: ${ep.recommendationId}`)
    }
    if (!epiloguesByRec.has(ep.recommendationId)) epiloguesByRec.set(ep.recommendationId, new Set())
    epiloguesByRec.get(ep.recommendationId).add(ep.quality)
  }
  for (const rec of recommendations) {
    const quals = epiloguesByRec.get(rec.id) ?? new Set()
    for (const q of ['precise', 'imprecise', 'incorrect']) {
      if (!quals.has(q)) {
        errors.push(`recommendation[${rec.id}] is missing an epilogue with quality "${q}"`)
      }
    }
  }

  // actionBudget sanity
  if (!(caseManifest.actionBudget >= 1)) {
    errors.push('actionBudget must be >= 1')
  }

  // Language guardrails
  const v2Content = {
    caseManifest,
    hypotheses,
    documents,
    contacts,
    interviews,
    actions,
    recommendations,
    epilogues,
  }
  for (const w of scanV2Content(v2Content)) warnings.push(w)

  const counts = {
    documents: documents.length,
    contacts: contacts.length,
    hypotheses: hypotheses.length,
    interviews: interviews.length,
    actions: actions.length,
    recommendations: recommendations.length,
    epilogues: epilogues.length,
  }

  return { caseId, counts, errors, warnings, isV2: true }
}

// ---------------------------------------------------------------------------
// v1 validator
// ---------------------------------------------------------------------------

function validateCase(caseDir) {
  const load = (file) => JSON.parse(readFileSync(join(caseDir, file), 'utf8'))
  const caseManifest = load('case.json')
  if (caseManifest.schemaVersion === 'v2') return validateCaseV2(caseDir, caseManifest)
  const content = {
    case: caseManifest,
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

  return { caseId, content, errors, warnings }
}

// ---- Run for every case folder ---------------------------------------------

let totalErrors = 0

for (const caseDir of caseDirs) {
  const result = validateCase(caseDir)
  const { caseId, errors, warnings } = result
  console.log(`\n[${caseId}]`)

  if (result.isV2) {
    const c = result.counts
    console.log(`  Counts: documents=${c.documents}, contacts=${c.contacts}, hypotheses=${c.hypotheses}, interviews=${c.interviews}, actions=${c.actions}, recommendations=${c.recommendations}, epilogues=${c.epilogues}`)
  } else {
    const content = result.content
    console.log(`  Counts: persons=${content.persons.length}, sources=${content.sources.length}, evidence=${content.evidence.length}, patterns=${content.patterns.length}, outcomes=${content.report.outcomes.length}, debrief=${content.debrief.length}`)
  }

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
