// Standalone visible-language audit.
//
// Runs only the language regression pass — no structural validation, no
// balance audit. Reuses the deny list and field coverage from
// scripts/lib/visible-language.mjs so this CLI and the full validator
// can never drift apart.
//
// Output format (one block per case):
//
//   [case-id] N visible-language warnings
//     - path: message
//     - ...
//
// Exit code is always 0 — the conductor reads the output before
// approving a content-touching PR, but the audit itself should never
// fail CI. Promote a warning to an error only after the team agrees.
//
// Usage:
//   node scripts/audit-visible-language.mjs
//   npm run audit:visible-language

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { scanInvestigationContent } from './lib/visible-language.mjs'
import { scanDraftDirectories } from './lib/draft-language.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, '..')
const casesRoot = join(repoRoot, 'src', 'game', 'cases')
const draftDirs = [join(repoRoot, 'docs', 'case-01-draft')]

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
  process.exit(0)
}

function loadCase(caseDir) {
  const load = (file) => JSON.parse(readFileSync(join(caseDir, file), 'utf8'))
  return {
    case: load('case.json'),
    persons: load('persons.json'),
    sources: load('sources.json'),
    evidence: load('evidence.json'),
    patterns: load('patterns.json'),
    report: load('report.json'),
    debrief: load('debrief.json'),
  }
}

let totalWarnings = 0

for (const caseDir of caseDirs) {
  let content
  try {
    content = loadCase(caseDir)
  } catch (err) {
    console.log(`\n[${caseDir}] skipped — could not load case content (${err.message})`)
    continue
  }

  const caseId = content.case?.id ?? caseDir
  const warnings = scanInvestigationContent(content)
  totalWarnings += warnings.length

  console.log(`\n[${caseId}] ${warnings.length} visible-language warning${warnings.length === 1 ? '' : 's'}`)
  for (const w of warnings) {
    console.log(`  - ${w}`)
  }
}

// Narrative drafts under `docs/<case-id>-draft/` — Markdown prose that
// will be wired into per-case JSON in a later PR. The deny-list and
// scanner live in `scripts/lib/draft-language.mjs`.
const { files: draftFiles, totalFindings: draftWarnings } =
  scanDraftDirectories(draftDirs)

if (draftFiles.length > 0) {
  console.log(
    `\n[narrative drafts] ${draftWarnings} visible-language warning${draftWarnings === 1 ? '' : 's'} across ${draftFiles.length} markdown file${draftFiles.length === 1 ? '' : 's'}`,
  )
  for (const { file, findings } of draftFiles) {
    if (findings.length === 0) continue
    const rel = relative(repoRoot, file)
    for (const f of findings) {
      console.log(`  - ${rel}:${f.line} forbidden term "${f.term}"`)
    }
  }
}

totalWarnings += draftWarnings

console.log(`\nTotal: ${totalWarnings} visible-language warning${totalWarnings === 1 ? '' : 's'} across ${caseDirs.length} case${caseDirs.length === 1 ? '' : 's'} and ${draftFiles.length} draft file${draftFiles.length === 1 ? '' : 's'}.`)

// Always exit 0 — this audit is informational, not a CI gate.
process.exit(0)
