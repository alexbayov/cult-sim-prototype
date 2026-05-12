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
  process.exit(0)
}

function loadCase(caseDir) {
  const load = (file) => JSON.parse(readFileSync(join(caseDir, file), 'utf8'))
  const caseManifest = load('case.json')
  if (caseManifest.schemaVersion === 'v2') {
    return {
      isV2: true,
      caseManifest,
      hypotheses: load('hypotheses.json'),
      documents: load('documents.json'),
      contacts: load('contacts.json'),
      interviews: load('interviews.json'),
      actions: load('actions.json'),
      recommendations: load('recommendations.json'),
      epilogues: load('epilogues.json'),
    }
  }
  return {
    case: caseManifest,
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

  const caseId = content.isV2 ? content.caseManifest?.id : content.case?.id ?? caseDir
  const warnings = content.isV2 ? scanV2Content(content) : scanInvestigationContent(content)
  totalWarnings += warnings.length

  console.log(`\n[${caseId}] ${warnings.length} visible-language warning${warnings.length === 1 ? '' : 's'}`)
  for (const w of warnings) {
    console.log(`  - ${w}`)
  }
}

console.log(`\nTotal: ${totalWarnings} visible-language warning${totalWarnings === 1 ? '' : 's'} across ${caseDirs.length} case${caseDirs.length === 1 ? '' : 's'}.`)

// Always exit 0 — this audit is informational, not a CI gate.
process.exit(0)
