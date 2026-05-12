# Roadmap

Where the prototype is, what's in flight, and what's queued. This file replaces the pre-pivot card-scenario roadmap (see closed PRs #8 / #9 for archive context); the live investigative-dossier model lives in `src/game/cases/*`, `src/game/investigation/*`, and `src/investigation/*`.

Open product questions and their current recommendations live in `docs/PRODUCT_DECISIONS.md`. Pre-demo smoke is in `docs/DEMO_QA_CHECKLIST.md`.

**Wave 4 game design pivot** — first end-to-end manual playtest of merged main showed the build is a readable interactive notebook, not a game (no choice, no fail state, no consequences). Wave 4 as polish (achievements UI surface, contradiction badge, reliability overlay, content editorial) is **cancelled**. Wave 4 is now a deliberate pivot to a real game loop. See `docs/GAME_DESIGN.md` for premise, mechanics, and vertical slice scope.

## Where we are

- **Wave 0** — `info-business-marathon` vertical slice (#10–#19): case loop, materials, bookmarks, draft summary, разбор, achievements (session-only).
- **Wave 0.5** — second case `family-retreat-center` (#20), reset-with-confirm (#25).
- **Wave 1** — depth + scaffolding (#26 mobile polish, #27 product decisions doc, #28 visible-language validator, #29 depth helpers, #30 season shell + progress persist, #31 Yandex SDK adapter stub).
- **Wave 2** — UX clarity, persistence, vestigial cleanup (#32 thresholds optional, #33 cleanup + demo QA, #34 achievements persist, #35 resolution clarity).
- **Wave 3** — content language + build infra + half-mechanic fix (#36 visible-language content pass, #37 Yandex iframe build, #38 docs pre-pivot cleanup, #39 red-herring filter flip).

## Wave 4 (pivot — design phase)

See `docs/GAME_DESIGN.md`. Summary:

- **Premise** — psychologist-expert working with families of people drawn into destructive groups.
- **Loop** — brief → starting documents → drag-highlight phrases into notebook hypotheses → spend bounded action budget on archive searches and gated interviews → final recommendation to family → epilogue.
- **Vertical slice** — 1 new case (`case-01: «Прорыв» — Сергей`), 4 starting documents, 3 contacts (1 public + 2 gated), 6-action budget, 3 recommendations, 6-9 epilogue variants. Mobile 390×844 supported. ETA 7-9 working days one sequential thread.
- **Discipline** — single thread, no parallel Devins. Pivot breaks `Evidence` / `Pattern` / `Report` runtime shapes; parallel merges would conflict on 90% of files.

## Wave 4 (queued — implementation order, after design approval)

1. Data model + JSON schema for `case-01` (new `Document`, `KeyPhrase`, `Contact`, `Recommendation`, `Epilogue` types). Drop old `Evidence` / `Pattern` runtime emission.
2. Workspace UI skeleton — replace 3-column dossier with documents + notebook + contacts + actions zones.
3. Drag-highlight interaction (desktop range-selection; mobile fallback if needed — see `docs/GAME_DESIGN.md` §8).
4. Action economy + gated interviews.
5. Recommendation submission + epilogue resolution.
6. Content writing pass for `case-01`.
7. Mobile polish + 390×844 smoke + visible-language guard expansion.

Each step lands as its own PR after manual playtest. No parallel lanes until §1-§5 are merged.

## Wave 4 cancelled (was polish, now obsolete)

Deferred or dropped from the prior Wave 4 plan because the underlying mechanic does not yet exist:

- Achievements UI surface (consuming `persistedEarnedAchievementIds`) — re-evaluate after the pivot establishes what "achievement" means in the new loop.
- Contradiction badge in the selected-pane — replaced by hypothesis support / contradiction inside the new notebook.
- Reliability overlay in the source pane — re-evaluate as a `Document.source` annotation in the new workspace.
- Second-case editorial polish (`family-retreat-center`) — current case shape will be deprecated; redo as a new case under the new schema once the slice is proven.

## Open questions

See `docs/PRODUCT_DECISIONS.md` for the live list of unresolved product questions and current recommendations. Pivot-specific open questions live in `docs/GAME_DESIGN.md` §8.

## Deferred / parked

- **Card-based scenario model** (`src/game/engine.ts`, `src/game/contentSchema.ts`, `src/game/data.ts`, `src/game/scenarios/`, `src/game/storage.ts`). Removed in Dev D — see closed PRs #8 / #9 for archive context. Do not resurrect; new mechanics build on the investigation runtime.
- **Direct mobile-store distribution** (PWA/TWA, Capacitor, Godot/Unity port). Re-evaluate only after web/Yandex traction.
