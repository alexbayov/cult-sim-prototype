# Playtest UX report — static, no-browser pass

> **Scope.** First useful version of this document, written by reading
> only the player-facing UI files and the two seed cases. No interactive
> playtest, no recordings, no screenshots. Per Dev M3 brief.
>
> **Files read.** `src/App.tsx`, `src/investigation/CaseSelectScreen.tsx`,
> `src/investigation/OnboardingGuide.tsx`, `src/investigation/ProgressNudge.tsx`,
> `src/investigation/DossierApp.tsx`, `src/investigation/resolutionModel.ts`,
> `src/game/investigation/data.ts`, and for both cases:
> `case.json`, `sources.json`, `evidence.json`, `patterns.json`,
> `report.json` (and `patterns.json` titles surfaced via `investigationViewModel.ts`).
>
> **Out of scope.** No UI changes proposed in code. Suggested replacements
> are copy/structure notes only.

## 1. Executive summary

The loop **is legible from code and UI text**. A first-time reader of
the source can reconstruct the intended flow:

```txt
case select  →  onboarding overlay (first run)
            ↘  dossier (materials + bookmarks + signals + summary)
                       ↘  submit  →  разбор (metrics + observations + achievements + glossary)
```

The visible vocabulary established in PR #14 (`материалы / фрагмент /
закладка / наблюдение / сводка`) is mostly preserved end-to-end. The
two seed cases (`info-business-marathon`, `family-retreat-center`) are
both reachable from the start screen after PR #20, and each loads its
own initial sources, persons, and patterns.

**What is still likely confusing for a first-time player** is mostly
copy, not architecture:

- A few **bare developer ids leak into the player-facing summary**
  (`info-business-marathon · исход: ro_system_proven`).
- The right-hand panel **silently renames itself** between «ключевые
  наблюдения» and «закладки» depending on selection — same place, two
  names.
- The visible vocabulary for "a repeating signal" is **split four ways**
  in the same screen: «повторяющиеся сигналы» (panel heading),
  «наблюдение» (right panel + glossary), «связь» (pattern status badges,
  summary), «сигнал» (pattern signal level). All map to one engine
  concept (`ControlPattern`).
- The **progress nudge gives the green light at 2 confirmed patterns**,
  but the strongest outcome (`Картина сложилась`) requires 4. This
  systematically nudges the player to submit a weaker sводка than the
  case can support.
- A handful of **idiomatic phrases don't survive translation from the
  design notes**: «красная селёдка» reads literally in Russian as «a red
  fish», not as «red herring».

None of these are blockers for showing the demo; they are the cheap
copy/structure wins to make before any real playtest video is recorded.

## 2. Current flow map

```txt
App (src/App.tsx)
│
│  state: activeContent: InvestigationContent | null
│         guideOpen: boolean   (localStorage key: dossier-onboarding-seen-v1)
│
├─ activeContent === null
│  │
│  ├─ CaseSelectScreen
│  │     header eyebrow:  "материалы расследования"
│  │     header H1:       "выберите кейс для работы"
│  │     link:             "как это работает"   → re-opens OnboardingGuide
│  │     per case card:    кейс / title / subtitle / publicLegend
│  │                       meta: материалов · людей · фрагментов · наблюдений · длительность
│  │                       CTA:  "открыть материалы"
│  │     footer note:      "Кейсы — вымышленные…"
│  │
│  └─ OnboardingGuide (overlay, first run automatic, reopenable from link)
│        5 numbered steps:
│          1  "Откройте материал и прочитайте фрагменты."
│          2  "Сделайте закладку на фразе, которая меняет контекст."
│          3  "Закладки могут открыть новые материалы."
│          4  "Наблюдения собираются из нескольких фрагментов."
│          5  "Когда будет достаточно — сформируйте сводку."
│        close: button "понятно, начать" / Esc / overlay click
│
└─ activeContent !== null  →  DossierApp(content)
   │
   ├─ back link:           "← к выбору материалов"
   │
   ├─ header:
   │     tab:              "МАТЕРИАЛЫ · № <case.number>"
   │     stamp:             view.status
   │     title / subtitle / case meta dl
   │     progress chips
   │     content warning
   │     ProgressNudge   (idle | progress | unlock | ready)
   │
   ├─ grid · left col:
   │     "люди"                  list of persons
   │     "повторяющиеся сигналы"  pattern cards (signal + connection + counts)
   │
   ├─ grid · center col:
   │     "материал"   tabs of sources (locked ones disabled)
   │                   fragments list with "сделать закладку" / "снять закладку"
   │     "хронология"  read-only timeline
   │
   ├─ grid · right col:
   │     "ключевые наблюдения" (if selectedCount === 0)
   │        OR  "закладки" (otherwise)
   │     "сводка"  pre-submit:
   │                  риск statement, status counts, hint, possible outcomes,
   │                  glossary preview, buttons:
   │                    "сформировать сводку" (enabled if canSubmitReport)
   │                    "сбросить материалы"  (enabled if selectedCount > 0)
   │              post-submit:
   │                  outcome title, summary, framing,
   │                  confirmed / intermediate / weak / contradicted lists,
   │                  strongest fragments, gaps, notes,
   │                  footer:   "материалы дела: <caseId> · исход: <outcomeId>"
   │                  buttons:  "обновить сводку" / "сбросить материалы"
   │
   ├─ resolution section (only after submit):
   │     "разбор" header + "рамка сводки: <outcomeTitle>"
   │     metric cards:  точность · осторожность · полнота · защитный фокус · шум
   │     resolution stats:  открытых материалов · фрагментов в закладках · видимых материалов
   │     grid:
   │        "что уже видно"            strong + supported observations
   │        "что пока слабо"            weak observations
   │        "что противоречит версии"   contradicted observations
   │        "что было шумом"            selected red-herring fragments
   │        "что можно было ещё проверить"  patterns with strong fragments not in закладки
   │        "внешние опоры" (if any)    protective observations
   │     "профиль работы"  five achievements (earned / locked, ● / ○)
   │     "справочник по связям"  glossary of surfaced patterns
   │
   └─ footer:  "Демо-оболочка работы с материалами…"
