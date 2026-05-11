# Conductor handoff

Этот документ — единая точка входа для следующей Devin-сессии или для режима «дирижёр + параллельные девы».

## Коротко

> **Pivot:** проект уходит от карточного симулятора секты к **cult investigation / dossier game** (см. fullbody-концепт). Старая карточная модель пока остаётся как legacy, но новые фичи строятся на investigation-модели.

Первый кейс расследования: **«Марафон личной эффективности»**.

## Investigation pivot — текущее состояние

- Контент-модель расследования (case → persons → sources → evidence → patterns → report → debrief) реализована в `src/game/investigation/` + `src/game/cases/info-business-marathon/`. См. подробности в `docs/CONTENT_MODEL.md` (раздел «Investigation content»).
- Старый карточный сценарий (`src/game/scenarios/info-business-marathon/`) и `App.tsx` пока не трогаем — они остаются как legacy/prototype, чтобы build не падал.
- PR #8 (валидатор) и PR #9 (finale/debrief) старой модели **не мерджим**: идеи валидации и debrief перенесены в investigation-модель.

## Что есть в коде после investigation-PR

```txt
src/game/investigation/types.ts          # InvestigationCase, CasePerson, CaseSource, EvidenceFragment, ControlPattern, ReportContent, DebriefEntry, ...
src/game/investigation/contentSchema.ts  # validateInvestigationContent + assertValidInvestigationContent
src/game/investigation/data.ts           # сборка кейса + лог валидации при импорте
src/game/cases/info-business-marathon/   # case.json, persons.json, sources.json, evidence.json, patterns.json, report.json, debrief.json
scripts/validate-investigation.mjs       # node-runner валидатора (без React/Vite)
```

Команды:

```bash
npm run validate:investigation   # структурная проверка + content-design warnings
npm run build                    # tsc -b + vite build
npm run lint
```

`validate:investigation` разделяет проверки на **errors** (валятся, exit 1: дубликаты id, висячие ссылки, выход из диапазонов, debrief с неизвестным evidence) и **warnings** (не валятся, exit 0: недоступные источники, пустые источники, orphan-паттерны, отсутствие debrief для паттерна, отсутствие low/medium/strong outcome, регрессия видимой лексики — `улика`, `доказательство`, `ДЕЛО`, `ДОСЬЕ`, `секта`, `love bombing`, `coercive control`, `gaslighting`, `газлайтинг`, `паттерн` в кратких видимых полях).

Подробнее — в `docs/CONTENT_MODEL.md` (раздел про validate:investigation).

## Следующие шаги после investigation-pivot

1. **Dev B (dossier UI shell)** — заменить `App.tsx` на dossier-layout: source viewer, evidence tray, persons board, pattern board, timeline, final report. Использовать `infoBusinessMarathonInvestigation` из `src/game/investigation/data.ts`. UI должен корректно работать на 390×844.
2. **Dev C (evidence/report loop)** — реализовать механику отметки фрагментов как evidence, привязки к persons/patterns, разблокировки источников и сборки финального report. Использовать thresholds из `report.json`.
3. **Legacy retire** — после того как dossier-UI заменит карточный, удалить `src/game/scenarios/...` и старый `src/App.tsx`/`engine.ts`. До этого не трогаем.

## Что НЕ делать в investigation-PR (Dev A scope)

- Не переписывать `App.tsx` под dossier.
- Не удалять `src/game/scenarios/...` и старый движок.
- Не мерджить PR #8 / #9.
- Не добавлять зависимости.
- Не использовать `any` / `Record<string, unknown>` для core-данных.

## Текущий стек

Мы делаем браузерную игру/расследование о том, как обычные группы могут постепенно становиться деструктивными системами.

Текущий стек:

- React
- TypeScript
- Vite
- JSON content
- localStorage save
- пока без backend

Репозиторий:

- `https://github.com/alexbayov/cult-sim-prototype`

## Контекст беседы

Изначальная идея была про игру в духе системной симуляции деструктивных групп, но важный фокус быстро сместился:

- не глобальная карта распространения;
- не «инструкция по созданию секты»;
- не морализаторская лекция;
- а камерная модель, где видно, что происходит **внутри участников**.

Ключевые решения:

1. Игрок видит людей, их состояния и групповые метрики.
2. Карты снаружи звучат нейтрально/правдоподобно.
3. Скрытая логика карт моделирует контроль, зависимость, стыд, изоляцию, финансовое давление.
4. Опасность возникает не от одной карты, а от сочетаний.
5. Финал показывает цену системы и даёт разбор терминов.

