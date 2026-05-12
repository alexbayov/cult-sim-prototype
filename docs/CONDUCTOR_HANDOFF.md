# Conductor handoff

Этот документ — единая точка входа для следующей Devin-сессии или для режима «дирижёр + параллельные девы». Цель — дать свежему ридеру правильную текущую картину проекта без археологии.

## Коротко

Проект — **браузерная investigation/dossier-игра**. Игрок читает источники, ставит закладки на фрагменты, собирает сводку и получает разбор. Карточный прототип, на котором проект стартовал, удалён в PR #33 — build от старой модели не зависит.

Первый кейс расследования: **«Марафон личной эффективности»** (`info-business-marathon`). Второй кейс: **«Семейный ретрит-центр»** (`family-retreat-center`).

Полная история по волнам и текущее состояние — в `docs/ROADMAP.md`. Открытые продуктовые вопросы и текущие рекомендации — в `docs/PRODUCT_DECISIONS.md`. Перед демо — `docs/DEMO_QA_CHECKLIST.md`.

## Текущая структура кода

```txt
src/game/investigation/   # types.ts, contentSchema.ts, data.ts
src/game/cases/           # JSON-контент:
  info-business-marathon/   case.json, persons.json, sources.json,
  family-retreat-center/    evidence.json, patterns.json, report.json, debrief.json
src/game/seasons/         # season-01.json — сезонная оболочка
src/game/types.ts         # общие runtime-типы

src/investigation/        # dossier UI
  CaseSelectScreen.tsx, DossierApp.tsx, OnboardingGuide.tsx, ProgressNudge.tsx,
  interactionModel.ts, investigationViewModel.ts, resolutionModel.ts, useInvestigationState.ts,
  achievementsStorage.ts, progressStorage.ts, dossier.css

src/platform/yandex.ts    # Yandex Games SDK adapter (stub-режим по умолчанию)
src/App.tsx               # роутинг picker ↔ dossier; init Yandex SDK
src/main.tsx, src/index.css

scripts/
  validate-investigation.mjs        # node-валидатор контента
  audit-investigation-balance.mjs   # балансный аудит
  audit-visible-language.mjs        # visible-language guard (standalone CLI)
  smoke-interaction-model.mjs       # smoke по interaction-модели
  lib/visible-language.mjs          # shared deny-list + scan helper
```

## Команды

```bash
npm install
npm run dev
npm run build
npm run lint
npm run validate:investigation
npm run audit:balance
npm run audit:visible-language
```

Перед каждым PR обязательно прогонять (полный набор):

```bash
npm run validate:investigation
npm run lint
npm run build
npm run audit:balance
npm run audit:visible-language
```

`validate:investigation` разделяет проверки на **errors** (валятся, exit 1: дубликаты id, висячие ссылки, выход из диапазонов, debrief с неизвестным evidence) и **warnings** (не валятся, exit 0: недоступные источники, пустые источники, orphan-паттерны, отсутствие debrief для паттерна, отсутствие low/medium/strong outcome, регрессия видимой лексики — см. deny-list в `scripts/lib/visible-language.mjs`).

`audit:balance` и `audit:visible-language` — информационные прогоны, всегда exit 0. Подробнее — в `docs/CONTENT_MODEL.md`.

## Текущий стек

- React
- TypeScript
- Vite
- JSON-контент (внутри репозитория)
- localStorage save (progress + achievements per case)
- Yandex Games SDK adapter — stub по умолчанию, iframe-режим — под комментированным `<script>` в `index.html` и фичефлагом; см. `docs/YANDEX_INTEGRATION.md`
- backend нет

Репозиторий: `https://github.com/alexbayov/cult-sim-prototype`.

## Контекст беседы (что мы делаем и чего не делаем)

Мы делаем браузерную игру/расследование о том, как обычные группы могут постепенно становиться деструктивными системами. Камерная модель, без глобальной карты распространения, без инструкции по созданию секты, без морализаторской лекции — игрок видит источники и связи, и сам собирает картину.

Ключевые решения:

1. Игрок видит persons, sources, evidence fragments, patterns; собственными закладками собирает сводку.
2. Видимый текст карт/материалов нейтрально-правдоподобный; «первичная» терминология (`улика`, `доказательство`, `ДЕЛО`, `ДОСЬЕ`, `материалы дела`, `секта`, `love bombing`, `coercive control`, `gaslighting`, `газлайтинг`, «красн… сел…», `паттерн` в коротких видимых полях) ловится visible-language валидатором — см. `scripts/lib/visible-language.mjs`.
3. Опасность возникает не от одного фрагмента, а от связки — это считается через `ControlPattern` и `strongEvidenceIds / weakEvidenceIds / counterEvidenceIds`.
4. Финальный outcome зависит от состава confirmed patterns и thresholds в `report.json`. После сводки игрок видит «профиль работы» с метриками, четырьмя диагностическими панелями и achievements.
5. Прогресс и achievements персистятся в `localStorage` (per case). Двукратная пересдача того же кейса — допустима; achievements не сбрасываются автоматически.