```

Key entry points worth memorising:

- `App.tsx:5` `import { investigationContents }` — the case list is the
  full bundled array; nothing about ordering is "first case only".
- `App.tsx:28-30` `handleSelect` simply sets `activeContent`; the back
  link nulls it. State inside `DossierApp` (the player's selections) is
  not persisted across this round-trip.
- `DossierApp.tsx:64` `initialMaterialCount = content.case.initialSourceIds.length`
  is per-case, so unlocks are correctly counted relative to each case's
  own starting set.
- `DossierApp.tsx:561` and `:594` — submit button copy switches between
  «сформировать сводку» (pre-submit) and «обновить сводку» (post-submit).

## 3. Reachability

**Both seed cases are reachable after PR #20.** The check is direct:

- `data.ts:36` exports `infoBusinessMarathonInvestigation`.
- `data.ts:46` exports `familyRetreatCenterInvestigation`.
- `data.ts:59` exports `investigationContents` containing both.
- `App.tsx:54-58` passes `investigationContents` to `CaseSelectScreen`.
- `CaseSelectScreen.tsx:52` maps over `cases` with no index filter,
  no slicing, no "first case only" branch.

**No hardcoded first-case assumptions found** in the scoped files.
Specifically:

- `DossierApp.tsx` derives its `view`, `activeMaterial`, and
  `initialMaterialCount` from the passed-in `content` prop — never
  from a singleton import.
- `useInvestigationState(content)` is keyed on the supplied content, so
  switching cases re-initialises selection state cleanly (at the cost
  of losing previous progress on back-navigation — see §4.1).
- `resolutionModel.ts` works generically: it reads
  `content.patterns / sources / evidence / debrief / case.initialSourceIds`,
  and detects protective patterns by id substring (`PROTECTIVE_PATTERN_ID_HINTS = ['protective', 'reality']`),
  which both cases honour (`p_protective_ties`, `p_reality_testing`).

**Two reachability adjacencies worth noting** (not regressions of #20,
just things to watch):

1. **`OnboardingGuide` is global, not per-case.** The dismissal flag
   (`dossier-onboarding-seen-v1`) is set once and never re-fires when
   the player opens a second case. Replays of the second case may feel
   abrupt if the player skipped the guide quickly the first time.
2. **Source unlocks form per-case chains, not gates.** Initial source
   ids are present for both cases (6 for №01, 5 for №02), so every
   case opens with playable surface area. None of the unlock chains
   block first-touch progress; they only enrich.

## 4. UI clarity audit

### 4.1 Case selection (`CaseSelectScreen.tsx`)

| Area | Observation |
|---|---|
| Eyebrow «материалы расследования» + H1 «выберите кейс для работы» | Reads cleanly. The two-noun stack ("материалы" then "кейс") teases the same vocabulary collision that the dossier later inherits (a case folder = «материалы», a single source inside it = «материал»). |
| Card meta «материалов: N · людей · фрагментов · наблюдений · длительность» | Same word, two scales: the card uses «материалов» to mean *source documents inside this case*, while the dossier uses «МАТЕРИАЛЫ №01» to mean *the entire case folder*. First-time players will conflate them. |
| Card meta «наблюдений: N» | Exposes the count of solvable patterns before the player has earned them. Functionally a small spoiler (e.g. "12 наблюдений" = "there are 12 things you're meant to find"). |
| Length hint «короткий ~15 минут / камерный ~20 минут / плотный ~30 минут» | Derived from `evidence.length` and `sources.length` in `deriveLengthHint`. Not measured. Risk of being optimistic for first-time players. |
| CTA «открыть материалы» | Fine; uses the same verb the player will see later for the dossier ("открыть материал" / source tabs). |
| Footer disclaimer | Strong, neutral, correctly framed. |
| Progress / completion state | Not shown. Once the player goes into a case and comes back, the start screen looks identical to the first visit. No "in progress" / "сводка подана" / "новый" badges. |
| Re-opening the guide | The «как это работает» link is discoverable and matches the onboarding header. Good. |

### 4.2 Onboarding (`OnboardingGuide.tsx`)

| Step | Text | Note |
|---|---|---|
| 1 | «Откройте материал и прочитайте фрагменты.» | Clear. Maps to source tabs + fragment list. |
| 2 | «Сделайте закладку на фразе, которая меняет контекст.» | Abstract. "Меняет контекст" is editorial language; players don't yet have a feel for what counts. A concrete example would land harder ("…на фразе, после которой группа выглядит иначе, чем на лендинге"). |
| 3 | «Закладки могут открыть новые материалы.» | Correct (six unlock chains in case #01, several in case #02). Good preview of the mechanic. |
| 4 | «Наблюдения собираются из нескольких фрагментов.» | Introduces the right-hand-panel concept by its calmer name, "наблюдение". Good. |
| 5 | «Когда будет достаточно — сформируйте сводку.» | Vague threshold. The actual gate is `canSubmitReport`, and the strong outcome wants 4 confirmed patterns. Players will not infer "4". |

The bottom note ("Язык работы намеренно нейтральный…") is editorially
useful and matches the tone pass from PR #14, but it reads as
self-conscious commentary inside an onboarding for someone who has not
yet played a single second. Could move to the справочник or the case
footer.

### 4.3 Progress nudge (`ProgressNudge.tsx`)

| Trigger | Text | Note |
|---|---|---|
| `selectedCount === 0` | «Поставьте первую закладку в материале.» | Clear. Tone `idle`. |
| `confirmedPatternCount >= 2` | «Можно сформировать сводку.» | Fires **two patterns early** relative to the strong outcome's `minConfirmedPatternsForStrongOutcome: 4`. A first-time player who follows the nudge will land on `ro_warning` or `ro_early_signal` instead of `ro_system_proven` and may read that as failure. |
| `unlockedMaterialCount > initialMaterialCount` | «Открылся новый материал.» | Does **not** name which material opened. The player has to scan the source tabs to find the change. |
| else | «Ищите повторяющийся сигнал в другом материале.» | Uses «сигнал», which has not been introduced anywhere in the player's vocabulary up to this point (onboarding uses «наблюдение»). |

Tone classes (`idle / progress / unlock / ready`) and the static `→`
icon are fine. The component correctly hides itself after submission.

### 4.4 Bookmark buttons (fragment actions in «материал»)

- `сделать закладку` / `снять закладку` on each fragment, plus a
  duplicate `снять закладку` in the right-panel observation card.
  Symmetric and discoverable.
- Selected fragments get `.is-selected` styling in the source list and
  also surface in the right panel. Good redundancy.
- No bulk action, no sort, no filter. Acceptable at this scale; would
  bite if a case grows to 50+ fragments.
- `unlocksHint` (a fragment hint string when a fragment unlocks a new
  source) is shown inline below the fragment. Good — but only fires if
  the case author authored a hint, and not all unlock fragments have
  one.

### 4.5 Observation / signals panel («повторяющиеся сигналы»)

- Cards show: title · `сильный / средний / слабый сигнал` badge · short
  description · connection status badge · `markedCount / targetCount`
  · «сильных сигналов: N · слабых сигналов: N» row.
- Protective patterns (`p_protective_ties`, `p_reality_testing`)
  render with **the same visual structure as risk patterns**. A naïve
  player will flag «внешние опоры» as something to suspect. They are
  only differentiated post-submission, in the `разбор` section, by
  going under a separate card («внешние опоры»).
- Vocabulary collision (also called out in §1):
  - Panel heading: «повторяющиеся сигналы».
  - Connection labels: «связь подтверждена / промежуточная связь / …».
  - Signal-level badges: «сильный сигнал / средний сигнал / слабый
    сигнал».
  - Right-panel header: «ключевые наблюдения» (switching to «закладки»
    on selection).
  - Glossary header: «справочник по связям».
  All refer to the same `ControlPattern` entity. Two of them
  («связь», «наблюдение») are nouns the player has to learn cold.

### 4.6 Right panel: «ключевые наблюдения» ⇄ «закладки»

This is the single most disorienting copy moment in the dossier:

```txt
DossierApp.tsx:77-83
  observationsHeading = selectedCount > 0 ? 'закладки' : 'ключевые наблюдения'
  observationsList    = selectedCount > 0 ? view.selectedObservations : view.observations
  observationsCounter = selectedCount > 0 ? '<N> в подборке' : '<N> в подборке'
