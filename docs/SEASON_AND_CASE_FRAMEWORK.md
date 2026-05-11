# Season and case framework

> **Status:** production framework for future investigation content (seasons + cases).
>
> This document does **not** change runtime behavior. It defines the
> vocabulary, content recipes, and ethical rules for adding new
> investigation content. It builds on top of the live investigation model
> documented in `CONTENT_MODEL.md` and the language tone rules established
> in PR #14.

## 1. Vocabulary

| Term | Meaning |
|---|---|
| **Season** | Thematic cluster of cases sharing a domain, register, and learning goals (e.g. self-development, wellness, online communities). One season groups 3–6 cases. |
| **Episode / Case** | One investigation. A single playable unit: a `case.json` plus its `persons / sources / evidence / patterns / report / debrief` JSONs under `src/game/cases/<case-id>/`. "Episode" and "case" are interchangeable in player-facing copy. |
| **Materials** (`материалы`) | The player-facing word for "one case folder". Replaces `ДЕЛО / ДОСЬЕ`. See `CONTENT_MODEL.md` §"Language regression". |
| **Observation** (`наблюдение`) | Player-facing word for a control pattern. Replaces `паттерн` in visible UI. Internal ids stay technical (`p_love_bombing`, etc.). |
| **Fragment** (`фрагмент`) / **bookmark** (`закладка`) | Player-facing words for an evidence piece and for the act of saving one. Replaces `улика / доказательство`. |
| **Summary** (`сводка`) | Player-facing word for the final report. Replaces `отчёт` where possible. |
| **Pattern** (internal) | Engineering term for `ControlPattern` (an `id`-keyed entity in `patterns.json`). Only appears in code, schemas, ids, and developer docs. |

> Internal ids are explicitly allowed to keep technical names
> (`p_love_bombing`, `p_coercive_control`, `loaded_language`, …) — see
> `CONTENT_MODEL.md` §"Language regression". The language rules apply to
> **visible gameplay strings**, not to ids or to documentation.

## 2. Case design recipe

A "good" case for this game has roughly the shape below. Numbers are
recommendations; the validator (`npm run validate:investigation`) is the
authoritative gate for hard structural rules.

### 2.1 Size

| Entity | Target range | Notes |
|---|---|---|
| `persons` | 6–8 | At least one leader, one ex-member, one relative/external tie. |
| `sources` | 8–12 | Mix of public + closed; see §2.2. |
| Source fragments (total across all sources) | 30–50 | Each source: 2–6 fragments. |
| `evidence` (fragments marked as relevant) | 20–30 | Includes at least one red herring and at least one counter-fragment. |
| `patterns` | 10–14 | Includes at least 2 protective patterns. |
| `report.outcomes` | 4–6 | Includes low, medium, strong, and at least one "misread" outcome. |
| `debrief` | 10–14 | One per pattern is the default; expert terms allowed here as secondary context. |

### 2.2 Required source mix

Each case should include **at least one of each** of the following source
flavors, so the player has to triangulate rather than reading one
declarative document:

- **public surface**: landing page / public video / social post / press
  release — what the group *says about itself*;
- **closed peer space**: internal chat / closed group / paid tier
  document — what the group *says inside*;
- **financial trail**: payment receipt / pricing tier / payout
  agreement — what the group *charges*;
- **first-person testimony**: ex-member interview / diary entry — what
  it *feels like from inside* (medium reliability);
- **external observer**: relative / friend / specialist — what the
  *outside* sees;
- **counter-source**: at least one source containing material that
  *complicates* the simple "this is a control group" reading (e.g. an
  honest moment from the leader, a healthy boundary visible inside the
  community).

Source `reliability` levels (`low | medium | high`) must be set
honestly: testimony is usually `medium`, financial documents `high`,
public marketing copy `medium`, anonymous tip `low`. Don't make every
source `high` — players need ambiguity to practice.

### 2.3 Required ambiguity mix

Among `evidence` fragments, target **at least**:

- 20% **neutral / helpful** fragments — content that, in isolation,
  looks like normal behavior (a kind welcome, a real refund, an honest
  doubt from the leader). Authored as `defaultVisible` but with low
  `weight` and no `suggestedPatternIds`, or as `isRedHerring: true`.
- 1 **red herring** that *looks* incriminating to a careless reader but
  doesn't support any control pattern (e.g. a marketing claim, a
  generic motivational quote). Marked `isRedHerring: true`.
- 1 **protective tie** fragment — at least one piece of evidence that
  supports a *protective* pattern (`p_protective_ties`,
  `p_reality_testing`, etc.).
