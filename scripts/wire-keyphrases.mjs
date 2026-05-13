#!/usr/bin/env node
// Wire β's prose drafts into γ-schema JSON.
//
// For each markdown file under `docs/case-01-draft/`, extracts:
//   - title, source, body (plain text after markdown stripping)
//   - keyPhrases — every `**bold span**` becomes a {range, effects[]} entry,
//     where effects[] is populated from the `<!-- works on: h-X / weight -->`
//     comments that immediately follow the bold span (before the next
//     non-blank, non-comment line).
//
// Then merges those values into `src/game/cases/case-01-proryv/documents.json`
// in place. The script is idempotent: re-running it produces the same output
// modulo formatting.
//
// Body coordinates: ranges are JS string `.length` indices (UTF-16 code units)
// into the final body that ships in JSON, NOT the markdown source. Russian
// text in case-01 is entirely BMP, so code units = code points, but the
// validator's contract is UTF-16 — the runtime DOM `Selection.toString()`
// returns UTF-16 strings.
//
// Usage:
//   npm run wire:keyphrases
//   node scripts/wire-keyphrases.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, '..')
const draftsDir = join(repoRoot, 'docs', 'case-01-draft')
const caseDir = join(repoRoot, 'src', 'game', 'cases', 'case-01-proryv')

// Mapping: doc-id → β source file.
const DOC_MAPPING = [
  { id: 'doc-personal-thread', md: '01-document-personal.md' },
  { id: 'doc-chat-close-circle', md: '02-document-chat.md' },
  { id: 'doc-social-post', md: '03-document-social.md' },
  { id: 'doc-clipping-2018', md: '04-document-clipping.md' },
  { id: 'doc-emails-client', md: '05-document-emails.md' },
  { id: 'doc-clipping-archive', md: '06-document-archive.md' },
]

// ---------------------------------------------------------------------------
// Markdown parser
// ---------------------------------------------------------------------------

// Strip leading "# heading\n", optional editorial blockquote, and optional
// leading "---" separator. Returns the rest of the markdown.
function stripHeader(rawText) {
  const lines = rawText.split('\n')
  let i = 0
  // Leading blank lines.
  while (i < lines.length && lines[i].trim() === '') i++
  // First heading.
  if (i < lines.length && /^#\s+/.test(lines[i])) i++
  // Blank lines.
  while (i < lines.length && lines[i].trim() === '') i++
  // Editorial blockquote.
  if (i < lines.length && lines[i].startsWith('>')) {
    while (i < lines.length && lines[i].startsWith('>')) i++
    while (i < lines.length && lines[i].trim() === '') i++
  }
  // Leading "---" separator.
  if (i < lines.length && lines[i].trim() === '---') {
    i++
    while (i < lines.length && lines[i].trim() === '') i++
  }
  return lines.slice(i).join('\n')
}

// Pull `title` and `source` from the markdown header before stripping.
// `source` may span multiple `> ...` lines; we join them with a single space.
function extractHeader(rawText) {
  const lines = rawText.split('\n')
  let title = ''
  let source = ''
  let i = 0
  // Find the title. Strip the leading `# NN-name — ` prefix AND the
  // following `<filename>.md — ` slug (β uses both: `# 01-document-personal.md
  // — Telegram-переписка Елены и Сергея`).
  for (; i < lines.length; i++) {
    if (/^#\s+/.test(lines[i])) {
      let raw = lines[i].replace(/^#\s+/, '').trim()
      // Drop leading `NN-name.md — ` or `NN-name — ` (β's filename slugs).
      raw = raw.replace(/^[\w-]+(?:\.md)?\s*[—\-:]\s*/, '')
      title = raw.trim()
      i++
      break
    }
  }
  // Find the `> Источник:` line and join continuation `>`-prefixed lines.
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^>\s*Источник:\s*(.*)$/)
    if (m) {
      const buf = [m[1].trim()]
      let j = i + 1
      while (j < lines.length && /^>\s+/.test(lines[j])) {
        buf.push(lines[j].replace(/^>\s+/, '').trim())
        j++
      }
      source = buf.join(' ').replace(/\s+/g, ' ').replace(/\.$/, '').trim()
      break
    }
    // First non-blockquote, non-blank line after the title ends the search.
    if (lines[i].trim() !== '' && !lines[i].startsWith('>') && !/^#/.test(lines[i])) {
      break
    }
  }
  return { title, source }
}

// Pull `works on: h-X / weight` payloads out of any `<!-- ... -->` comments
// on a single line. Returns the cleaned (comment-stripped) line and the
// extracted effects.
function extractComments(line) {
  const effects = []
  const commentRe = /<!--([\s\S]*?)-->/g
  let m
  while ((m = commentRe.exec(line)) !== null) {
    const inner = m[1].trim()
    const works = inner.match(/^works on:\s*(h-[a-z-]+)\s*\/\s*(strong|weak|counter)/i)
    if (works) {
      effects.push({ hypothesisId: works[1], weight: works[2].toLowerCase() })
    }
  }
  const cleaned = line.replace(commentRe, '').replace(/\s+$/, '')
  return { cleaned, effects }
}