```

The same panel renames itself the moment the player makes their first
bookmark — and the underlying list changes from "important observations
visible in this case" to "the player's marked fragments". The counter
phrasing «N в подборке» is identical for both states, which makes the
swap easier to miss, not easier to parse.

### 4.7 Summary panel (`сводка`)

Pre-submit:

- Risk statement at the top, then «отмечено фрагментов / подтверждённых
  связей» counts, then a context hint that branches on (0 selected /
  ≥1 selected with no confirmed / ≥1 confirmed).
- «возможные исходы» lists **every outcome** (`ro_insufficient`,
  `ro_early_signal`, `ro_warning`, `ro_protective_focus`,
  `ro_system_proven`, `ro_misread` for case #01) with its title and
  summary blurb. Educationally good ("here is the rubric you're being
  graded on") but mildly spoils the discovery loop.
- «справочник» preview is shown pre-submission, listing all debrief
  entries. Tone is fine but it's a lot of text before the player has
  earned anything.

Post-submit:

- Outcome title + summary + recommended framing read well.
- Lists of confirmed / intermediate / weak / contradicted patterns,
  strongest fragments (quoted), and gap patterns are clearly grouped.
- **Bug-class copy leak** on `DossierApp.tsx:527-528`:
  ```txt
  материалы дела: {view.caseId} · исход: {view.report.outcomeId}
  ```
  This renders `info-business-marathon · исход: ro_system_proven` to
  the player. These are internal ids; the human title and outcome
  label are right above. Either drop the line entirely or render
  human-readable case title and outcome title.
- «сбросить материалы» button is rendered next to «обновить сводку»
  and is destructive (clears the whole selection state). No
  confirmation dialog.

### 4.8 Resolution / debrief (`разбор`)

- Five metrics: `точность`, `осторожность`, `полнота`, `защитный
  фокус`, `шум`. Each has a `description` rendered as a sentence below
  the bar — good (tooltips alone would have lost mobile users).
- Stat row («открытых материалов / фрагментов в закладках / видимых
  материалов»). Reads as a verdict on the player's reading pace. Good.
- Resolution cards:
  - «что уже видно» / «что пока слабо» / «что противоречит версии» —
    well framed, observational rather than scoring.
  - «что было шумом» — copy: «Красных селёдок в подборке не найдено».
    The phrase «красная селёдка» is a calque of "red herring" and is
    not standard idiomatic Russian; it will read literally to most
    players as "no red fish were found". Same issue in the metric
    description («Доля красных селёдок в подборке.»).
  - «что можно было ещё проверить» — pattern of "topics you could have
    touched". The wording avoids "you missed", which is the right call.
- «профиль работы» as the achievements section header is poetic but
  ambiguous. Most players would expect «достижения» or «итоги».
- Achievement glyph cue (● earned / ○ locked) is colour-independent —
  good for accessibility.
- Glossary is filtered to surfaced patterns + any pattern whose
  example fragment is currently bookmarked. Scoped well; not a wall of
  text.

## 5. Top 10 UX / copy risks

Ranked by how cheaply they pay off in a real playtest.

### 1. Raw developer ids leak into the post-submit summary footer

- **Where.** `DossierApp.tsx:526-529`.
- **Current string.**
  > материалы дела: info-business-marathon · исход: ro_system_proven
- **Why confusing.** Two human-readable names (`view.title`,
  `view.report.title`) already sit a few lines above. The footer
  exposes engine ids that mean nothing to a player.
- **Suggested replacement.** Either drop the line, or replace with:
  > материалы дела: «{view.title}» · сводка: «{view.report.title}»

### 2. Progress nudge fires "ready" two patterns early

- **Where.** `ProgressNudge.tsx:33` (`confirmedPatternCount >= 2`).
- **Current string.** «Можно сформировать сводку.» at 2 confirmed
  patterns, while `report.json` thresholds want **4** for the
  `ro_system_proven` outcome.
- **Why confusing.** The nudge tells the player "you're ready", they
  submit, and they land on `ro_early_signal` / `ro_warning`. They will
  read that as a failure of their judgement, not as the nudge being
  too eager.
- **Suggested replacement.** Tie the threshold to the case's own
  `minConfirmedPatternsForStrongOutcome` (≥ 4 in both seeds). Below
  that, soften the nudge:
  > 2 связи подтверждены — сводку уже можно подать, но картина ещё неполная.
  > Дойдите до 4 наблюдений, чтобы сводка читалась как система.

  At ≥ threshold, switch to the existing «Можно сформировать сводку.».

### 3. Right-panel heading silently swaps between two names

- **Where.** `DossierApp.tsx:77-83`.
- **Current strings.** Heading toggles between «ключевые наблюдения»
  and «закладки»; counter is identical («N в подборке») in both
  states.
- **Why confusing.** Same screen region, different name and different
  list, same counter phrasing. Reads like the panel replaced its
  contents.
- **Suggested replacement.** Pick one heading and use a stable subtitle
  for state. E.g. heading always «закладки», with a static line
  underneath:
  > пока нет закладок — здесь будут ключевые наблюдения по делу
  > or
  > <N> закладок · <K> связей подкреплено

### 4. Vocabulary fragmentation for "a repeating pattern"

- **Where.** `повторяющиеся сигналы` (panel heading), «наблюдение»
  (right panel + glossary), «связь» (status badges + summary lists),
  «сигнал» (signal level + progress nudge text «повторяющийся
  сигнал»).
- **Why confusing.** Four visible nouns for one engine concept. A
  first-time player has to learn the mapping by inference.
- **Suggested replacement.** Pin **two** visible terms and use them
  everywhere:
  - the *thing the player is looking for* = **наблюдение**;
  - the *evidence that supports one* = **закладка**.
  Treat «сигнал» / «связь» as internal phrasing or scoped to the
  metric descriptions and badges. Specifically rename the left-panel
  heading from «повторяющиеся сигналы» to «наблюдения» (with an
  optional subtitle «повторяющиеся сигналы из материалов»).

### 5. "Открылся новый материал" doesn't say which material

- **Where.** `ProgressNudge.tsx:38`.
- **Current string.** «Открылся новый материал.»
- **Why confusing.** The player has to scan the source tabs to spot
  the change. With 10–12 tabs, this is unfriendly on mobile widths.
- **Suggested replacement.** Pull the unlocked source title through
  to the nudge:
  > Открылся новый материал: «{source.title}».
  >
  > or, if multiple unlock at once:
  >
  > Открылись новые материалы (N). См. вкладку «{first.title}».

### 6. "Красная селёдка" reads literally in Russian

- **Where.** `resolutionModel.ts:317` (metric description), and
  `DossierApp.tsx:745` («Красных селёдок в подборке не найдено»).
- **Current strings.**
  > «Доля красных селёдок в подборке.»
  > «Красных селёдок в подборке не найдено.»
- **Why confusing.** «Красная селёдка» is a calque of *red herring*;
  it is not idiomatic Russian for "a misleading detail". Players who
  do not know the English idiom will read literally.
- **Suggested replacement.** Replace with one of:
  - «отвлекающая деталь / отвлекающие детали»;
  - «ложный след / ложных следов»;
  - «шум / шумовых фрагментов» (consistent with the metric label «шум»).
  E.g.:
  > «Доля отвлекающих деталей в подборке.»
  > «Шумовых фрагментов в подборке не найдено.»

### 7. Destructive «сбросить материалы» has no confirmation

- **Where.** `DossierApp.tsx:540-545` (post-submit) and 595-602
  (pre-submit).
- **Current string.** «сбросить материалы»
- **Why confusing.** The verb «сбросить» is final and there is no
  confirmation dialog. Players accustomed to "reset" patterns in
  other apps may assume it resets only the current view or the
  current material, not the entire investigation. Combined with the
  duplicated «закладки» / «сбросить материалы» surface, accidental
  loss is plausible.
- **Suggested replacement.** Either:
  - rename to «начать материалы заново» and gate behind a confirm
    («это снимет все закладки. продолжить?»);
  - or split into two actions: «снять все закладки» (reversible
    framing) vs. «начать с нуля» (full reset).

### 8. Onboarding step 2 is too abstract

- **Where.** `OnboardingGuide.tsx:22`.
- **Current string.** «Сделайте закладку на фразе, которая меняет
  контекст.»
- **Why confusing.** "Меняет контекст" is editorial vocabulary. A
  first-time player has no calibration for what qualifies.
- **Suggested replacement.** Anchor with a concrete cue:
  > Сделайте закладку на фразе, после которой группа выглядит иначе,
  > чем на лендинге. Это может быть про деньги, про окружение или
  > про «своих».

### 9. Length hint can mislead

- **Where.** `CaseSelectScreen.tsx:17-23` (`deriveLengthHint`).
- **Current strings.** «плотный · ~30 минут» / «камерный · ~20 минут»
  / «короткий · ~15 минут».
- **Why confusing.** Computed from `evidence.length` and
  `sources.length`. Not measured. A player whose pace differs from
  the heuristic will read it as a promise.
- **Suggested replacement.** Either drop the time qualifier and keep
  the qualitative label («камерный»), or add a softening word:
  > «плотный · около 30 минут чтения»

### 10. Pre-submit summary lists every possible outcome

- **Where.** `DossierApp.tsx:566-573` ("возможные исходы" inside the
  `сводка` aside, pre-submit).
- **Current string.** Full list of all 5–6 outcomes (`ro_insufficient`
  through `ro_misread`) with title and summary, visible before the
  player makes their first selection.
- **Why confusing.** Two effects:
  1. **Light spoiler.** The win/lose space, including the "misread"
     outcome, is on screen before the player has earned any of it.
  2. **Cognitive load.** It is the densest text block in the dossier
     at exactly the moment the player should be reading the materials.
- **Suggested replacement.** Collapse by default with a small toggle
  (`показать возможные рамки сводки`), or replace the full
  `outcomes` list pre-submit with one neutral line:
  > Сводка может прийти как «ранний сигнал», «верная тревога» или
  > «картина сложилась» — это зависит от того, сколько связей
  > подкреплено. Полный разбор будет после подачи.

### Worth noting but didn't make the top 10

- Protective patterns visually indistinguishable from risk patterns in
  the «повторяющиеся сигналы» list (only separated in `разбор`).
- Case-select screen does not show progress / status for cases the
  player has already opened or completed.
- `OnboardingGuide` dismissal is global, not per-case.
- Footer label of the achievements section uses «профиль работы»;
  «достижения» or «итоги» would be more findable.

## 6. What should be browser-tested later

Short list — for the actual playtest pass, not now.

1. Both cases are reachable end-to-end (case select → dossier → submit
   → разбор), with the second case (`family-retreat-center`) not
   inheriting state from the first.
2. `OnboardingGuide` first-run + re-open via «как это работает» link;
   confirm `dossier-onboarding-seen-v1` localStorage seed behaves on
   private-window reload.
3. Bookmark a single fragment with `unlocksSourceIds`, confirm the
   locked tab becomes available and `ProgressNudge` flips to the
   "unlock" tone — and that the unlocked source's title appears in
   the nudge if the recommendation in §5 #5 lands.
4. Submit summary at 0, 2, and 4+ confirmed patterns; check outcome
   mapping (`ro_too_early` / `ro_early_signal` / `ro_warning` /
   `ro_system_proven`) matches `report.json` thresholds.
5. Resolution screen for case #02 lists `внешние опоры` (protective
   observations) iff `p_protective_ties` or `p_reality_testing` have
   any selected supporting fragment.
6. Mobile (390×844): wrapping of `progress-chips`, source tabs, and
   the metric cards row. Look for horizontal scroll or clipped tab
   text.
7. «сбросить материалы» post-submit returns the dossier to a
   pre-submit state with selection cleared; «← к выбору материалов»
   leaves the case and returns to `CaseSelectScreen` with no residual
   nudges or modals.
8. Legacy card prototype still loads if exposed (out of scope for the
   dossier flow but flagged in `docs/CONDUCTOR_HANDOFF.md` as not yet
   retired).

## 7. Cross-references

- Content / vocabulary model: `docs/CONTENT_MODEL.md`.
- Language tone rules: PR #14 and `docs/CONTENT_MODEL.md` §"Language
  regression".
- Season + case authoring framework: `docs/SEASON_AND_CASE_FRAMEWORK.md`.
- Evidence interaction model: `docs/EVIDENCE_INTERACTION_PLAN.md`.
- Repo conductor handoff and status: `docs/CONDUCTOR_HANDOFF.md`.
