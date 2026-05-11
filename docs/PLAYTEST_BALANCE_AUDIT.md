# Playtest balance audit

Static, data-driven audit of every investigation case bundled in
`src/game/cases/`. Numbers in this document are produced by
`scripts/audit-investigation-balance.mjs` and mirror the runtime rules
implemented in `src/investigation/interactionModel.ts`
(`computeObservationStatus`, `buildSummaryDraft`) and the dossier source
pane filters in `src/investigation/investigationViewModel.ts`
(`buildFragmentsBySource`).

Run:

```bash
npm run audit:balance
```

The script is dependency-free and prints a console-friendly report
covering source counts, unlock chains, per-pattern strong/weak/counter
coverage, minimum-fragments-to-strong per pattern, minimum-fragments per
outcome, red-herring inventory, counter/protective fragment inventory,
and unreachable observations/outcomes.

Tables in this document show two min-fragment numbers per row:

| column | meaning |
|---|---|
| **model min** | lower bound from the bare model — any fragment can be selected, ignoring the dossier source pane filter. |
| **UI min**    | realistic bound assuming the player only sees fragments that pass `defaultVisible && !isRedHerring` in already-unlocked sources. Unlock-chain fragments are included when needed. |

`UI min` is the operationally meaningful number — that is what a real
player can plausibly do given the current source pane.

---

## Conventions

- "fragment" = `EvidenceFragment`; the player marks fragments as закладки.
- "observation" = `ControlPattern`; the player never selects them
  directly, they become `strong` when supporting fragments are picked.
- Observation `strong` requires `support ≥ requiredEvidenceCount` **and**
  `strongCount ≥ 1`.
- Outcome eligible iff every `requiredPatternIds` is strong, no
  `forbiddenPatternIds` is strong, and the strong set has at least
  `minPatternConfirmedCount` patterns.
- "Protective" pattern detected by id-substring (`protective` /
  `reality`), as in
  [`src/investigation/resolutionModel.ts`](../src/investigation/resolutionModel.ts).
- The UI filter in `buildFragmentsBySource` hides fragments with
  `defaultVisible: false` **and** any fragment with `isRedHerring: true`,
  in addition to gating on unlocked sources.

---

## Case: `info-business-marathon` — «Марафон личной эффективности»

### Source inventory

- **12 materials** total: **6 initial**, **6 locked**.

| material | initial | reliability | notes |
|---|---|---|---|
| `s_landing` | yes | 60 | Лендинг марафона |
| `s_chat_open` | yes | 65 | Открытый чат «1-я волна» |
| `s_video_intro` | yes | 70 | Транскрипт вступительного эфира |
| `s_relative_msg` | yes | 75 | Сообщение от брата участницы |
| `s_public_comments` | yes | 50 | Комментарии под публичными эфирами |
| `s_calendar_plan` | yes | 70 | Расписание марафона |
| `s_testimony_ex` | no | — | unlocked by `e_landing_special_path` (initial) |
| `s_chat_closed` | no | — | unlocked by `e_chat_second_circle_hint` (initial) |
| `s_refund_thread` | no | — | unlocked by `e_chat_refund_hint` (initial) |
| `s_payment_memo` | no | — | unlocked by `e_ex_financial_pressure` (in locked `s_testimony_ex`) |
| `s_internal_checklist` | no | — | unlocked by `e_payment_pressure_script` (in locked `s_payment_memo`) |
| `s_curator_notes` | no | — | unlocked by `e_checklist_curator_handoff` (in locked `s_internal_checklist`) |

Three of the locked materials open directly from initial materials in
one click. The other three sit on a depth-3 chain
`s_landing → s_testimony_ex → s_payment_memo → s_internal_checklist → s_curator_notes`.
That is the longest unlock chain in the case.

### Fragment inventory

