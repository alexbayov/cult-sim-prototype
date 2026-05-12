# Cult Sim Prototype

Браузерная investigation/dossier-игра: игрок читает источники, ставит закладки на фрагменты, собирает сводку и получает разбор (outcome + наблюдения + achievements).

Стартовые кейсы: «Марафон личной эффективности» (`info-business-marathon`) и «Семейный ретрит-центр» (`family-retreat-center`).

## Что уже есть

- React + TypeScript + Vite.
- Два полных кейса-расследования в `src/game/cases/<case-id>/`: `case.json`, `persons.json`, `sources.json`, `evidence.json`, `patterns.json`, `report.json`, `debrief.json`.
- Dossier UI (`src/investigation/`): экран выбора кейса, трёхколоночный dossier (люди / материалы / ключевые наблюдения), закладки с разблоком источников, прогресс-чипы, сборка сводки, экран разбора с метриками и achievements.
- Персистентный прогресс в `localStorage`: статусы хода по кейсам («НАЧАТ» / «ЗАВЕРШЁН») и заработанные achievements по кейсу.
- Yandex Games SDK adapter в `src/platform/yandex.ts` (stub-режим по умолчанию, iframe-режим под флагом в `index.html` — см. `docs/YANDEX_INTEGRATION.md`).
- Оффлайн-валидатор контента, баланс-аудит и visible-language guard — всё как npm-скрипты (см. ниже).

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

Перед каждым PR обязательно прогонять:

```bash
npm run validate:investigation
npm run lint
npm run build
npm run audit:balance
npm run audit:visible-language
```

`validate:investigation` — node-скрипт, который проверяет content для investigation-кейсов (`src/game/cases/<case-id>/*.json`):

- **errors (exit 1)** — структурные проблемы: дубликаты id, висячие ссылки, выход из числовых диапазонов, debrief с неизвестным evidence id.
- **warnings (exit 0)** — content-design сигналы: недоступные источники, пустые источники, orphan-паттерны, отсутствие debrief на паттерн, отсутствие low/medium/strong report outcome, регрессия видимой лексики (deny-list терминов в коротких видимых полях — см. `scripts/lib/visible-language.mjs`).

`audit:balance` и `audit:visible-language` — отдельные информационные прогоны (всегда exit 0), которые выводят сводку по балансным рискам и по языковым регрессиям без прочей валидации. Языковые предупреждения намеренно не валят валидатор — они ловят регрессию, не блокируя контент-итерации. Подробнее — в [docs/CONTENT_MODEL.md](docs/CONTENT_MODEL.md).

Перед внешним демо/плейтестом прогоните всё выше + ~10-минутный ручной smoke по [docs/DEMO_QA_CHECKLIST.md](docs/DEMO_QA_CHECKLIST.md).

## Архитектура

```txt
src/game/investigation/    # runtime-типы, schema-валидатор и сборка кейсов из JSON
  types.ts
  contentSchema.ts
  data.ts
src/game/cases/            # JSON-контент кейсов (case.json, persons.json, sources.json,
  info-business-marathon/  # evidence.json, patterns.json, report.json, debrief.json
  family-retreat-center/   # на каждый кейс)
src/game/seasons/          # сезонная оболочка и порядок кейсов
src/game/types.ts          # общие типы runtime-слоя
src/investigation/         # dossier UI: CaseSelectScreen, DossierApp, ProgressNudge,
                           # OnboardingGuide, view-model, resolution model, persistence
src/platform/yandex.ts     # Yandex Games SDK adapter (stub по умолчанию)
src/App.tsx                # роутинг picker ↔ dossier; инициализация Yandex SDK
src/index.css              # визуальный слой
scripts/                   # validate-investigation, audit-investigation-balance,
                           # audit-visible-language, lib/visible-language
```

Контент кейсов живёт в JSON внутри `src/game/cases/<case-id>/` — добавление нового кейса сводится к созданию новой папки и экспорту из `src/game/investigation/data.ts`.

## Studio docs

Рабочие документы проекта:

- [Roadmap](docs/ROADMAP.md) — путь от прототипа до Яндекс Игр и дальше.
- [Backlog](docs/BACKLOG.md) — ближайшие задачи и приоритеты.
- [Agent brief](docs/AGENT_BRIEF.md) — что должен помнить следующий агент.
- [Metrics](docs/METRICS.md) — игровые, продуктовые и контентные метрики.
- [Content model](docs/CONTENT_MODEL.md) — модель кейса-расследования: persons / sources / evidence / patterns / report / debrief.
- [Art direction](docs/ART_DIRECTION.md) — визуальный стиль, ассеты и prompt-шаблоны.
- [Orchestration](docs/ORCHESTRATION.md) — как вести проект через дирижёра и параллельных Devin-девов.
- [Conductor handoff](docs/CONDUCTOR_HANDOFF.md) — текущий контекст, стратегия и brief-правила для параллельных Devin-девов.
- [Product decisions](docs/PRODUCT_DECISIONS.md) — живой список нерешённых продуктовых вопросов и текущие рекомендации.
- [Demo QA checklist](docs/DEMO_QA_CHECKLIST.md) — ~10-минутный ручной smoke перед демо/плейтестом.
- [Yandex integration](docs/YANDEX_INTEGRATION.md) — SDK-adapter, iframe-режим, smoke-сценарии.

Рабочие таблицы:

- [Card balance](docs/tables/card_balance.csv)
- [Participant matrix](docs/tables/participant_matrix.csv)
- [Combo rules](docs/tables/combo_rules.csv)
- [Finale matrix](docs/tables/finale_matrix.csv)
- [Analytics events](docs/tables/analytics_events.csv)
- [Asset manifest](docs/tables/asset_manifest.csv)

## Ближайший фокус

Не прыгать сразу в продакшен и сторы. Текущий план — в [docs/ROADMAP.md](docs/ROADMAP.md): Wave 0–1 — vertical slice + второй кейс + scaffolding (готово), Wave 2 — clarity-pass, achievements-persist, чистка (в работе), Wave 3 — Yandex iframe сборка и контент-доработки, потом публикация на Яндекс Играх, и только после web/Yandex — Google Play / iOS.
