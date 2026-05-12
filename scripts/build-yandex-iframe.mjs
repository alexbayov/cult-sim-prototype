// Produce a Yandex-Games-ready bundle.
//
// The default `npm run build` keeps the Yandex Games SDK script tag
// commented out in `index.html` so local builds and any non-Yandex hosting
// stay SDK-free. This script wraps `vite build` and then **post-processes**
// `dist/index.html` to uncomment that single `<script>` tag, so the emitted
// bundle is identical to a regular build plus the SDK include.
//
// Strategy: B (post-process). We chose this over a Vite multi-entry setup
// because the diff stays contained to this script and `package.json` — no
// `vite.config.ts` change, no parallel HTML entry file to keep in sync.
// The trade-off is that the bundle on disk differs from what Vite emitted;
// the marker comment below makes that difference visible in `dist/index.html`.
//
// Inputs:
//   `index.html` must contain the placeholder line
//       <!-- yandex-sdk-script-placeholder -->
//   The placeholder is intentionally URL-free so the default `npm run build`
//   emits a `dist/index.html` with zero occurrences of `yandex.ru/games/sdk`.
//   This script replaces that placeholder in `dist/index.html` with the live
//   `<script src="https://yandex.ru/games/sdk/v2"></script>` tag. If the
//   placeholder is missing we fail loudly rather than emit a silently-broken
//   bundle.
//
// Outputs:
//   `dist/` populated by `vite build` with `dist/index.html` post-processed
//   to include the live SDK `<script>` tag plus a one-line provenance banner.
//
// Run via:  npm run build:yandex
// Optional: npm run package:yandex   (also produces yandex-iframe.zip)

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DIST_INDEX = resolve(ROOT, 'dist', 'index.html')

const PLACEHOLDER_COMMENT = '<!-- yandex-sdk-script-placeholder -->'
const LIVE_SDK_TAG =
  '<script src="https://yandex.ru/games/sdk/v2"></script>'
const PROVENANCE_BANNER =
  '<!-- yandex iframe build: SDK tag injected by scripts/build-yandex-iframe.mjs -->'

function runViteBuild() {
  console.log('[build:yandex] running vite build (default config)...')
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'build'],
    { cwd: ROOT, stdio: 'inherit' },
  )
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function enableSdkTagInDistIndex() {
  let html
  try {
    html = readFileSync(DIST_INDEX, 'utf8')
  } catch (err) {
    console.error(`[build:yandex] failed to read ${DIST_INDEX}:`, err)
    process.exit(1)
  }

  if (!html.includes(PLACEHOLDER_COMMENT)) {
    if (html.includes(LIVE_SDK_TAG)) {
      console.error(
        '[build:yandex] dist/index.html already contains a live SDK <script> tag. ' +
          'Did the source index.html drift? Aborting to avoid double-injection.',
      )
    } else {
      console.error(
        '[build:yandex] could not find the Yandex SDK placeholder comment ' +
          `in ${DIST_INDEX}. Expected this line:\n  ${PLACEHOLDER_COMMENT}`,
      )
    }
    process.exit(1)
  }

  const next = html.replace(
    PLACEHOLDER_COMMENT,
    `${PROVENANCE_BANNER}\n    ${LIVE_SDK_TAG}`,
  )
  writeFileSync(DIST_INDEX, next, 'utf8')
  console.log(
    '[build:yandex] SDK <script> tag enabled in dist/index.html (post-process).',
  )
}

runViteBuild()
enableSdkTagInDistIndex()
console.log('[build:yandex] done. Bundle in dist/ is Yandex-iframe-ready.')