- **47 fragments** total. 45 default-visible, 2 default-hidden.
- **3 red herrings**: `e_landing_results` (defaultHidden), `e_video_general_promise` (defaultHidden), `e_comments_donor_endorsement` (defaultVisible). All three are filtered out of the dossier source pane (see Risks).
- **1 counter fragment**: `e_video_leader_humility` is the only entry in any `counterEvidenceIds` (counter for `p_leader_control`).
- **6 protective-context fragments**: linked to `p_protective_ties` / `p_reality_testing` via `strongEvidenceIds` / `weakEvidenceIds` / `suggestedPatternIds`.

### Observations (patterns)

| pattern | required | strong | weak | counter | UI min to strong | flags |
|---|---|---|---|---|---|---|
| `p_love_bombing` | 2 | 2 | 2 | 0 | 2 | |
| `p_isolation` | 2 | 4 | 4 | 0 | 2 | |
| `p_loaded_language` | 2 | 2 | 3 | 0 | 2 | |
| `p_financial_pressure` | 2 | 3 | 4 | 0 | 3 | needs 1 unlock |
| `p_confession` | 2 | 2 | 1 | 0 | 4 | needs 2 unlocks |
| `p_coercive_control` | 2 | 5 | 1 | 0 | 3 | needs 1 unlock |
| `p_dependency_loop` | 2 | 3 | 3 | 0 | 2 | |
| `p_information_control` | 2 | 3 | 5 | 0 | 2 | |
| `p_leader_control` | 2 | 2 | 1 | 1 | 2 | |
| `p_shame_induction` | 1 | 1 | 3 | 0 | 2 | needs 1 unlock |
| `p_protective_ties` | 1 | 2 | 1 | 0 | 1 | protective |
| `p_reality_testing` | 1 | 2 | 1 | 0 | 1 | protective |

- **First supported observation**: 1 fragment — pick `e_landing_new_circle` to push `p_love_bombing` to `supported`.
- **First strong observation**: 1 fragment — pick any strong protective fragment to push `p_protective_ties` or `p_reality_testing` to `strong` (these are the only `requiredEvidenceCount=1` strong-only patterns).

### Outcomes

| outcome | min strong | required | forbidden | UI min fragments | reachable |
|---|---|---|---|---|---|
| `ro_insufficient` | 0 | — | — | 0 | yes (fallback) |
| `ro_early_signal` | 1 | `p_loaded_language` | — | 2 | yes |
| `ro_warning` | 2 | `p_financial_pressure`, `p_information_control` | — | 5 | yes |
| `ro_protective_focus` | 2 | `p_protective_ties`, `p_reality_testing` | — | 2 | yes (protective focus) |
| `ro_system_proven` | 4 | `p_isolation`, `p_financial_pressure`, `p_coercive_control`, `p_leader_control` | — | 8 | yes (systemic) |
| `ro_misread` | 0 | — | `p_coercive_control`, `p_leader_control` | 0 | yes (fallback) |

`ro_system_proven` requires 8 selected fragments under UI rules, including
1–2 unlock-chain fragments because `p_coercive_control` and
`p_financial_pressure` strong fragments live on locked materials.

### Balance risks (info-business)

- **Red herrings are invisible in the source pane.** All 3 red herrings
  are filtered out by `buildFragmentsBySource`
  (`defaultVisible && !isRedHerring`). As a result:
  - the `шум` metric is always **0**;
  - the `Не поспешил` achievement (`a_no_rush`, "no red herrings selected")
    is **trivially earned** for every submission with ≥ 1 закладка;
  - the `ro_misread` outcome is reachable only by submitting nothing
    (or only protective fragments), not by being fooled.
- **Single counter fragment.** Only `e_video_leader_humility` is in any
  `counterEvidenceIds`. That makes the `осторожность` metric (which
  multiplies counter+protective selections) heavily skewed toward
  protective-only picks; counter-only paths are basically impossible.
