// Single source of truth for primary-label terms forbidden in visible
// gameplay copy. Keep this list in sync with the conductor handoff and
// PR review checklist.
//
// The visible-language guard is intentionally a warning (not an error):
// language regressions slip in during content edits and should be
// surfaced loudly without blocking CI. Two scripts read this module:
//
//   - `scripts/validate-investigation.mjs`   (full structural validator,
//     emits language warnings alongside structural warnings)
//   - `scripts/audit-visible-language.mjs`   (standalone language pass,
//     prints a tidy summary the conductor can read before approving a
//     content-touching PR)
//
// Adding a term here adds it to both consumers — there should never be
// a duplicate inline forbidden-terms array anywhere else in the repo.
//
// Term semantics:
//
//   - terms containing `.` (regex metacharacter) are treated as regex
//     patterns and compiled with `iu` flags;
//   - all other terms are case-insensitive substring matches;
//   - matching is intentionally simple — we want false positives we can
//     audit, not a clever NLP layer.

export const FORBIDDEN_PRIMARY_TERMS = [
  'улика',
  'доказательство',
  'ДЕЛО',
  'ДОСЬЕ',
  'материалы дела',
  'секта',
  'love bombing',
  'coercive control',
  'gaslighting',
  'газлайтинг',
  'красн.*сел',
]

