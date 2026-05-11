# Product Decisions

> **Status.** Decision document. Synthesises pending product choices that
> sit on top of the playable vertical slice (post PR #25). Docs-only —
> no source or content change attached. Each section gives the current
> state, the realistic options, a recommendation, the impact on future
> tasks, and the residual risks / open questions.
>
> **Sources read.** `docs/PLAYTEST_UX_REPORT.md`,
> `docs/PLAYTEST_BALANCE_AUDIT.md`, `docs/SEASON_AND_CASE_FRAMEWORK.md`,
> `docs/CONTENT_MODEL.md`, `docs/ROADMAP.md`, `docs/BACKLOG.md`,
> `src/investigation/resolutionModel.ts`,
> `src/investigation/interactionModel.ts`,
> `src/investigation/investigationViewModel.ts`,
> `src/game/cases/info-business-marathon/{case,report,evidence}.json`,
> `src/game/cases/family-retreat-center/{case,report,evidence}.json`,
> `src/game/seasons/season-01.json`,
> `scripts/validate-investigation.mjs`.

## Executive recommendation

After the vertical slice (PRs #14–#25) the loop is playable and the
content authoring pipeline is stable. The cheapest product wins in the
next wave are **fixing dead loops, not adding new mechanics**. Specifically:

1. **Stop the dead-content trio.** Red herrings are filtered out of the
   source pane, so the `шум` metric is structurally 0 and the
   "Не поспешил" achievement is trivially earned (see §1). Pick a side:
   either make red herrings visible and balance them, or remove
   `isRedHerring` plus the `шум` metric plus the `a_no_rush` achievement
   from the visible model. Today the game *pretends* this dimension
   exists.
2. **Decide `report.thresholds` once and for all.** It is typed,
   schema-required, and authored in both cases — but the runtime
   eligibility logic in `interactionModel.ts` reads only outcome-level
   `minPatternConfirmedCount` / `requiredPatternIds` / `forbiddenPatternIds`.
   Nothing in `src/investigation/` reads the threshold block (see §2).
   Recommendation: keep `thresholds` strictly for the validator (drive
   the low / medium / strong outcome-class warning) and remove the field
   from `ReportContent` runtime types.
3. **Don't add a new mechanic next. Tune the existing one.** The cheapest
   playtest wins are: (a) showing red herrings in the source pane,
   (b) re-balancing `ro_protective_focus` so it is not the cheapest
   non-fallback outcome, (c) persisting achievements in localStorage so
   the player has cross-case continuity. Each of these is one PR and is
   higher-leverage than a brand new tool like a contradiction scanner.
4. **Season shell is not a P0.** The case picker already lists both
   cases. Wrapping it as a "season screen" is a polish PR for the demo,
   not a content unlock; do it after balance tuning, not before.
5. **Yandex Games target ≈ Phase 3 in ROADMAP.** The minimum demo
   checklist is small and tractable (single-season Yandex iframe, save
   slot, no live ads). Targeting it before tuning means shipping
   trivial-`шум` / trivial-`a_no_rush` to the public storefront — bad
   first impression. Order: §1 → §2 → §3 tuning → §4 season shell →
   §6 Yandex.

## Decision matrix

| Topic | Recommendation | Why now | Implementation owner |
|---|---|---|---|
| **1. Red herrings / noisy fragments** | Make noisy fragments visible in the source pane, keep `isRedHerring` as the engine flag. Re-balance `шум` and `a_no_rush` accordingly. | The metric and the achievement are currently dead content. Both seeded cases authored 1–3 red herrings that no player can interact with. | Dev P (investigation depth) |
| **2. `report.thresholds`** | Keep in JSON + validator. Remove from runtime `ReportContent` type and `report.json` schema enforcement; emit a content-authoring warning when the values fall outside `[1..N]`. | Currently a dead config that every case must keep in sync with the *implicit* runtime rule. Maintenance debt with zero reader. | Dev P (cleanup ride-along) |
| **3. Achievements / titles** | Persist per-run achievements in localStorage as a small badge cabinet, *not* as season-level titles. Drop or rework `a_no_rush` after §1. Keep the five seeds. | Currently lost on every back-navigation. Cross-case continuity is the cheapest reason to return for a second case. | Dev Q (resolution tuning) |
| **4. Season progress** | Promote `CaseSelectScreen` to a one-season shell that reads `season-01.json`. Persist `started / submitted` per case. Keep order free-select for now. | `season-01.json` exists and is unused. The picker already needs a copy pass after the planned re-balance. | Dev U (season shell) |
| **5. Investigation methods / tools** | First playable tool after bookmarks: **source reliability overlay**. Pure UI over existing `source.reliability`. Second: **contradiction surfacing in the selected-pane** (no new screen). Defer person map, timeline compare, mentor hints. | Both are cheap, both directly address §1 and §3 risk-level legibility, neither needs schema or content changes. | Dev P → Dev Q |
| **6. Yandex / demo target** | Target a Yandex Games iframe build of Season 01 as the demo milestone. Minimum checklist below. Web-only standalone stays the fallback. | Roadmap Phase 3 says Yandex first; Capacitor / Google Play is Phase 5. Reasonable order. | Dev V (demo readiness) |

## 1. Red herrings / noisy fragments

### Current state

- `EvidenceFragment.isRedHerring: boolean` is part of the canonical
  schema. Both seeded cases author red herrings:
  `info-business-marathon` has 3 (`e_landing_results`,
  `e_video_general_promise`, `e_comments_donor_endorsement`);
  `family-retreat-center` has 1 (`e_news_neutral`).
- `src/investigation/investigationViewModel.ts:360`
  `buildFragmentsBySource` filters out any fragment with
  `defaultVisible: false` *or* `isRedHerring: true` before handing
  fragments to the dossier source pane.
- Result, confirmed by `docs/PLAYTEST_BALANCE_AUDIT.md` and by reading
  `resolutionModel.ts`:
  - **the player never sees a red-herring fragment** in the source pane,
    so they cannot bookmark one;
  - therefore `noiseFragments` in the resolution is always `[]`,
  - therefore the `шум` metric is always `0`,
  - therefore the `Не поспешил` (`a_no_rush`) achievement is
    **trivially earned for every submission with ≥1 bookmark**.

This was already flagged by the balance audit (§"Balance risks") and
by the UX report.

### Options

| Option | Description | Consequence |
|---|---|---|
| **A. Show them.** | Drop the `isRedHerring` filter in `buildFragmentsBySource` so noisy fragments appear in the source pane alongside legitimate ones. Keep all engine effects (`noiseFragments`, `шум` metric, `a_no_rush`). | Live `шум` metric, live `Не поспешил` achievement, deeper play. Requires a content balance pass: today many "neutral / helpful" fragments are authored as `defaultVisible: false` + `isRedHerring: true`, which would *all* become visible. Some need re-labelling. |
| **B. Hide them, but keep them surfaced post-submit.** | Keep the source pane filter. Stop calling unseen content "noise" — surface red herrings in the debrief only as *fragments you didn't add* under a different label ("что *могло* отвлечь"). Remove the `шум` metric and `a_no_rush` from the visible UI. | Honest about what the player did. Loses the "got fooled" learning dimension entirely. Cheap. |
| **C. Method-gated reveal.** | Hide noisy fragments by default. Unlock visibility after the player has earned a hypothetical "language audit" or "source reliability" tool. | Best long-term: makes the `шум` axis a *learned* skill, not a default trap. Highest cost — requires the tools system from §5. |

### Recommendation

**Option A now, Option C eventually.**

Right now the schema cost is paid (`isRedHerring`, `noiseFragments`,
metric, achievement, debrief panel) for zero player-facing effect.
Removing the filter is a one-line change in
`investigationViewModel.ts` and unblocks the entire `шум` axis.

The content cost is moderate but bounded: both cases need a quick
audit to make sure each `isRedHerring: true` fragment actually reads
as *plausibly relevant but wrong*, not as *engine padding*. The
balance audit already lists each red herring; that list is the
work-tree for the content pass.

**Don't go to Option C until the methods/tools system (§5) is real.**
A reveal gated on a tool that doesn't exist yet is the same dead
content with extra steps.

### Impact on future tasks

- Dev P (investigation depth) inherits this as its first change.
- Achievement model in §3 should be re-evaluated *after* the filter
  flips: `a_no_rush` becomes meaningful again, but the other four
  achievements may rebalance against it.
- The "что было шумом" panel copy in `DossierApp.tsx` and the empty
  state ("Шумных фрагментов в закладках не найдено.") become live UX
  rather than ceremonial.

### Risks / open questions

- Some currently-hidden red herrings may read as "obvious bait" once
  visible. Mitigation: the balance audit already flags every
  `isRedHerring` fragment; a 30-minute content review per case is
  enough.
- `ro_misread` in `info-business-marathon` is the only fallback
  outcome that uses forbidden patterns to fire. After flip, players
  can land it by stacking red herrings. That is the *intended*
  behavior — but the outcome's recommended framing should be reviewed
  so it reads as "you may have been led" rather than "you failed".
- Open: should we also relax the `defaultVisible: false` filter? It
  protects authored fragments that are intentionally engine-internal
  (e.g. used to make a pattern reachable without being shown). For
  now, keep it; only the `isRedHerring` half of the filter is the
  problem.

## 2. `report.thresholds`

### Current state

- `ReportContent` (in `src/game/investigation/types.ts:151`) requires:
  ```ts
  thresholds: {
    minConfirmedPatternsForStrongOutcome: number
    maxContradictionsBeforeWeakOutcome: number
    riskPersonsThreshold: number
  }
  ```
- Both cases author it (`info-business-marathon/report.json:1-5`,
  `family-retreat-center/report.json:1-5`) with the same shape.
- The only reader is `scripts/validate-investigation.mjs:240` — it uses
  `minConfirmedPatternsForStrongOutcome` to split outcomes into low /
  medium / strong buckets for the "missing outcome class" warning. The
  other two threshold fields are read by nothing at all.
- Runtime outcome selection lives in
  `interactionModel.ts:isOutcomeEligible` and uses the
  outcome-level fields, not the threshold block.

### Options

| Option | Description | Consequence |
|---|---|---|
| **A. Wire thresholds into runtime.** | Replace ad-hoc outcome eligibility (`min strong ≥ outcome.minPatternConfirmedCount`) with a thresholds-driven model: e.g. `maxContradictionsBeforeWeakOutcome` could downgrade a strong outcome when ≥N contradictions are selected; `riskPersonsThreshold` could gate `ro_warning`. | Live, meaningful config — but a big change to a stable model. Requires a balance re-tune of both seeded cases. |
| **B. Remove thresholds entirely.** | Drop from types and schemas. Replace the validator's `strongThreshold` constant with a literal `4` (matches today's authored value). | Smallest blast radius. The implicit "≥4 strong = system" rule is documented in the validator and in `docs/SEASON_AND_CASE_FRAMEWORK.md`. |
| **C. Keep for authoring only.** | Keep the field in JSON, but make it `optional` in the runtime type *and* explicitly mark it "authoring-only" in the schema. The validator continues to use it for the outcome-class warning. | Documented dead config. Better than today, but still maintenance overhead per case. |

### Recommendation

**Option C.**

Reasoning:

- Option A would be the right move *if* we had a clear gameplay
  problem that the current eligibility logic cannot express. We
  don't — the present problems are §1 and §3, not eligibility.
- Option B over-deletes: the validator's outcome-class warning is
  genuinely useful (it caught the missing `medium` outcome in early
  drafts of `family-retreat-center`). It needs a number.
- Option C is the cheapest move that aligns intent with reality.
  Implementation: `thresholds?: ReportThresholds | undefined`; if
  absent, the validator defaults to `4`. Existing cases keep their
  authored values; new cases can omit the block.

### Impact on future tasks

- Dev P picks this up as a ride-along cleanup alongside §1.
- The `docs/CONTENT_MODEL.md` paragraph about `thresholds` becomes
  one sentence: "authoring hint for the validator's outcome-class
  warning; defaults to 4".

### Risks / open questions

- If we ever genuinely want a contradictions-driven downgrade (e.g.
  the player picks 3 counter fragments and the strong outcome gets
  softened), Option A becomes necessary. Until then, contradictions
  are surfaced in the debrief without affecting the chosen outcome —
  that is fine for a recognition game.

## 3. Achievements / titles

### Current state

- `resolutionModel.ts` computes five achievement seeds per submitted
  run: `a_no_rush`, `a_external_support`, `a_three_sources`,
  `a_reality_check`, `a_methodical_reader`.
- They are rendered in the post-submit `профиль работы` panel of the
  resolution screen.
- **They are not persisted anywhere.** Switching cases or refreshing
  the page wipes the badges; nothing in the case picker shows whether
  a case was played, never mind how well.
- `a_no_rush` is currently trivially earned (see §1 above).

### Options

| Option | Description | Consequence |
|---|---|---|
| **A. Per-run only, as today.** | Keep them ephemeral. | No work; no return-visit hook either. |
| **B. Per-case localStorage cabinet.** | Persist `{caseId, achievementId, earnedAt}` in localStorage. Show earned badges back in the case picker and (optionally) gray-out badges already earned. | One small UI surface, very high "I came back and saw progress" payoff. The first real reason for a player to play *more than one* case. |
| **C. Season-level titles.** | Promote the badge cabinet into named "titles" earned only across a full season (e.g. *"Методичный читатель сезона"* requires `a_methodical_reader` in every case of the season). | Stronger pull, more work. Only useful once we have ≥3 cases. |

### Recommendation

**Option B now. Option C is a Phase 4 idea.**

Reasoning:

- The cheapest reason to open the second case today is "I'm curious
  what's in there". Persisted badges give the player a concrete
  reason: "I earned 3/5 on case 1 — let me try to earn the missing 2
  on case 2 too".
- Implementation cost is low: a single localStorage key (call it
  `dossier-achievements-v1`), a small reducer in
  `DossierApp.tsx:handleSubmit`, and a badge strip in
  `CaseSelectScreen.tsx`.
- Titles (Option C) only start mattering with three or more cases,
  which is a Phase-2 content milestone (see `ROADMAP.md` §"Фаза 2").

### Achievements: which are educationally useful

Going through the five seeds, with explicit usefulness ratings:

| Id | Title | Educational signal | Verdict |
|---|---|---|---|
| `a_no_rush` | Не поспешил | "I didn't include obviously wrong material." | **Currently broken** (§1). After flip: keep. |
| `a_external_support` | Внешняя опора | "I noticed at least one protective tie." | **Keep.** Directly aligned with the game's central thesis. |
| `a_three_sources` | Три источника | "I confirmed a pattern from three independent materials." | **Keep.** Trains triangulation. |
| `a_reality_check` | Проверка реальности | "I weighed a counter-fact / protective fragment in my submission." | **Keep.** This is the one that makes counter-evidence not just decoration. |
| `a_methodical_reader` | Методичный читатель | "I opened most available materials before submitting." | **Soften.** Currently ≥75% opened sources. Real signal *only* if there's a cost to opening too few. Otherwise it rewards click-everything play. Consider raising to 90% **and** requiring a non-trivial outcome. |

### Impact on future tasks

- Dev Q (resolution tuning) inherits this section as its main brief.
- The case picker needs a small "earned 3/5" badge per card.
- If §1 (Option A) lands first, `a_no_rush` becomes a useful signal
  and stays in the cabinet. If §1 is deferred, the cabinet ships with
  4 real achievements + 1 cosmetic.
- Triggers a small `docs/METRICS.md` update: persistence introduces
  a "what fraction of players earn ≥3 achievements per case" metric
  that did not exist before.

### Risks / open questions

- localStorage scope. If the player plays a different case in another
  browser, achievements don't follow. Acceptable for a demo; revisit
  when (and if) Yandex SDK persistence lands.
- Reset story: there must be a "сбросить ачивки" button somewhere,
  symmetric with the "сбросить материалы" affordance already in
  `DossierApp`.

## 4. Season progress

### Current state

- `src/game/seasons/season-01.json` exists. Shape:
  `{id, title, subtitle, caseIds, themeTags, learningGoals}` — six
  learning goals authored, two case ids referenced.
- **Nothing imports it** at runtime. No `seasons/` directory exists
  in `src/`; `CaseSelectScreen.tsx` reads `investigationContents`
  directly from `src/game/investigation/data.ts`.
- `App.tsx` toggles between `CaseSelectScreen` and `DossierApp` based
  on a single `activeContent: InvestigationContent | null` state. No
  case-level "started" / "submitted" persistence; switching cases
  resets all selection state.

### Options

| Option | Description | Consequence |
|---|---|---|
| **A. Leave it as-is.** | Keep the manifest as content metadata only; the dossier UI continues to render a flat list of cases. | Zero work. Throws away the manifest's value. |
| **B. Season shell over flat list.** | Wrap `CaseSelectScreen` so it reads `season-01.json`: season title / subtitle as the header, season-level `learningGoals` as a small "о сезоне" expander, case cards rendered in `caseIds` order. No gating. | Modest work, big copy / framing win. The case picker becomes "season 01" instead of an anonymous list. |
| **C. Season shell + per-case status.** | B plus localStorage of `{caseId: 'not-started' | 'in-progress' | 'submitted'}`. Show status on the card; allow continuing an unsubmitted case (state restored from localStorage). | Bigger, requires a small interaction-state serializer. Pays off across §3 and §6. |
| **D. Season shell + linear order.** | B / C plus locking later cases until earlier ones are submitted. | High narrative payoff for a "season as TV show" feel. Risky: blocking access to content is the most common reason players bounce in short demos. |

### Recommendation

**Option C. Free-select, *not* linear.**

Reasoning:

- B alone is the cheapest win and probably what we'd ship in a single
  PR.
- C is C-minus-1-PR: same UI + a localStorage reducer borrowed
  from §3. Doing them together avoids two passes at the picker copy.
- D is a content lever, not a structural one. Until we have ≥3
  cases, locking case 2 hurts more than it helps. Re-evaluate when
  Phase 2 ships a third case.

### Impact on future tasks

- Dev U owns this. Should land *after* §3 because §3 introduces the
  localStorage namespace and reducer.
- `OnboardingGuide` already records a "seen" flag in localStorage
  (`dossier-onboarding-seen-v1`) — keep namespace consistency: e.g.
  `dossier-season-progress-v1`.
- `CaseSelectScreen` copy currently mixes "выберите кейс для работы"
  with the season title. Pick one tone in the same PR.

### Risks / open questions

- If we ever load multiple seasons, the season manifest list needs an
  index. Today there is exactly one; a single import is fine.
- "Continue in progress" is non-trivial: it requires serialising
  `InteractionState` + `openedMaterialIds`. Stage as **submitted /
  not-submitted only** in the first cut; full mid-case resume is a
  separate, bigger PR.

## 5. Investigation methods / tools

> Backlog source: `docs/SEASON_AND_CASE_FRAMEWORK.md` §7.

### Current state

- The only player verb is **bookmark a fragment**. Everything else
  (observations, summaries, resolution) is derived state.
- The dossier UI has rich panels but no tools per se: nothing that
  the player explicitly *uses* on the material beyond reading and
  bookmarking.
- The framework backlog enumerates six future tools: source
  reliability overlay, contradiction scanner, timeline compare,
  person map, mentor hints, "show what opened this material".

### Options for "first playable tool after bookmarks"

| Option | Description | Cost | Player value |
|---|---|---|---|
| **A. Source reliability overlay.** | Visual treatment of `source.reliability` (already authored on every source) in the source pane: a small low / medium / high chip. Optionally a one-time tutorial nudge. | Lowest. Pure UI over existing data. No schema, no content. | High. Implicitly trains the player to weight what they read. |
| **B. Contradiction surfacing in the right panel.** | When the player selects a fragment that is `counterEvidenceIds` for a pattern they have other support on, surface a small "противоречит наблюдению Y" badge in the selected pane. | Low. Read-only over existing `ControlPattern.counterEvidenceIds`. | High. Makes counter-evidence visible at selection time, not only at debrief. |
| **C. "What opened this material" affordance.** | When a previously-locked source is opened, show in the source header which selected fragment unlocked it ("открыт по закладке: «фрагмент X»"). | Low. The data is already computed in `computeUnlockedSourceIds`. | Medium. Trains the player to recognise unlock chains, which today are invisible after the fact. |
| **D. Timeline compare.** | Side-by-side view comparing the public vs. closed source timeline at the same window. | High. New screen, new layout, possibly new data shape (sources don't currently carry a timestamp axis). | Medium-high. Strong narrative payoff but expensive. |
| **E. Person map.** | Graph view of persons by shared sources / shared patterns. | High. New layout. | Medium. Useful for cases ≥8 persons; both seeded cases have 6–8. |
| **F. Contradiction scanner (full).** | Dedicated screen / modal listing every contradiction pair in the case. | Medium-high. New screen. Largely subsumed by B for half the cost. | Medium. |
| **G. Mentor hints.** | Optional, opt-in nudges when the player has been stuck on the same source for too long. | Medium. New trigger model. Risk of paternalism. | Variable; depends entirely on writing quality. |

### Recommendation

**A then B. Defer D, E, F, G.**

Reasoning:

- A is the highest-value-per-line-of-code change in the entire
  document. `source.reliability` exists, is authored honestly across
  both cases, and is currently invisible to the player. Adding a tiny
  chip alongside the source title and a one-line legend in the
  onboarding is ~30 lines and a CSS pass.
- B is the natural follow-on: once the player visibly weights
  sources, the next learnable skill is "this material contradicts
  what I already have". Today the contradiction signal only fires
  post-submit (in `contradictedObservations`), which is too late to
  teach the lesson.
- C is also cheap and worth landing alongside A or B if there's room
  in the same PR.
- D / E / F / G are all real ideas but each is its own PR and depends
  on content / writing volume we don't have yet. They should stay in
  the framework backlog.

### Impact on future tasks

- Dev P picks up §1 + §2 + A + B in a single "investigation depth"
  PR, optionally rolling in C.
- The `docs/SEASON_AND_CASE_FRAMEWORK.md` §7 backlog gets a "shipped
  in PR #N" annotation on the items as they land.
- No new schema. No new content authoring rules.

### Risks / open questions

- A subtle risk: once reliability is visible, content authors will
  feel pressure to balance it. That's actually a good outcome — the
  balance audit already calls out that "all-`high`" cases would be
  bad. Treat increased authoring discipline as a feature.
- B's UX is the open design question. The right panel is already
  crowded; the contradiction badge needs to be terse and dismissible.

## 6. Yandex / demo target

### Current state

- The product is a Vite single-page app.
- `docs/ROADMAP.md` Phase 3 explicitly targets Yandex Games as the
  next public surface. Google Play / iOS is Phase 5, contingent on
  Yandex performance.
- No Yandex SDK adapter exists. No saving (other than the onboarding
  flag and any future achievement cabinet from §3). No fullscreen
  glue.
- The two seeded cases collectively run ~15–25 minutes of play,
  which matches Phase 4's scope target ("15–25 минут на партию").

### Options

| Option | Description | Consequence |
|---|---|---|
| **A. Web demo only.** | Ship the existing deploy preview (`https://dist-dwabckan.devinapps.com`) plus a tighter copy pass. Don't integrate Yandex SDK. | Fast. No platform integration cost. Limits reach. |
| **B. Yandex Games iframe build.** | Add a Yandex SDK adapter (init / fullscreen / loading state / save). Ship a build profile for Yandex Games. Keep the standalone build as fallback. | Matches the roadmap. Modest engineering work, larger QA surface. |
| **C. Both, parallel.** | A as the public link, B as the storefront listing. Same code base, two entry points. | Highest reach, slightly more maintenance. |

### Recommendation

**B, with C as the natural shape (one codebase, two entry points).**

Reasoning:

- The roadmap already commits us to Yandex; the demo target should
  match the roadmap.
- Standalone-web fallback is a near-zero-cost side effect of B (the
  SDK adapter must already gracefully degrade for offline dev), so C
  is "B done well", not extra work.

### Minimum demo checklist

To call the Yandex demo *publishable*:

```
Functionality
- [ ] Both seeded cases playable end-to-end on Yandex iframe (1920×1080 and 960×640).
- [ ] Onboarding overlay fires once per browser, dismissible.
- [ ] Submitted summary renders разбор on both cases.
- [ ] Back-to-picker preserves achievements (assumes §3 landed).

Persistence
- [ ] `dossier-onboarding-seen-v1` survives reload (already true).
- [ ] `dossier-achievements-v1` survives reload (depends on §3).
- [ ] `dossier-season-progress-v1` survives reload (depends on §4).
- [ ] Yandex SDK save adapter writes the same three keys through
      `ysdk.getPlayer().setData`, falls back to localStorage when SDK is absent.

Platform glue
- [ ] Yandex SDK initialised in `index.html` / bootstrap.
- [ ] Fullscreen toggle wired through SDK.
- [ ] Loading screen visible until React hydrates and content
      validators pass.
- [ ] No ad calls in v1. Document the rationale (recognition game,
      no F2P).

Moderation pass
- [ ] No real organisation names anywhere in case JSON (already
      enforced by `SEASON_AND_CASE_FRAMEWORK.md` §4).
- [ ] No expert-jargon labels in visible UI (`улика` / `доказательство` /
      `газлайтинг` etc. — already enforced by validator language warnings).
- [ ] Content warning string visible on both cases.

QA
- [ ] One smoke recording per case (Dev M5 already proved the loop).
- [ ] Lint / build / validate / audit:balance green on CI.
```

### What needs to persist in localStorage

- `dossier-onboarding-seen-v1` — already there.
- `dossier-achievements-v1` — from §3.
- `dossier-season-progress-v1` — from §4.

That is the entire persistence surface for the demo. Anything bigger
(mid-case resume, multi-season unlocks, custom replay slots) is a
post-Phase-3 question.

### Impact on future tasks

- Dev V owns the Yandex SDK adapter + build profile + a one-page
  "publishing notes" doc.
- The minimum demo checklist drives the order: §1 / §2 (Dev P)
  unblock fair `шум`; §3 (Dev Q) gives the cabinet; §4 (Dev U)
  gives the shell; only then Dev V wraps it for Yandex.
- The roadmap's Phase 4 ("Public MVP") metrics (`docs/ROADMAP.md`
  §"Фаза 4") become the post-publish analytics target — out of scope
  for the demo PR itself, but a Dev V follow-on.

### Risks / open questions

- Yandex moderation. Composite-fictional cases that adapt control
  patterns may still be flagged in some categories. Decision: keep
  `themeTags`, the content-warning string, and the educational debrief
  panel intact — they are the strongest signal that the game is a
  recognition tool, not a sect simulator. If moderation pushes back,
  the right answer is *more* explicit framing, not weaker mechanisms.
- Audio / music. The roadmap mentions it; nothing exists yet. Demo
  ships silent. Acceptable.
- "What if Yandex SDK fails to load?" Adapter must always be a
  feature-detect: if `window.YaGames` is missing, use the localStorage
  path. Standalone web stays viable.

## Proposed next PR sequence

Reordering the brief's draft sequence in light of §1–§6 above. The
core insight: **§1 and §2 are the cheapest wins and they unblock §3,
which in turn shapes §4 and §6.** No reordering of the *labels*; the
re-ordering is only of *contents per dev slot*.

```txt
Dev P — investigation depth (tuning, not new mechanics)
  - Drop isRedHerring filter from buildFragmentsBySource (§1, Option A).
  - Content pass on existing red herrings in both cases (§1).
  - Make report.thresholds optional, validator-only (§2, Option C).
  - Source reliability overlay (§5, A).
  - Contradiction surfacing in selected pane (§5, B).
  - Optionally: «открыт по закладке» source header (§5, C).

Dev Q — resolution tuning
  - localStorage achievement cabinet, 4–5 badges per case (§3, Option B).
  - Re-tune a_methodical_reader threshold (§3, table).
  - Review a_no_rush in light of Dev P §1 flip.
  - Re-evaluate ro_protective_focus cost vs. ro_early_signal (balance audit cross-case risk #3).

Dev S/T — case editorial / balance passes
  - Per-case content review for the new visible noise (§1 follow-on).
  - Calibrate ro_misread / ro_too_early framing copy.
  - Update docs/SEASON_AND_CASE_FRAMEWORK.md §2.3 ambiguity targets if §1 flip changes the math.
  - Optional: add 1 counter fragment per case (balance audit risk: single counter fragment).

Dev U — season shell + per-case progress
  - Read season-01.json in CaseSelectScreen (§4, Option C).
  - localStorage dossier-season-progress-v1 keyed by caseId.
  - Free-select order (not linear, §4).
  - Picker copy pass aligning eyebrow / H1 / footer with season tone.

Dev V — demo / Yandex readiness
  - Yandex SDK adapter (init / fullscreen / save) with feature-detect fallback (§6).
  - Build profile for Yandex Games iframe.
  - Wire the three localStorage keys through ysdk.getPlayer().setData.
  - One smoke recording per case on the Yandex build.
  - "Publishing notes" one-pager (rating, descriptions, screenshots).
```

This keeps the brief's *names* (Dev P / Q / S / T / U / V) but
deliberately moves "tune what exists" ahead of "add new mechanics".
The contradiction scanner and timeline compare from
`SEASON_AND_CASE_FRAMEWORK.md` §7 stay in the post-demo backlog —
they are good ideas, but they don't unblock the demo and they don't
fix any of §1–§3.

After Dev V, the next strategic decision is content scale (a third
case, possibly a second season) — that conversation belongs to
Phase 2 of the roadmap and is intentionally not pre-decided here.