// Parse a single document. Two-pass:
//   1. Per-line cleanup (strip `> `, extract `<!-- works on -->` comments)
//      producing a plain-text body AND an ordered list of (commentEffects,
//      anchorPosition) pairs, where anchorPosition is the position in the
//      OUTPUT body at the start of the line on which the comment appeared.
//   2. Tokenise bold spans across the entire body. The bold markers are
//      removed; spans are recorded in OUTPUT coordinates.
//   3. Walk comment-batches and spans together: every comment batch attaches
//      to the most recent span whose end < the comment's anchor position.
function parseDocument(rawText) {
  const { title, source } = extractHeader(rawText)
  const stripped = stripHeader(rawText)

  // Pass 1: build a body string with `> ` stripped and comments removed.
  // Track each line's start position in the assembled body.
  //
  // Comment batches: an ordered list of { anchor, effects[] } pairs. anchor
  // is the position at the START of the line on which the comment appeared
  // (in body coordinates). When matching to spans later, the rule is: a
  // comment batch belongs to the latest span whose END is <= anchor.
  const lines = stripped.split('\n')
  let bodyWithBold = ''
  const commentBatches = []

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]

    // Pure-comment line: drop, extract payload, anchor at current body length.
    const trimmed = line.trim()
    if (trimmed.startsWith('<!--')) {
      const { cleaned, effects } = extractComments(line)
      // If after stripping the line is empty/whitespace, treat the line as
      // a pure-comment line (do NOT advance bodyWithBold).
      if (cleaned.trim() === '') {
        if (effects.length > 0) {
          commentBatches.push({ anchor: bodyWithBold.length, effects })
        }
        continue
      }
      // Otherwise fall through with cleaned text.
    }

    // Inline comments mid-line: extract their payload, anchor at this
    // line's start; THEN keep the cleaned line in the body.
    const { cleaned, effects: inlineEffects } = extractComments(line)
    if (inlineEffects.length > 0) {
      commentBatches.push({ anchor: bodyWithBold.length, effects: inlineEffects })
    }

    // Strip leading `> ` (single space optional). Markdown blockquote.
    let plainLine = cleaned.replace(/^>\s?/, '')

    bodyWithBold += plainLine
    if (li < lines.length - 1) bodyWithBold += '\n'
  }

  // Pass 2: tokenise bold spans across the whole body. Strip `**` markers.
  // Record span [start, end) in output coordinates. Spans may cross newlines
  // (β's blockquote-spanning bold spans).
  const spans = []
  let body = ''
  let i = 0
  let inBold = false
  let spanStart = -1
  while (i < bodyWithBold.length) {
    if (bodyWithBold[i] === '*' && bodyWithBold[i + 1] === '*') {
      if (!inBold) {
        spanStart = body.length
        inBold = true
      } else {
        spans.push({ start: spanStart, end: body.length })
        inBold = false
        spanStart = -1
      }
      i += 2
    } else {
      body += bodyWithBold[i]
      i++
    }
  }
  if (inBold) {
    throw new Error('Unclosed bold span in source markdown')
  }

  // Comment batches were anchored in `bodyWithBold` coordinates (pre-bold-
  // stripping). Translate them to post-stripping coordinates: walk the
  // markdown again and build a mapping from pre-strip to post-strip indices.
  // Simpler: re-walk bodyWithBold tracking a `delta` counter.
  const preToPost = new Array(bodyWithBold.length + 1)
  {
    let delta = 0
    let j = 0
    while (j < bodyWithBold.length) {
      preToPost[j] = j - delta
      if (bodyWithBold[j] === '*' && bodyWithBold[j + 1] === '*') {
        // Mark both `*` positions with the SAME post-strip index (they map
        // to a zero-width gap in the output).
        preToPost[j + 1] = j - delta
        delta += 2
        j += 2
      } else {
        j++
      }
    }
    preToPost[bodyWithBold.length] = bodyWithBold.length - delta
  }

  // Build keyPhrases. Walk spans in order, walk commentBatches in order.
  // For each span, the comments that belong to it are those whose anchor
  // (translated) is >= span.end (immediately after the span) and < next
  // span's start (or end-of-body). The brief specifies "the comments that
  // immediately follow the bold span (before the next non-blank, non-comment
  // line)" — in practice β places the `<!-- works on -->` comments on the
  // lines DIRECTLY after the closing `**`, so anchor-based grouping is a
  // good approximation. Edge case: a single bold span on a line followed by
  // unrelated prose AND comments — but β data has no such case (checked).
  const keyPhrases = spans.map(({ start, end }) => ({
    range: [start, end],
    effects: [],
  }))

  // Translate comment anchors.
  const translatedBatches = commentBatches.map((b) => ({
    anchor: preToPost[b.anchor] ?? b.anchor,
    effects: b.effects,
  }))

  // β uses bold for two purposes: semantic key phrases AND visual emphasis
  // (email field labels like `**От:**` / `**Дата:**`, commenter names like
  // `**Антон Реутов**`, section markers like `**Комментарии**`). Visual-only
  // bold spans must not steal a `<!-- works on -->` comment that was meant
  // for a later semantic span (especially in 05-document-emails.md where a
  // code block of payment details sits between the email headers and the
  // works-on comment that annotates the payment details).
  //
  // Heuristic for "field-label-only" bold spans:
  //   - 30 chars or fewer
  //   - and either ends with `:` (email headers, code block labels) OR is
  //     a single capitalised word (commenter names, section markers).
  // Such spans are excluded from works-on attribution but are still kept
  // (and culled at the end if their effects[] stays empty).
  const isLabelOnly = (text) => {
    const t = text.trim()
    if (t.length === 0) return true
    if (t.length > 30) return false
    if (t.endsWith(':')) return true
    // Single capitalised "word" (Cyrillic or Latin) — commenter names like
    // "Антон Реутов" / "Сергей Иванов (автор) →" / "Комментарии".
    if (/^[A-ZА-ЯЁ][^\n]*$/.test(t) && !/[.!?]$/.test(t) && t.split(' ').length <= 4) return true
    return false
  }
  const phraseTextOf = (kp) => body.slice(kp.range[0], kp.range[1])

  for (const batch of translatedBatches) {
    // Find the latest span whose end <= anchor AND is not a label-only span.
    let assigned = -1
    for (let k = 0; k < keyPhrases.length; k++) {
      if (keyPhrases[k].range[1] <= batch.anchor) {
        if (!isLabelOnly(phraseTextOf(keyPhrases[k]))) {
          assigned = k
        }
      } else {
        break
      }
    }
    if (assigned < 0) {
      console.warn(
        `[wire-keyphrases] dropped dangling comment batch (no preceding semantic span) effects=${JSON.stringify(batch.effects)} anchor=${batch.anchor}`,
      )
      continue
    }
    keyPhrases[assigned].effects.push(...batch.effects)
  }

  // Normalise excessive blank-line runs: collapse 3+ newlines to 2.
  // (β data is generally clean; this is a safety net.) After normalisation,
  // re-anchor span ranges by searching the unchanged span text.
  let finalBody = body.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim()

  const finalKeyPhrases = []
  for (const kp of keyPhrases) {
    const [s, e] = kp.range
    const phraseText = body.slice(s, e)
    // The collapse + trim may have shifted the phrase by a few characters.
    // Search for the phrase in finalBody; pick the leftmost occurrence at
    // or after `s` rather than the global leftmost (β data has unique-ish
    // spans, but the start hint protects against same-text matches in
    // unrelated places).
    let searchFrom = Math.max(0, s - 8)
    let newStart = finalBody.indexOf(phraseText, searchFrom)
    if (newStart < 0) {
      // Fall back to global search.
      newStart = finalBody.indexOf(phraseText)
    }
    if (newStart < 0) {
      throw new Error(
        `Could not re-anchor span "${phraseText.slice(0, 40)}..." after normalisation`,
      )
    }
    finalKeyPhrases.push({
      range: [newStart, newStart + phraseText.length],
      effects: kp.effects,
    })
  }

  // Drop spans without any effects. β uses bold for two purposes:
  // (a) marking a semantic key phrase (always followed by one or more
  //     `<!-- works on -->` comments — these become real keyPhrases);
  // (b) plain text emphasis / commenter-name formatting (no following
  //     comment — these are formatting only and must not become keyPhrases
  //     because the validator requires `effects` to be non-empty).
  // The bold markers themselves are already stripped from `finalBody`.
  const culled = finalKeyPhrases.filter((kp) => kp.effects.length > 0)

  // Sort by start (defensive).
  culled.sort((a, b) => a.range[0] - b.range[0])

  return { title, source, body: finalBody, keyPhrases: culled }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const documentsPath = join(caseDir, 'documents.json')
  const documents = JSON.parse(readFileSync(documentsPath, 'utf8'))

  for (const { id, md } of DOC_MAPPING) {
    const rawText = readFileSync(join(draftsDir, md), 'utf8')
    const { title, source, body, keyPhrases } = parseDocument(rawText)

    const target = documents.find((d) => d.id === id)
    if (!target) {
      console.error(`No document with id ${id} in documents.json`)
      process.exit(1)
    }
    target.title = title || target.title
    target.source = source || target.source
    target.body = body
    target.keyPhrases = keyPhrases
    console.log(
      `[${id}] body=${body.length} chars, ${keyPhrases.length} keyPhrases (${keyPhrases.reduce((s, kp) => s + kp.effects.length, 0)} effects)`,
    )
  }

  // Pretty-print with 2-space indent, trailing newline.
  writeFileSync(documentsPath, JSON.stringify(documents, null, 2) + '\n')
  console.log(`\nWrote ${documentsPath}`)
}

main()
