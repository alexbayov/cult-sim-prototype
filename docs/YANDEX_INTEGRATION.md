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

The SDK script is intentionally **commented out** in `index.html` so local
builds and any non-Yandex hosting remain SDK-free.

To produce a Yandex-iframe-ready build:

1. Open `index.html`.
2. Uncomment the line:
   ```html
   <!-- <script src="https://yandex.ru/games/sdk/v2"></script> -->
   ```
3. Run `npm run build` and upload `dist/` to the Yandex Games console.

No TypeScript or app code changes are required — the adapter detects
`window.YaGames` at runtime and switches from stub to real automatically.

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