- 1 **contradiction / counter-fragment** — at least one fragment
  registered on a pattern's `counterEvidenceIds`, so confirming that
  pattern is not a one-sided checklist.
- 2 **unlock chains** — at least two evidence fragments with
  `unlocksSourceIds` pointing to a source that is *not* in
  `case.initialSourceIds`. This forces the player to read carefully to
  open new material.

### 2.4 Outcome shape

`report.outcomes` should always include at least:

- one **low** outcome (`minPatternConfirmedCount === 0`) — "too early
  to publish";
- one **medium** outcome — "real concern, not a system yet";
- one **strong** outcome (`minPatternConfirmedCount >= 4`) — "system
  picture is visible";
- one **misread** outcome — fires when the player relies on
  red-herrings or builds on `forbiddenPatternIds`.

The validator warns if any of these classes is missing.

## 3. Language rules

> Authoritative reference: `CONTENT_MODEL.md` §"Language regression".

Short version, for case authors:

- **Visible gameplay strings** use neutral, observational Russian:
  `материалы`, `фрагмент`, `закладка`, `наблюдение`, `связь`, `сводка`,
  `сигнал риска`. Avoid `улика / доказательство / ДЕЛО / ДОСЬЕ / паттерн`
  as a primary noun.
- **Pattern titles** describe behavior, not diagnoses: prefer
  `сужение внешних связей` over `Изоляция`, `тихое давление` over
  `Принудительный контроль`, `резкое сближение` over `Лав-бомбинг`.
- **Expert vocabulary** (`love bombing`, `coercive control`,
  `gaslighting`, `газлайтинг`, "секта", "контроль сознания") is allowed
  in:
  - internal ids (`p_love_bombing`, etc.);
  - `debrief.term` and `debrief.longExplanation`, where the goal is
    educational — always as a *secondary* gloss, e.g.
    `"Сужение внешних связей (isolation)"`;
  - developer docs and code comments.
- The validator emits a `language regression` warning if a banned term
  leaks into a visible gameplay field. Warnings don't block CI, but
  case authors should clear them before opening a PR.

## 4. Real-case adaptation rules

> **Inspired by real patterns, not direct accusations.**

This game uses *composite fictional* cases that draw on publicly
documented patterns of control. The goal is education and recognition,
not exposure of any specific group or person.

When designing a case inspired by real-world reporting, observe **all**
of the following rules:

- **No real active organization names.** Do not use the name of any
  currently operating group, business, retreat, school, network, party,
  or movement, including obvious near-misses or transliterations.
- **No real private people.** No real surnames, real handles, real
  photographs, real biographical detail traceable to an identifiable
  living person. This includes leaders, ex-members, journalists, and
  family members.
- **No direct timeline copy.** Do not lift dates, sequences of events,
  or quoted statements from a specific reported case. Paraphrase
  *mechanisms*, not events.
- **Combine several public patterns into composite fiction.** A single
  case should braid together mechanisms observed across multiple
  unrelated public reports. The composite must not be reducible to "the
  X group with the serial numbers filed off".