Важная формулировка от пользователя:

> не формулировать прямо «лидер всегда прав»; внешняя семантика должна быть мягче, но смысл должен считаться системой.

Также:

- игра может разбирать радикализацию и вербовку, но без инструктивных деталей;
- игра не должна прямо говорить «это плохо»;
- разные исходы — включая мрачно-успешные — допустимы;
- проект ведём как маленькую полноценную game studio.

## Roadmap-ориентир по волнам

См. `docs/ROADMAP.md` для актуального состояния и `docs/PRODUCT_DECISIONS.md` для нерешённых продуктовых вопросов и текущих рекомендаций. Коротко:

- **Wave 0 / 0.5** — vertical slice + второй кейс + reset-with-confirm (закрыто).
- **Wave 1** — depth helpers, season shell + progress persist, Yandex adapter stub, visible-language validator, product decisions doc, mobile polish (закрыто).
- **Wave 2** — resolution clarity, achievements persist, report.thresholds optional, vestigial cleanup + demo QA checklist + roadmap refresh, docs editorial (в работе).
- **Wave 3** — Yandex iframe build + smoke, контент-доработки и UI-следы открытых продуктовых решений (см. PRODUCT_DECISIONS).

## Главная стратегия публикации

Порядок:

1. Web vertical slice → готово.
2. Контент и баланс → второй кейс готов; третий — отдельной волной.
3. Mobile-first layout → выполнено (390×844 cmd-line чеки в `docs/DEMO_QA_CHECKLIST.md`).
4. Yandex Games SDK → adapter готов как stub; iframe build — Wave 3.
5. Public MVP на Яндекс Играх.
6. Только потом Google Play / iOS.

Яндекс Игры принимает web build. Текущий React/Vite проект уже естественно собирается в static HTML/CSS/JS. Поэтому Unity/Godot перенос пока не нужен.

## Orchestration mode

Используем для параллельных Devin-сессий и экономии контекста. Текущая модель — «дирижёр + параллельные девы»:

- дирижёр пишет briefs и ревьюит PR;
- девы получают brief в виде `dev*-brief.md` и работают на отдельной ветке `devin/<тема>`;
- ветки нельзя ронять друг на друга — каждый brief получает явный список «MUST NOT touch» и «MAY touch».

Подробнее — в `docs/ORCHESTRATION.md`.

### Правила brief-заготовок (swap-friendly)

Каждый brief должен включать:

- цель и объём (одной фразой);
- список «MAY touch» и «MUST NOT touch»;
- pre/post acceptance checklist;
- какие команды прогнать (`validate:investigation`, `lint`, `build`, `audit:balance`, `audit:visible-language`);
- PR description template — чтобы дев мог собрать PR body без дополнительного контекста.

Если brief короткий и не имеет «MUST NOT touch» — считать его недописанным, не запускать.

## Текущие риски

1. Git push через стандартный Devin proxy раньше падал с 403; сейчас работаем через PAT `GITHUB_PAT_CULT_SIM_PROTOTYPE` (org-scope, прямой `https://github.com/...` URL). PR создаём через REST API + `git_pr action=take_over`. Документ knowledge об этом сохранён.
2. CI отсутствует — нет `.github/workflows/`. Все чеки прогоняются локально перед PR.
3. visible-language валидатор сейчас даёт 5 warnings на main; контент намеренно не правится в каждом ширинном PR — отдельные content-only PR по мере необходимости. См. `docs/PRODUCT_DECISIONS.md` §1 (red-herring filter) и §3 (achievements UI).
4. Yandex iframe — пока stub; реальный SDK-режим включается под флагом, продакшен-сборка — Wave 3.

## Что делать дальше

1. Прочитать `docs/ROADMAP.md` (текущая волна и что висит).
2. Прочитать `docs/PRODUCT_DECISIONS.md` (что открыто, какие рекомендации).
3. Прочитать `docs/DEMO_QA_CHECKLIST.md` (что должно работать перед демо).
4. Запросить brief у дирижёра или взять следующий из списка Wave 2/3 (см. ROADMAP).
