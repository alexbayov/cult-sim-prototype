#!/usr/bin/env node
// Standalone audit for narrative draft Markdown under docs/<case-id>-draft/.
//
// These drafts are pre-wire-in prose for upcoming cases (see GAME_DESIGN
// §4.1, §5). Once Dev γ wires the prose into per-case JSON, the regular
// `audit:visible-language` script takes over on JSON. This script
// exists separately so that draft prose can be guarded independently of
// the JSON-shape `audit:visible-language` pipeline.
//
// Deny-list and scanner live in `scripts/lib/draft-language.mjs` — both
// this CLI and `audit:visible-language` import the same scanner so the
// two consumers can never drift.
//
// Exit code is 0 only when every scanned file produces zero findings.
// Use `npm run audit:drafts`.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { scanDraftDirectories } from './lib/draft-language.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const DRAFT_DIRS = [path.join(repoRoot, 'docs', 'case-01-draft')]

const { files, totalFindings } = scanDraftDirectories(DRAFT_DIRS)

for (const { file, findings } of files) {
  const rel = path.relative(repoRoot, file)
  if (findings.length === 0) {
    console.log(`OK   ${rel}`)
    continue
  }
  for (const f of findings) {
    console.log(`WARN ${rel}:${f.line} — forbidden term "${f.term}"`)
    console.log(`       ${f.text}`)
  }
}

console.log('')
console.log(
  `Scanned ${files.length} draft file(s) under ${DRAFT_DIRS.length} directory.`,
)
console.log(
  `Total: ${totalFindings} visible-language warning(s) in narrative drafts.`,
)
if (totalFindings > 0) {
  process.exitCode = 1
}