- **Change geography, names, dates, channels.** Pick a fictional city,
  fictional surnames, fictional platforms ("закрытый чат", not a real
  platform's branded community feature), fictional time windows.
- **Avoid claims that could identify a specific group.** Avoid
  references to identifying rituals, signature phrases, distinctive
  pricing tiers, or branded language unique to one organization.
- **Keep mechanisms educational, not defamatory.** Frame everything as
  "this is what the *mechanism* looks like" rather than "this is what
  *they* did". Outcomes should never read as a verdict on a specific
  real org.
- **Source notes stay outside the game.** If an author wants to track
  which reports inspired which mechanism, those notes live in private
  author files, *never* in `src/game/cases/...`, `docs/`, or the PR
  description.

Cases that cannot satisfy these rules without becoming about a specific
group should be redesigned or dropped.

## 5. Season metadata

A season is described by a small JSON manifest. **No runtime export is
required yet.** The manifest is content metadata — the dossier UI does
not yet need to know about seasons. Adding a runtime import path is a
future task and should only happen when there's a concrete UI consumer.

### Shape

```ts
type SeasonManifest = {
  id: string
  title: string
  subtitle: string
  caseIds: string[]
  themeTags: string[]
  learningGoals: string[]
}
```

- `id`: stable kebab-case slug, e.g. `season-01`.
- `title`: short player-facing season title, in neutral language.
- `subtitle`: one-line framing of the season's domain.
- `caseIds`: ids of `InvestigationCase` entries that belong to this
  season. Must match existing `case.id` values; the validator should
  warn (not error) on unknown ids if/when runtime wiring is added.
- `themeTags`: free-form domain tags, intersection of the cases'
  `themeTags`.
- `learningGoals`: 3–6 short Russian-language statements of what a
  player who completes the season should be able to recognize.

### File location

```txt
src/game/seasons/<season-id>.json
```

Only one season manifest exists today: `src/game/seasons/season-01.json`,
covering the two seed cases (`info-business-marathon`,
`family-retreat-center`). The file is shipped for future use; nothing
imports it at runtime yet.

## 6. Case design checklist

Copy this checklist into the PR description when adding a new case.

```txt
Structure
- [ ] 6–8 persons (incl. leader, ex-member, external tie)
- [ ] 8–12 sources (incl. public, closed, financial, testimony, external, counter)
- [ ] 30–50 source fragments
- [ ] 20–30 evidence fragments
- [ ] 10–14 patterns (incl. ≥2 protective patterns)
- [ ] 4–6 report outcomes (incl. low / medium / strong / misread)
- [ ] 10–14 debrief entries

Ambiguity
- [ ] ≥20% neutral / helpful fragments
- [ ] ≥1 red herring (isRedHerring: true)
- [ ] ≥1 protective-tie fragment
- [ ] ≥1 contradiction / counter-fragment registered on counterEvidenceIds
- [ ] ≥2 unlock chains via evidence.unlocksSourceIds

Language
- [ ] Visible titles / descriptions use neutral observational Russian
- [ ] No primary use of улика / доказательство / ДЕЛО / ДОСЬЕ / паттерн in visible UI
- [ ] No English expert names (love bombing, coercive control, …) as primary labels
- [ ] Expert terms only in debrief.term / debrief.longExplanation as secondary gloss

Ethics
- [ ] No real active organization names
- [ ] No real private people
- [ ] No direct timeline copy
- [ ] Composite fiction; combines patterns from multiple unrelated public reports
- [ ] Fictional geography / names / dates / channels
- [ ] Mechanisms described, not "they did X"
- [ ] Source / inspiration notes kept outside the repo

Validation
- [ ] npm run validate:investigation passes with zero errors
- [ ] Language-regression warnings reviewed and cleared
- [ ] npm run build passes
- [ ] npm run lint passes
```

## 7. Future mechanics backlog

> **Documented but not implemented.** Each item here is a future PR
> candidate. None of them is required for the current dossier UI to
> work.

- **Achievements / titles.** Player-facing acknowledgments for
  observed practices ("noticed a protective tie before confirming a
  control pattern", "submitted a low outcome instead of overclaiming").
  Surfaced in the debrief screen, not as combat-game achievements.
- **Methods / investigation tools.** Named techniques the player
  unlocks across cases: cross-reference, follow-the-money,
  external-tie check, language audit. Each method is a small
  affordance on the dossier UI, not a new screen.
- **Mentor hints.** Optional, opt-in nudges from an off-screen
  "mentor" character when the player has been stuck on the same
  source for too long. Must be skippable and never spoil a pattern.
- **Timeline compare.** Side-by-side view comparing what was visible
  publicly vs. what was happening in closed sources at the same time
  window.
- **Person map.** Graph view of `persons` connected by shared sources
  and shared patterns, to make the social structure of a group
  legible.
- **Contradiction scanner.** UI that surfaces evidence pairs where one
  is on `strongEvidenceIds` and the other on `counterEvidenceIds` of
  the same pattern, so the player has to weigh them explicitly.
- **Source reliability overlay.** Visual treatment in the source
  viewer that reflects `source.reliability`, so the player implicitly
  learns to weight materials.
- **Season finale case.** A larger, integrative case at the end of a
  season that requires recognizing patterns *across* the season's
  earlier cases (e.g. a leader who showed up under a different name in
  an earlier case).

When picking up any backlog item, open a separate brief: most of these
are content-design questions before they are UI questions.

## 8. Cross-references

- `docs/CONTENT_MODEL.md` — authoritative description of the
  investigation content model and the validator.
- `docs/CONDUCTOR_HANDOFF.md` — orchestration notes; this framework is
  the input for future Dev L-style content-architecture briefs.
- `docs/EVIDENCE_INTERACTION_PLAN.md` — gameplay-level interaction
  spec; this framework deliberately does not duplicate it.
- PR #14 — language / tone pass that established the visible-vocabulary
  rules referenced in §3.
