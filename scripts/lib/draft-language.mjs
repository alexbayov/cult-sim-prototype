// Visible-language scanner for narrative draft Markdown files.
//
// The drafts (under `docs/<case-id>-draft/`) are pre-wire-in prose; once
// Dev γ wires the prose into per-case JSON, the JSON deny-list in
// `visible-language.mjs` takes over. Until then we need to keep the
// same "no jargon in player-facing copy" guarantee on Markdown.
//
// Why a separate module:
//
//   - the JSON deny-list assumes structured field paths (e.g.
//     `case.title`) and chip-style ALL CAPS labels (`ДЕЛО`, `ДОСЬЕ`),
//     neither of which applies to prose;
//   - prose introduces new failure modes (calques like `red herring`,
//     `шум`, `фрейм`) and demands proper word boundaries on Cyrillic
//     stems (so `дело`, `культура`, `сектор` do not false-positive).
//
// Two consumers read this module:
//
//   - `scripts/audit-content-drafts.mjs`       (standalone CLI; exits
//     non-zero on findings)
//   - `scripts/audit-visible-language.mjs`     (combined CLI; informs
//     the total but never gates CI)

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// Case-insensitive plain substring matches. Stems are unambiguous in
// Russian prose; matching anywhere in a word is safe.
const CI_SUBSTRINGS = [
  'улик',
  'доказательств',
  'паттерн',
  'фрейм',
  'love bombing',
  'coercive control',
  'gaslighting',
  'газлайтинг',
  'red herring',
  'материалы дела',
]

// Case-sensitive substring matches. Reserved for chip-style ALL CAPS
// labels: `дело` is normal Russian prose (закрыли дело) but `ДЕЛО` is
// detective-jargon styling.
const CS_SUBSTRINGS = ['ДЕЛО', 'ДОСЬЕ']

// Word-boundary regexes. These stems need non-letter context on at
// least one side to avoid false positives.
const WORD_REGEXES = [
  { name: 'красная селёдка', re: /красн[а-яё]*\s+сел[её]д/iu },
  { name: 'сект', re: /\bсект[ауые]\b/iu },
  { name: 'сектой', re: /\bсектой\b/iu },
  { name: 'деструктивн', re: /\bдеструктивн[а-яё]+/iu },
  { name: 'культ', re: /\bкульт\b/iu },
  { name: 'зомби', re: /\bзомби[а-яё]*/iu },
  { name: 'промывк', re: /\bпромывк[а-яё]*/iu },
  { name: 'шум', re: /\bшум\b/iu },
]

export function* walkMarkdown(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      yield* walkMarkdown(full)
    } else if (st.isFile() && entry.endsWith('.md')) {
      yield full
    }
  }
}

function scanLine(line) {
  const hits = []
  for (const term of CI_SUBSTRINGS) {
    if (line.toLowerCase().includes(term.toLowerCase())) hits.push(term)
  }
  for (const term of CS_SUBSTRINGS) {
    if (line.includes(term)) hits.push(term)
  }
  for (const entry of WORD_REGEXES) {
    if (entry.re.test(line)) hits.push(entry.name)
  }
  return hits
}

export function scanDraftFile(file) {
  const findings = []
  const body = readFileSync(file, 'utf8')
  const lines = body.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    for (const term of scanLine(lines[i])) {
      findings.push({ term, line: i + 1, text: lines[i].trim() })
    }
  }
  return findings
}

/**
 * Scan every `.md` file under each draft directory. Returns
 * `{ files, totalFindings }` where `files` is an array of
 * `{ file, findings }` records (sorted by file path).
 */
export function scanDraftDirectories(dirs) {
  const records = []
  let totalFindings = 0
  const allFiles = []
  for (const dir of dirs) {
    for (const file of walkMarkdown(dir)) allFiles.push(file)
  }
  allFiles.sort()
  for (const file of allFiles) {
    const findings = scanDraftFile(file)
    totalFindings += findings.length
    records.push({ file, findings })
  }
  return { files: records, totalFindings }
}