Важная формулировка от пользователя:

> не формулировать прямо «лидер всегда прав»; внешняя семантика должна быть мягче, но смысл должен считаться системой.

Также пользователь прямо обозначил:

- игра может разбирать радикализацию и вербовку, но без инструктивных деталей;
- игра не должна прямо говорить «это плохо»;
- нужно показывать разные финалы, включая мрачно-успешные;
- проект ведём как маленькую полноценную game studio;
- пользователь готов генерировать визуал в GPT/Canva.

## Что уже сделано

### PR #1 — initial prototype

Ссылка: `https://github.com/alexbayov/cult-sim-prototype/pull/1`

Сделано:

- React/Vite прототип;
- участники;
- карты;
- метрики;
- комбо;
- журнал;
- финальный разбор.

### PR #2 — studio roadmap foundation

Ссылка: `https://github.com/alexbayov/cult-sim-prototype/pull/2`

Сделано:

- `docs/ROADMAP.md`
- `docs/BACKLOG.md`
- `docs/AGENT_BRIEF.md`
- `docs/METRICS.md`
- `docs/CONTENT_MODEL.md`
- CSV-таблицы для баланса и аналитики.

### PR #3 — playable foundation

Ссылка: `https://github.com/alexbayov/cult-sim-prototype/pull/3`

Сделано:

- localStorage save/load;
- save schema version;
- scenario content schema;
- art direction;
- asset manifest.

### PR #4 — orchestration workflow

Ссылка: `https://github.com/alexbayov/cult-sim-prototype/pull/4`

Сделано:

- `docs/ORCHESTRATION.md`;
- conductor/dev workflow;
- brief template;
- smoke commands.

### PR #5 — JSON content migration

Ссылка: `https://github.com/alexbayov/cult-sim-prototype/pull/5`

Статус на момент написания: open.

Сделано:

- сценарий вынесен в `src/game/scenarios/info-business-marathon.json`;
- `src/game/data.ts` стал thin loader;
- включён `resolveJsonModule`;
- docs обновлены под JSON workflow;
- Canva visual bible добавлен в `asset_manifest.csv`.

## Текущая структура

```txt
src/game/types.ts
src/game/contentSchema.ts
src/game/scenarios/info-business-marathon/
  scenario.json
  participants.json
  cards.json
  combos.json
src/game/data.ts
src/game/engine.ts
src/game/storage.ts
src/App.tsx

docs/ROADMAP.md
docs/BACKLOG.md
docs/AGENT_BRIEF.md
docs/METRICS.md
docs/CONTENT_MODEL.md
docs/ART_DIRECTION.md
docs/ORCHESTRATION.md
docs/CONDUCTOR_HANDOFF.md
docs/tables/*.csv
```

## Главная стратегия

### Не идти сразу в production

Порядок:

1. Web vertical slice.
2. Контент и баланс.
3. Mobile-first layout.
4. Yandex Games SDK.
5. Public MVP на Яндекс Играх.
6. Только потом Google Play / iOS.

### Почему

Яндекс Игры принимает web build. Текущий React/Vite проект уже естественно собирается в static HTML/CSS/JS. Поэтому не нужно сейчас переносить в Unity/Godot.

## Roadmap на ближайшие раунды

### Раунд 1 — после merge PR #5

Цель: сделать контентную базу удобной.

PR-кандидаты:

1. Split scenario JSON — сделано в ветке `devin/split-scenario-json`:
   - `src/game/scenarios/info-business-marathon/scenario.json`
   - `src/game/scenarios/info-business-marathon/participants.json`
   - `src/game/scenarios/info-business-marathon/cards.json`
   - `src/game/scenarios/info-business-marathon/combos.json`
2. Add finale data to JSON (`finales.json` рядом с остальными).
3. Add content validation script.

### Раунд 2 — playable loop v2

Цель: сделать игру игрой, а не последовательным кликом карт.

Задачи:

- 2–3 действия за неделю;
- отдельный crisis slot;
- реакция на кризис;
- стоимость/лимиты действий;
- более явный финальный экран;
- разные финалы по стратегии.

### Раунд 3 — mobile-first/Yandex readiness

Цель: подготовить к Яндекс Играм.

Задачи:

- responsive layout 390×844;
- нижняя панель карт;
- collapsible metrics;
- platform storage adapter;
- Yandex SDK adapter stub;
- loading/splash.

### Раунд 4 — content expansion

