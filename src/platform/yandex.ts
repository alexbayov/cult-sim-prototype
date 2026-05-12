/**
 * Yandex Games SDK adapter — stub.
 *
 * Provides a stable, typed seam between the app and the Yandex Games SDK.
 * Locally (and in any environment where `window.YaGames` is not present) all
 * methods are graceful no-ops. When the real SDK is loaded — for example
 * inside a Yandex Games iframe build — the adapter delegates to the SDK.
 *
 * See `docs/YANDEX_INTEGRATION.md` for how to enable the real SDK and the
 * planned follow-up work (fullscreen ads, leaderboards, payments).
 */

export type YandexEnvironment = {
  /** True iff the real Yandex Games SDK is loaded and initialised. */
  available: boolean
  /** True iff the page is running inside an iframe (Yandex hosts in one). */
  inIframe: boolean
  /** Locale reported by the SDK (e.g. `"ru"`, `"en"`), if available. */
  locale: string | null
  /** Browser language from `navigator.language`, if available. */
  browserLang: string | null
}

export type YandexSdk = {
  /** Resolves once the SDK (or stub) is ready to be used. */
  ready(): Promise<void>
  /** Returns a snapshot of the current runtime environment. */
  getEnvironment(): YandexEnvironment
  /** Requests a fullscreen ad. Returns `{ shown: false }` for the stub. */
  showFullscreenAdv(): Promise<{ shown: boolean }>
}

// ---------------------------------------------------------------------------
// Minimal shape of the real SDK we touch today. Kept intentionally narrow so
// we are not coupled to the full Yandex typings. Extend as new call-sites
// land in later waves.
// ---------------------------------------------------------------------------

type RealYandexEnvironment = {
  i18n?: { lang?: string | null }
}

type RealAdvShowOptions = {
  callbacks?: {
    onOpen?: () => void
    onClose?: (wasShown: boolean) => void
    onError?: (error: unknown) => void
  }
}

type RealYandexSdk = {
  environment?: RealYandexEnvironment
  adv?: {
    showFullscreenAdv: (options?: RealAdvShowOptions) => void
  }
}

type YaGamesGlobal = {
  init: () => Promise<RealYandexSdk>
}

declare global {
  interface Window {
    YaGames?: YaGamesGlobal
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectInIframe(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.top !== window.self
  } catch {
    // Cross-origin access can throw — being unable to read `window.top`
    // implies we are framed by a different origin (i.e. Yandex).
    return true
  }
}

function detectBrowserLang(): string | null {
  if (typeof navigator === 'undefined') return null
  return navigator.language ?? null
}

function createStubSdk(): YandexSdk {
  const inIframe = detectInIframe()
  const browserLang = detectBrowserLang()
  return {
    ready() {
      return Promise.resolve()
    },
    getEnvironment() {
      return {
        available: false,
        inIframe,
        locale: null,
        browserLang,
      }
    },
    showFullscreenAdv() {
      return Promise.resolve({ shown: false })
    },
  }
}

function createRealSdk(real: RealYandexSdk): YandexSdk {
  const inIframe = detectInIframe()
  const browserLang = detectBrowserLang()
  return {
    ready() {
      return Promise.resolve()
    },
    getEnvironment() {
      const locale = real.environment?.i18n?.lang ?? null
      return {
        available: true,
        inIframe,
        locale,
        browserLang,
      }
    },
    showFullscreenAdv() {
      return new Promise((resolve) => {
        const adv = real.adv
        if (!adv || typeof adv.showFullscreenAdv !== 'function') {
          resolve({ shown: false })
          return
        }
        let settled = false
        const settle = (shown: boolean) => {
          if (settled) return
          settled = true
          resolve({ shown })
        }
        try {
          adv.showFullscreenAdv({
            callbacks: {
              onClose: (wasShown: boolean) => settle(Boolean(wasShown)),
              onError: () => settle(false),
            },
          })
        } catch {
          settle(false)
        }
      })
    },
  }
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

// Module-level singleton populated by `initYandex()`. Future call-sites can
// read it via `getYandexSdk()` without threading the value through props.
let currentSdk: YandexSdk | null = null
let initPromise: Promise<YandexSdk> | null = null

/**
 * Initialise the Yandex Games SDK adapter.
 *
 * - If `window.YaGames` is present, calls `init()` and returns a real adapter.
 * - Otherwise (or on any SDK error) returns a stub that no-ops gracefully.
 *
 * Idempotent: repeated calls return the same instance.
 * Never throws — the app is expected to render in both modes without changes.
 */
export function initYandex(): Promise<YandexSdk> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    if (typeof window === 'undefined') {
      return createStubSdk()
    }
    const yaGames = window.YaGames
    if (!yaGames || typeof yaGames.init !== 'function') {
      return createStubSdk()
    }
    try {
      const real = await yaGames.init()
      return createRealSdk(real)
    } catch {
      return createStubSdk()
    }
  })().then((sdk) => {
    currentSdk = sdk
    return sdk
  })
  return initPromise
}

/**
 * Returns the resolved Yandex SDK adapter, or `null` if `initYandex()` has
 * not yet resolved. Intended for Wave 3+ consumers (ads, leaderboards) that
 * can no-op until the adapter is ready.
 */
export function getYandexSdk(): YandexSdk | null {
  return currentSdk
}
