# Yandex Games SDK integration

This document describes the current Yandex Games SDK integration in the
prototype. Today the integration is a **typed stub**: it exposes a stable
TypeScript API the rest of the app can call, but does not yet drive any real
ads, leaderboards, or payments.

## What the adapter does today

- Lives at `src/platform/yandex.ts`.
- Exposes `initYandex()` which always resolves to a `YandexSdk` instance.
- `YandexSdk` has three methods:
  - `ready()` — resolves immediately.
  - `getEnvironment()` — returns `{ available, inIframe, locale, browserLang }`.
  - `showFullscreenAdv()` — resolves with `{ shown: boolean }`.
- If `window.YaGames` is present, the adapter delegates to the real SDK.
- If `window.YaGames` is absent, or any SDK call throws, the adapter returns a
  stub that no-ops gracefully: `available: false`, `shown: false`.
- The adapter is wired once in `src/App.tsx` (a single `useEffect`) so the
  init path is exercised on every page load, but the SDK is not consumed by
  any feature yet.

## What the adapter does NOT do today

- No fullscreen ads (the call returns `{ shown: false }` locally).
- No leaderboards.
- No payments.
- No player auth / cloud saves.
- No analytics or telemetry.
- No build-pipeline changes — the adapter only touches browser globals.

## Enabling the real SDK in a Yandex iframe build

The SDK script tag is intentionally **not present** in `dist/index.html` when
you run the default `npm run build` — instead, `index.html` carries a
placeholder comment `<!-- yandex-sdk-script-placeholder -->` that emits
verbatim. Local builds and any non-Yandex hosting therefore ship a bundle
with zero references to the Yandex CDN.

To produce a Yandex-iframe-ready bundle, run:

```bash
$ npm run build:yandex
```

This invokes `scripts/build-yandex-iframe.mjs`, which runs the standard
`vite build` and then post-processes `dist/index.html` to replace the
placeholder with a live `<script src="https://yandex.ru/games/sdk/v2"></script>`
tag (plus a one-line provenance banner so the post-process is visible in the
emitted HTML). No TypeScript or app code changes are required — the adapter
detects `window.YaGames` at runtime and switches from stub to real
automatically.

To produce a ZIP ready for Yandex Games console upload, run:

```bash
$ npm run package:yandex   # → yandex-iframe.zip in the repo root
```

The packaging step is `cd dist && zip -r ../yandex-iframe.zip .`, so any host
with the standard `zip` CLI (Ubuntu / macOS / WSL) works out of the box. The
emitted ZIP is gitignored.

### Verifying the Yandex iframe bundle locally

After `npm run build:yandex` the bundle is in `dist/` and can be served by
any static file server. The quickest recipe:

```bash
$ npm run build:yandex
$ npx serve dist -l 4173
```

Open `http://localhost:4173/` in a browser and confirm:

- The case picker renders.
- DevTools → Network shows a request to `https://yandex.ru/games/sdk/v2`.
- DevTools → Console contains **no uncaught exceptions from app code**. The
  Yandex SDK itself may log `Error: No parent to post message` when loaded
  outside an actual Yandex iframe — that is the SDK's own postMessage probe
  failing, and the adapter at `src/platform/yandex.ts` is designed to catch
  those errors and silently fall back to the stub. `getEnvironment()` will
  return `{ available: false, ... }` in this local-serve scenario, which is
  the documented graceful-degradation path, not a bug.

For a reproducible / scriptable check, a small Playwright or CDP probe that
loads the served bundle and asserts (a) the SDK `<script>` tag is in the
served HTML, (b) `#root` has rendered children, and (c) there are no
app-side exceptions, is preferred over manual DevTools inspection. The PR
that introduced `build:yandex` includes such a probe in its description.

## Where the SDK docs live

- SDK overview: <https://yandex.ru/dev/games/doc/en/sdk/sdk-about>
- Advertising API: <https://yandex.ru/dev/games/doc/en/sdk/sdk-adv>
- Environment / i18n: <https://yandex.ru/dev/games/doc/en/sdk/sdk-environment>

## Planned follow-ups (Wave 3+)

See `docs/PRODUCT_DECISIONS.md` §6 for the full plan. The next concrete
consumers of this adapter, in rough priority order, are:

1. **Fullscreen ad on case start.** Gate `showFullscreenAdv()` behind a cap so
   it fires at most once per session and never blocks the first case start.
2. **Locale-driven copy.** Use `getEnvironment().locale` to pick between
   `ru` and `en` strings once the prototype has localised copy.
3. **Leaderboard stub.** Add a `leaderboards` member to `YandexSdk` returning
   no-ops locally and delegating to `ysdk.getLeaderboards()` in the iframe.
4. **Payments stub.** Same pattern as leaderboards, delegating to
   `ysdk.getPayments()` when the SDK is present.

Each follow-up should extend `YandexSdk` rather than introduce a parallel
abstraction — the adapter is the single seam between the app and Yandex.