Цель: первый сценарий должен держать 10–15 минут.

Задачи:

- 30–50 карт;
- 10–15 комбо;
- 8–10 кризисов;
- 6–8 финалов;
- больше debrief tags;
- таблицы баланса.

### Раунд 5 — visual integration

Цель: заменить placeholder UI на узнаваемый стиль.

Задачи:

- 6 портретов;
- 3 card templates;
- metric icons;
- фон доски дела;
- подключить ассеты из manifest.

## Canva / визуал

Пользователь дал Canva link:

`https://canva.link/o74p4lf29vldb0o`

Проблема: в текущей сессии ссылка открылась, но Canva остановилась на Cloudflare verify human, поэтому макет не виден.

Что просить у пользователя:

1. export PNG/JPG/PDF и прикрепить сюда;
2. или публичный view/comment link, который открывается без login/Cloudflare;
3. или отдельный board со страницами:
   - Moodboard
   - Participants
   - Card Types
   - Metric Icons
   - Backgrounds
   - Rejected/Archive

Первые ассеты:

- `participant_anya`
- `participant_ilya`
- `participant_marina`
- `participant_danya`
- `participant_sveta`
- `participant_oleg`
- `card_practice_template`
- `card_crisis_template`
- `card_counter_template`
- `bg_case_board`
- `icon_metric_set`

Смотреть `docs/ART_DIRECTION.md` и `docs/tables/asset_manifest.csv`.

## Orchestration mode

Использовать, когда хотим экономить контекст и делать параллельно.

Роль текущей/следующей основной сессии:

- дирижёр;
- не пишет много кода, если запущены девы;
- пишет briefs;
- ревьюит PR;
- даёт smoke commands;
- держит roadmap.

## Готовые brief-заготовки

### Dev 1 — Split JSON scenario files — сделано

Ветка: `devin/split-scenario-json`. Сценарий разложен по отдельным файлам в `src/game/scenarios/info-business-marathon/`. Наружу движок по-прежнему видит единственный `infoBusinessMarathonScenario: ScenarioContent` из `src/game/data.ts`.

Дальше по этой линии остались finales/debrief-словарь (отдельными PR-ами) и content validation script.

### Dev 2 — Mobile-first layout

Branch: `devin/mobile-layout`

Контекст:

Яндекс Игры и будущий mobile требуют удобный вертикальный интерфейс.

Что менять:

- `src/App.css`;
- возможно минимально `src/App.tsx`;
- сделать layout для 390×844;
- cards/participants/metrics должны быть доступны без горизонтального скролла.

Acceptance criteria:

- desktop не сломан;
- mobile usable;
- build/lint проходят.

Что НЕ делать:

- не менять game engine;
- не менять content JSON.

### Dev 3 — Art asset integration stub

Branch: `devin/art-asset-stub`

Контекст:

Пользователь будет генерировать визуал. Нужны безопасные точки подключения ассетов.

Что менять:

- создать папки `src/assets/art/...`;
- добавить placeholder manifest mapping в коде;
- подготовить компонент/utility для participant avatar и card art;
- не требовать реальные картинки.

Acceptance criteria:

- если ассета нет, UI показывает текущий fallback;
- если ассет добавлен по manifest path, его можно подключить;
- build/lint проходят.

Что НЕ делать:

- не коммитить большие тяжёлые картинки без оптимизации;
- не менять баланс.

## Smoke commands

Всегда:

```bash
npm install
npm run build
npm run lint
```

Для ручной проверки:

```bash
npm run dev
```

Smoke checklist:

1. открыть игру;
2. выбрать 2–3 карты;
3. проверить изменение метрик;
4. проверить журнал;
5. refresh страницы;
6. проверить save/load;
7. нажать «новая партия»;
8. проверить reset.

## Текущие риски

1. Git push через стандартный proxy давал 403, поэтому ветки/PR создавались через GitHub API с PAT.
2. Canva может блокировать просмотр через Cloudflare.
3. Пока нет CI.
4. Пока контентный JSON большой единый.
5. Пока нет mobile-first UX.

## Немедленный следующий шаг

Если PR #5 ещё открыт:

1. попросить пользователя замержить PR #5;
2. после merge подтянуть main;
3. начать orchestration round:
   - Dev 1: split JSON;
   - Dev 2: mobile layout;
   - Dev 3 или человек: visual assets.

Если не хотим параллелить:

1. сначала split JSON;
2. потом mobile layout;
3. потом asset integration.
