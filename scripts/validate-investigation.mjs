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

const dupes = (label, ids) => {
  const errs = []
  const seen = new Set()
  for (const id of ids) {
    if (seen.has(id)) errs.push(`Duplicate ${label} id: ${id}`)
    else seen.add(id)
  }
  return errs
}

function validateCase(caseDir) {
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
    const strongThreshold = content.report.thresholds.minConfirmedPatternsForStrongOutcome
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

  // 6. Language guardrails: warn for primary-label terms in visible gameplay fields.
  {
    const forbiddenTerms = [
      'улика',
      'доказательство',
      'ДЕЛО',
      'ДОСЬЕ',
      'секта',
      'love bombing',
      'coercive control',
      'gaslighting',
      'газлайтинг',
    ]
    // 'паттерн' is only forbidden in visible gameplay titles/summaries, not in
    // internal descriptions or debrief bodies. We check it in a smaller field set.
    const patternTermFields = new Set([
      'case.title',
      'case.subtitle',
      'case.publicLegend',
      'case.investigationQuestion',
      'case.riskStatement',
      'source.title',
      'pattern.title',
      'pattern.shortDescription',
      'report.outcome.title',
      'report.outcome.summary',
    ])
    const containsTerm = (text, term) =>
      typeof text === 'string' && text.toLowerCase().includes(term.toLowerCase())

    const checkField = (path, text) => {
      if (typeof text !== 'string' || text.length === 0) return
      for (const term of forbiddenTerms) {
        if (containsTerm(text, term)) {
          warnings.push(`${path} uses primary-label term "${term}"; prefer neutral gameplay wording`)
        }
      }
      if (patternTermFields.has(path) && containsTerm(text, 'паттерн')) {
        warnings.push(`${path} uses primary-label term "паттерн"; prefer "наблюдение" in visible gameplay copy`)
      }
    }

    // case
    checkField('case.title', c.title)
    checkField('case.subtitle', c.subtitle)
    checkField('case.publicLegend', c.publicLegend)
    checkField('case.investigationQuestion', c.investigationQuestion)
    checkField('case.riskStatement', c.riskStatement)
    checkField('case.contentWarning', c.contentWarning)

    // persons (only public-facing fields)
    for (const p of content.persons) {
      checkField(`person[${p.id}].name`, p.name)
      checkField(`person[${p.id}].publicDescription`, p.publicDescription)
      for (let i = 0; i < p.knownFacts.length; i++) {
        checkField(`person[${p.id}].knownFacts[${i}]`, p.knownFacts[i])
      }
    }

    // sources
    for (const s of content.sources) {
      checkField(`source[${s.id}].title`, s.title)
      checkField(`source[${s.id}].origin`, s.origin)
    }

    // evidence (text and speaker are visible)
    for (const e of content.evidence) {
      checkField(`evidence[${e.id}].text`, e.text)
      checkField(`evidence[${e.id}].speaker`, e.speaker)
    }

    // patterns
    for (const p of content.patterns) {
      checkField(`pattern[${p.id}].title`, p.title)
      checkField(`pattern[${p.id}].shortDescription`, p.shortDescription)
      checkField(`pattern[${p.id}].fullDescription`, p.fullDescription)
      checkField(`pattern[${p.id}].debriefText`, p.debriefText)
    }

    // report outcomes
    for (const o of content.report.outcomes) {
      checkField(`report.outcome[${o.id}].title`, o.title)
      checkField(`report.outcome[${o.id}].summary`, o.summary)
      checkField(`report.outcome[${o.id}].recommendedFraming`, o.recommendedFraming)
      for (let i = 0; i < o.notes.length; i++) {
        checkField(`report.outcome[${o.id}].notes[${i}]`, o.notes[i])
      }
    }

    // Debrief is intentionally NOT checked: expert terms are allowed in
    // debrief.term and debrief.longExplanation as secondary educational context.
  }

  return { caseId, content, errors, warnings }
}

// ---- Run for every case folder ---------------------------------------------

let totalErrors = 0

for (const caseDir of caseDirs) {
  const { caseId, content, errors, warnings } = validateCase(caseDir)
  console.log(`\n[${caseId}]`)
  console.log(`  Counts: persons=${content.persons.length}, sources=${content.sources.length}, evidence=${content.evidence.length}, patterns=${content.patterns.length}, outcomes=${content.report.outcomes.length}, debrief=${content.debrief.length}`)

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
