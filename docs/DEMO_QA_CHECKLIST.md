# Demo QA Checklist

Pre-demo smoke a human can complete in ~10 minutes. Tick each item; if any fails, the demo is not ready.

## Environment

- [ ] `npm install` clean (no audit warnings of "high"/"critical" severity).
- [ ] `npm run validate:investigation` — exit 0, no errors.
- [ ] `npm run build` — exit 0.
- [ ] `npm run lint` — 0 errors.
- [ ] `npm run audit:balance` — only the known red-herring filter risk; no new entries.
- [ ] `npm run audit:visible-language` — list current warnings (5 expected after PR #28); no NEW ones since main.

## Desktop (≥1280 wide)

Case picker:
- [ ] Eyebrow «МАТЕРИАЛЫ РАССЛЕДОВАНИЯ», season-band «СЕЗОН 01 · …», subtitle visible.
- [ ] Both cases shown in season order (`info-business-marathon` first).
- [ ] Each card shows: title, metadata row (N материалов / N фрагментов / N наблюдений / N людей), public legend.
- [ ] Onboarding overlay opens on first visit; «как это работает» link reopens it.

Dossier (`info-business-marathon`):
- [ ] Back button «← К выбору материалов» is visible and clickable.
- [ ] Прогресс-чипы row reads correctly (материалов / фрагментов / наблюдений / людей).
- [ ] Three-column layout: ЛЮДИ | МАТЕРИАЛ | КЛЮЧЕВЫЕ НАБЛЮДЕНИЯ.
- [ ] Placing a bookmark → fragment shows «связано с: …» (depth helper from PR #29).
- [ ] Bookmark that unlocks a material → «открыт закладкой: …» note appears in the unlocked material header.
- [ ] Transient «добавлена закладка · обновились наблюдения …» строка appears under progress chips and fades.
- [ ] Reset → two-step confirmation; after confirm, dossier returns to a fresh state.
- [ ] Submit сводка → разбор / «профиль работы» panel shows, metrics + 4-card grid + achievements render.

## Mobile 390×844 (use Chrome devtools)

- [ ] `document.documentElement.scrollWidth === clientWidth` (no horizontal overflow).
- [ ] Tap-targets ≥ 38px: source tabs, fragment-mark, evidence-remove, back button.
- [ ] `.dossier-source .dossier-card-head` strip wraps below h2 (no overlap).
- [ ] `.dossier-person-head` risk-badge wraps to its own row on narrow viewports.
- [ ] Outcomes summary `<details>` opens correctly.
- [ ] Reset-confirm action row wraps.

## Persistence

- [ ] Submit сводка for one case → reload → that case's card shows the «ЗАВЕРШЁН» chip.
- [ ] Open the dossier for the second case → return to picker without submit → that card shows «НАЧАТ» chip.
- [ ] Clear `localStorage` → all chips disappear, picker returns to fresh.

## Forbidden language sanity

- [ ] No visible occurrence of `улика`, `доказательство`, `паттерн`, `ДЕЛО`, `ДОСЬЕ`, `материалы дела`, `секта`, `love bombing`, `coercive control`, `газлайтинг`, «красн… сел…» in any rendered UI string. (Dev-comments inside `.ts` files are fine and do not count.)
- [ ] No console errors / unhandled rejections during a full play of either case.

## Yandex iframe (optional, Wave 3 prep)

- [ ] In `index.html`, the `<script src="https://yandex.ru/games/sdk/v2"></script>` line is **commented out** on main (it should only be uncommented in iframe builds).
- [ ] `initYandex()` is wired in `src/App.tsx` (no error in stub mode — see `docs/YANDEX_INTEGRATION.md`).