- **`p_confession` needs depth-2 unlocks for UI min**: the strong
  fragments are `e_chat_closed_*` and `e_curator_notes_*`, which sit on
  `s_chat_closed` / `s_curator_notes`. A player skipping the closed-chat
  chain cannot reach `p_confession` strong.
- **`ro_system_proven` UI min = 8**: the highest-grade outcome demands
  ~17% of all fragments — feasible but heavy. Worth checking pacing.
- **`thresholds`** (`minConfirmedPatternsForStrongOutcome`,
  `maxContradictionsBeforeWeakOutcome`, `riskPersonsThreshold`) is in
  `report.json` and typed in `types.ts`, but nothing in
  `src/investigation/` reads it. Dead config.

---

## Case: `family-retreat-center` — «Семейный ретрит-центр»

### Source inventory

- **10 materials** total: **5 initial**, **5 locked**.

| material | initial | reliability | notes |
|---|---|---|---|
| `s_retreat_landing` | yes | 55 | Лендинг центра «Возвращение» |
| `s_welcome_email` | yes | 70 | Приветственное письмо новому участнику |
| `s_first_10_days` | yes | 75 | Расписание первых 10 дней программы |
| `s_partner_letter` | yes | 75 | Письмо партнёра участницы |
| `s_local_news` | yes | 65 | Заметка районной газеты |
| `s_group_chat` | no | — | unlocked by `e_welcome_quiet_period` (initial) |
| `s_diary_ekaterina` | no | — | unlocked by `e_partner_change` (initial) |
| `s_ex_testimony` | no | — | unlocked by `e_landing_special_path` (initial) |
| `s_payment_memo` | no | — | unlocked by `e_diary_money_anxiety` (locked `s_diary_ekaterina`) |
| `s_staff_note` | no | — | unlocked by `e_ex_unpaid_labor` (locked `s_ex_testimony`) |

Three locked sources are 1-hop from an initial source; two
(`s_payment_memo`, `s_staff_note`) need a 2-step chain.

### Fragment inventory

- **31 fragments** total. All default-visible.
- **1 red herring**: `e_news_neutral` on `s_local_news` (defaultVisible) — still hidden by the source pane filter (see Risks).
- **1 counter fragment**: `e_schedule_silent_walks` (counter for `p_no_pause_rhythm`).
- **6 protective-context fragments**.

### Observations (patterns)

| pattern | required | strong | weak | counter | UI min to strong | flags |
|---|---|---|---|---|---|---|
| `p_fast_family` | 2 | 2 | 2 | 0 | 2 | |
| `p_isolation` | 2 | 3 | 3 | 0 | 2 | |
| `p_no_pause_rhythm` | 2 | 2 | 1 | 1 | 2 | |
| `p_leader_authority` | 2 | 2 | 1 | 0 | 2 | |
| `p_financial_pressure` | 2 | 3 | 1 | 0 | 2 | |
| `p_labor_gratitude` | 2 | 2 | 1 | 0 | 3 | needs 1 unlock |
| `p_personal_before_group` | 2 | 2 | 1 | 0 | 3 | needs 1 unlock |
| `p_inside_language` | 2 | 1 | 2 | 0 | 3 | needs 1 unlock |
| `p_doubt_shame` | 1 | 1 | 1 | 0 | 3 | needs 2 unlocks |
| `p_protective_ties` | 1 | 2 | 1 | 0 | 1 | protective |
| `p_reality_testing` | 1 | 2 | 1 | 0 | 1 | protective |

- **First supported observation**: 1 fragment — `e_welcome_warm_intro` pushes `p_fast_family` to `supported`.
- **First strong observation**: 1 fragment — any strong protective fragment makes `p_protective_ties` or `p_reality_testing` `strong`.

### Outcomes

