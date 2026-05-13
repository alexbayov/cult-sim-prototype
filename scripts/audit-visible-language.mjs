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

import {
  scanCaseV2Content,
  scanInvestigationContent,
} from './lib/visible-language.mjs'
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

function loadCaseV1(caseDir) {
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

function loadCaseV2(caseDir) {
  const load = (file) => JSON.parse(readFileSync(join(caseDir, file), 'utf8'))
  return {
    case: load('case.json'),
    hypotheses: load('hypotheses.json'),
    documents: load('documents.json'),
    contacts: load('contacts.json'),
    interviews: load('interviews.json'),
    actions: load('actions.json'),
    recommendations: load('recommendations.json'),
    epilogues: load('epilogues.json'),
  }
}

let totalWarnings = 0

for (const caseDir of caseDirs) {
  // Peek at case.json first so we can dispatch on schemaVersion. The full v1
  // loader bails if any auxiliary file is missing (e.g. persons.json), and we
  // do not want a v2 case to fall through to the v1 loader.
  let caseJson
  try {
    caseJson = JSON.parse(readFileSync(join(caseDir, 'case.json'), 'utf8'))
  } catch (err) {
    console.log(`\n[${caseDir}] skipped — could not load case.json (${err.message})`)
    continue
  }

  const schemaVersion = caseJson?.schemaVersion === 'v2' ? 'v2' : 'v1'
  let warnings = []
  let caseId = caseJson?.id ?? caseDir

  try {
    if (schemaVersion === 'v2') {
      const bundle = loadCaseV2(caseDir)
      caseId = bundle.case.id
      warnings = scanCaseV2Content(bundle)
    } else {
      const content = loadCaseV1(caseDir)
      caseId = content.case?.id ?? caseDir
      warnings = scanInvestigationContent(content)
    }
  } catch (err) {
    console.log(`\n[${caseId}] skipped — could not load case content (${err.message})`)
    continue
  }

  totalWarnings += warnings.length

  console.log(`\n[${caseId}] (${schemaVersion}) ${warnings.length} visible-language warning${warnings.length === 1 ? '' : 's'}`)
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
