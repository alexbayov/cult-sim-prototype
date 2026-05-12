# Roadmap

Where the prototype is, what's in flight, and what's queued. This file replaces the pre-pivot card-scenario roadmap (see closed PRs #8 / #9 for archive context); the live investigative-dossier model lives in `src/game/cases/*`, `src/game/investigation/*`, and `src/investigation/*`.

Open product questions and their current recommendations live in `docs/PRODUCT_DECISIONS.md`. Pre-demo smoke is in `docs/DEMO_QA_CHECKLIST.md`.

## Where we are

- **Wave 0** — `info-business-marathon` vertical slice (#10–#19): case loop, materials, bookmarks, draft summary, разбор, achievements (session-only).
- **Wave 0.5** — second case `family-retreat-center` (#20), reset-with-confirm (#25).
- **Wave 1** — depth + scaffolding (#26 mobile polish, #27 product decisions doc, #28 visible-language validator, #29 depth helpers, #30 season shell + progress persist, #31 Yandex SDK adapter stub).

## Wave 2 (in flight)

- **Dev Q** — resolution clarity pass (rationale + next-checks + tone polish).
- **Dev Y** — `report.thresholds` → optional (validator-only contract).
- **Dev Z** — achievements persist in localStorage (storage layer).
- **Dev D** — vestigial cleanup + this roadmap + demo QA checklist (this PR).

## Wave 3 (queued, open product questions)

- `isRedHerring` filter flip (`docs/PRODUCT_DECISIONS.md` §1) — content review of every red-herring fragment.
- Reliability overlay in source pane (UI-only).
- Contradiction badge in selected pane.
- Achievements UI: surface `persistedEarnedAchievementIds` (consumes Dev Z's storage layer).
- Yandex iframe build + smoke recording (uses Dev V's stub, see `docs/YANDEX_INTEGRATION.md`).
- Second-case editorial pass (`family-retreat-center` content polish).

## Open questions

See `docs/PRODUCT_DECISIONS.md` for the live list of unresolved product questions and current recommendations.

## Deferred / parked

- **Card-based scenario model** (`src/game/engine.ts`, `src/game/contentSchema.ts`, `src/game/data.ts`, `src/game/scenarios/`, `src/game/storage.ts`). Removed in Dev D — see closed PRs #8 / #9 for archive context. Do not resurrect; new mechanics build on the investigation runtime.
- **Direct mobile-store distribution** (PWA/TWA, Capacitor, Godot/Unity port). Re-evaluate only after web/Yandex traction.