// 'паттерн' is conditional: forbidden only in a smaller field set where
// the player-facing word should always be «наблюдение». Internal
// descriptions and debrief bodies still allow 'паттерн' as a developer
// gloss.
export const PATTERN_TERM_FIELDS = new Set([
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

export const PATTERN_TERM = 'паттерн'

/**
 * Test whether `text` contains `term`. Terms with a `.` are compiled as
 * case-insensitive Unicode regexes; everything else is a plain
 * substring match (case-insensitive).
 *
 * Returns false for non-string text/term or empty inputs. An invalid
 * regex pattern silently returns false rather than throwing — callers
 * never want a malformed deny-list entry to take down a validator run.
 */
export function termMatches(text, term) {
  if (typeof text !== 'string' || text.length === 0) return false
  if (typeof term !== 'string' || term.length === 0) return false
  if (term.includes('.')) {
    try {
      return new RegExp(term, 'iu').test(text)
    } catch {
      return false
    }
  }
  return text.toLowerCase().includes(term.toLowerCase())
}

/**
 * Scan a single `text` value associated with a `path` (e.g.
 * `case.title`, `evidence[e_x].text`) and return the list of warning
 * strings produced. The path is used both for the warning message and
 * to gate the conditional `паттерн` check via `PATTERN_TERM_FIELDS`.
 *
 * `pathKind` is the bucket name used when looking up `PATTERN_TERM_FIELDS`
 * (e.g. `case.title`, `pattern.title`). It is passed separately because
 * the full `path` typically embeds an id (`evidence[e_xyz].text`) and
 * would not match the field set directly.
 */
export function scanField(path, pathKind, text) {
  const warnings = []
  if (typeof text !== 'string' || text.length === 0) return warnings
  for (const term of FORBIDDEN_PRIMARY_TERMS) {
    if (termMatches(text, term)) {
      warnings.push(
        `${path} uses primary-label term "${term}"; prefer neutral gameplay wording`,
      )
    }
  }
  if (PATTERN_TERM_FIELDS.has(pathKind) && termMatches(text, PATTERN_TERM)) {
    warnings.push(
      `${path} uses primary-label term "${PATTERN_TERM}"; prefer "наблюдение" in visible gameplay copy`,
    )
  }
  return warnings
}

/**
 * Scan one investigation content bundle for visible-language warnings.
 *
 * `content` is the same `{case, persons, sources, evidence, patterns,
 * report, debrief}` shape produced by the offline validator. Field
 * coverage:
 *
 *   - case.{title, subtitle, publicLegend, investigationQuestion,
 *           riskStatement, contentWarning}
 *   - person[*].{name, publicDescription, knownFacts[*]}
 *   - source[*].{title, origin}
 *       (source.summary is NOT in CaseSource today — see types.ts;
 *        intentionally skipped, add here if the schema grows.)
 *   - evidence[*].{text, speaker}
 *   - pattern[*].{title, shortDescription, fullDescription, debriefText}
 *       (pattern.examples is NOT in ControlPattern today — see types.ts;
 *        intentionally skipped.)
 *   - report.outcome[*].{title, summary, recommendedFraming, notes[*]}
 *       (report.outcome.recommendedActions is NOT in ReportOutcome today
 *        — see types.ts; intentionally skipped.)
 *   - debrief[*].{term, shortExplanation}
 *       (debrief[*].longExplanation is intentionally NOT checked —
 *        expert vocabulary is allowed there as secondary educational
 *        context, see docs/SEASON_AND_CASE_FRAMEWORK.md §3.)
 *
 * Returns an array of warning strings (possibly empty).
 */
export function scanInvestigationContent(content) {
  const warnings = []
  const push = (path, kind, text) => {
    for (const w of scanField(path, kind, text)) warnings.push(w)
  }

  const c = content.case
  push('case.title', 'case.title', c.title)
  push('case.subtitle', 'case.subtitle', c.subtitle)
  push('case.publicLegend', 'case.publicLegend', c.publicLegend)
  push('case.investigationQuestion', 'case.investigationQuestion', c.investigationQuestion)
  push('case.riskStatement', 'case.riskStatement', c.riskStatement)
  push('case.contentWarning', 'case.contentWarning', c.contentWarning)

  for (const p of content.persons) {
    push(`person[${p.id}].name`, 'person.name', p.name)
    push(`person[${p.id}].publicDescription`, 'person.publicDescription', p.publicDescription)
    for (let i = 0; i < p.knownFacts.length; i++) {
      push(`person[${p.id}].knownFacts[${i}]`, 'person.knownFacts', p.knownFacts[i])
    }
  }

  for (const s of content.sources) {
    push(`source[${s.id}].title`, 'source.title', s.title)
    push(`source[${s.id}].origin`, 'source.origin', s.origin)
    // source.summary intentionally not checked — not present in CaseSource (types.ts).
  }

  for (const e of content.evidence) {
    push(`evidence[${e.id}].text`, 'evidence.text', e.text)
    push(`evidence[${e.id}].speaker`, 'evidence.speaker', e.speaker)
  }

  for (const p of content.patterns) {
    push(`pattern[${p.id}].title`, 'pattern.title', p.title)
    push(`pattern[${p.id}].shortDescription`, 'pattern.shortDescription', p.shortDescription)
    push(`pattern[${p.id}].fullDescription`, 'pattern.fullDescription', p.fullDescription)
    push(`pattern[${p.id}].debriefText`, 'pattern.debriefText', p.debriefText)
    // pattern.examples intentionally not checked — not present in ControlPattern (types.ts).
  }

  for (const o of content.report.outcomes) {
    push(`report.outcome[${o.id}].title`, 'report.outcome.title', o.title)
    push(`report.outcome[${o.id}].summary`, 'report.outcome.summary', o.summary)
    push(`report.outcome[${o.id}].recommendedFraming`, 'report.outcome.recommendedFraming', o.recommendedFraming)
    for (let i = 0; i < o.notes.length; i++) {
      push(`report.outcome[${o.id}].notes[${i}]`, 'report.outcome.notes', o.notes[i])
    }
    // report.outcome.recommendedActions intentionally not checked —
    // not present in ReportOutcome (types.ts).
  }

  for (const d of content.debrief) {
    push(`debrief[${d.id}].term`, 'debrief.term', d.term)
    push(`debrief[${d.id}].shortExplanation`, 'debrief.shortExplanation', d.shortExplanation)
    // debrief.longExplanation intentionally not checked — expert
    // vocabulary is allowed there as secondary educational context.
  }

  return warnings
}