| outcome | min strong | required | forbidden | UI min fragments | reachable |
|---|---|---|---|---|---|
| `ro_too_early` | 0 | — | `p_isolation`, `p_financial_pressure`, `p_labor_gratitude`, `p_leader_authority` | 0 | yes (fallback) |
| `ro_early_signal` | 1 | `p_isolation` | — | 2 | yes |
| `ro_warning` | 2 | `p_isolation`, `p_financial_pressure` | — | 4 | yes |
| `ro_protective_focus` | 2 | `p_protective_ties`, `p_reality_testing` | — | 2 | yes (protective focus) |
| `ro_system_proven` | 4 | `p_isolation`, `p_leader_authority`, `p_financial_pressure`, `p_labor_gratitude` | — | 7 | yes (systemic) |

No `ro_misread`-style outcome exists in this case — the
forbidden-pattern role is filled by `ro_too_early`, which becomes
ineligible the moment any of the four major patterns is strong.

### Balance risks (family-retreat-center)

- **`ro_too_early` is asymmetric to info-business.** info-business has
  `ro_misread` (forbidden = leader/coercive). Family has `ro_too_early`
  (forbidden = isolation/financial/labor/leader). The "trap" outcome in
  family is harder to land in deliberately — you need to keep four
  patterns out of strong, not two.
- **Red herring `e_news_neutral` is hidden.** Same UI-filter issue as
  info-business; `шум` metric is structurally zero. With only 1 red
  herring in the case, the achievement loop is even thinner.
- **Single counter fragment.** `e_schedule_silent_walks` is the only
  counter; `осторожность` metric again leans almost entirely on
  protective picks.
- **`p_doubt_shame` UI-min = 3**: the only strong fragment
  (`e_staff_doubt_protocol`) lives on the deepest material chain
  (`s_retreat_landing → s_ex_testimony → s_staff_note`). It is reachable
  but only if the player follows that specific chain — easy to miss.
- **`p_inside_language` has only 1 strong fragment** (`e_chat_argot`)
  with `requiredEvidenceCount=2`. The pattern can still reach strong
  (1 strong + 1 weak ≥ 2 support, strong ≥ 1) but every path to strong
  requires picking the weak in `s_group_chat`. Tight.

---

## Cross-case risks

These risks are structural and apply to both cases:

1. **Red herrings are dead content** — they exist in JSON and are
   surfaced in the resolution panel's "что было шумом" section as
   per `resolutionModel.ts`, but the player never sees them in the
   source pane, so `noiseFragments` is always empty and
   `noise / шум` metric is always 0. Either:
   - drop the `isRedHerring` filter from `buildFragmentsBySource`, or
   - drop the red-herring fragments entirely until a balance pass lands.
2. **`thresholds` in `report.json` is unused** — every case author has
   to keep three integers in sync that no runtime path reads. Either
   wire them into `interactionModel.ts` (replace hardcoded eligibility)
   or remove them from the JSON + types.
3. **Protective observations are cheaper than risk observations** —
   `p_protective_ties` and `p_reality_testing` are
   `requiredEvidenceCount = 1` with multiple strong fragments in
   initial sources, so a player gets a protective observation strong on
   the first click. That makes `ro_protective_focus` (UI-min=2) the
   cheapest non-fallback outcome in both cases, beating
   `ro_early_signal` (UI-min=2 in family, 2 in info — tied) only by tone,
   not by cost. Worth confirming this is intentional.
4. **No outcome distinguishes "honest mistake" from "manipulation"** —
   `ro_misread` / `ro_too_early` both require zero strong of certain
   patterns. There is no outcome that fires when the player has strong
   protective + strong risk patterns simultaneously, so a "mixed
   picture" reading lands in `ro_warning` / `ro_system_proven` with no
   special framing.

---

## How to regenerate

```bash
npm run validate:investigation  # confirm JSON shape
npm run audit:balance           # raw numeric report
```

Re-run after any change to `src/game/cases/*/*.json`. The audit script
is intentionally read-only and produces no diffs in the repo.
