# Content model

> **Статус:** проект pivot’ится с карточного симулятора на cult investigation / dossier game.
>
> - Новая модель — **investigation content** (case → persons → sources → evidence fragments → patterns → report → debrief) — лежит в `src/game/investigation/` и `src/game/cases/<case-id>/`.
> - Старая модель — карточный сценарий (`src/game/types.ts`, `src/game/contentSchema.ts`, `src/game/scenarios/...`) — пока остаётся как **legacy/prototype**. Не удаляется, но новые фичи на ней не строятся.
>
> Этот документ описывает обе модели: сначала investigation (актуальная), затем legacy.

## Investigation content (актуальная модель)

### Структура

```txt
src/game/investigation/
  types.ts              # TypeScript-типы (InvestigationCase, CasePerson, ...)
  contentSchema.ts      # рантайм-валидатор + InvestigationContentError
  data.ts               # сборка кейса из JSON + лог валидации при импорте

src/game/cases/info-business-marathon/
  case.json             # один объект InvestigationCase
  persons.json          # массив CasePerson
  sources.json          # массив CaseSource
  evidence.json         # массив EvidenceFragment
  patterns.json         # массив ControlPattern
  report.json           # ReportContent: thresholds + outcomes + sections
  debrief.json          # массив DebriefEntry (глоссарий с примерами)
```

`src/game/investigation/data.ts` импортирует все семь JSON и собирает единый `InvestigationContent`. При импорте вызывается `validateInvestigationContent` и любые ошибки уходят в `console.error`. Для строгой проверки (с исключением) есть `assertValidInvestigationContent`.

Дополнительно есть `scripts/validate-investigation.mjs` — node-скрипт, который запускает ту же структурную проверку без React/Vite **плюс** даёт несколько content-design предупреждений. Запуск:

```bash
npm run validate:investigation
```

Скрипт разделяет проверки на **errors** (валятся, exit 1) и **warnings** (не валятся, exit 0):

**Errors (структура):**

- дубликаты `id` среди persons/sources/evidence/patterns/outcomes/debrief;
- висячие ссылки (`sourceId`, `linksToPersonIds`, `suggestedPatternIds`, `unlocksSourceIds`, `requiredPatternIds`, `forbiddenPatternIds`, `exampleEvidenceIds`);
- значения вне диапазонов (`reliability`, `riskLevel`, `influenceLevel`, `credibility` — 0..100; `weight` — 1..5; `requiredEvidenceCount >= 1`);
- пустые `initialSourceIds` / `initialPersonIds` / `themeTags`;
- evidence, разблокирующий собственный источник;
- пересечение `requiredPatternIds` и `forbiddenPatternIds` у одного outcome;
- `Debrief.exampleEvidenceIds` указывает на несуществующий evidence id.

**Warnings (content-design):**

- *source reachability* — источник не лежит ни в `case.initialSourceIds`, ни в `evidence.unlocksSourceIds`: в обычной партии его невозможно открыть;
- *empty source display* — у источника нет ни одного `defaultVisible && !isRedHerring` фрагмента: открытие в досье будет выглядеть пустым;
- *orphan pattern* — у паттерна нет `strongEvidenceIds`/`weakEvidenceIds` и ни один evidence не указывает на него через `suggestedPatternIds`;
- *missing debrief* — нет debrief-записи, чей id равен `p_X → d_X` или чьи `exampleEvidenceIds` пересекаются с фрагментами паттерна;
- *missing outcome class* — нет low (`minPatternConfirmedCount === 0`), medium (1 ≤ min < strongThreshold) или strong (min ≥ strongThreshold) outcome;
- *language regression* — в видимых геймплейных полях (`case.title/subtitle/publicLegend/...`, `source.title/origin`, `evidence.text/speaker`, `pattern.title/shortDescription/fullDescription/debriefText`, `report.outcome.title/summary/recommendedFraming/notes`, person `name/publicDescription/knownFacts`) встречается «первичная» терминология: `улика`, `доказательство`, `ДЕЛО`, `ДОСЬЕ`, `секта`, `love bombing`, `coercive control`, `gaslighting`, `газлайтинг`, а также `паттерн` в кратких видимых заголовках/summary.

Языковые предупреждения **намеренно не валят валидатор**: цель — поймать регрессию неявно, не блокируя контент-итерации. Эти термины разрешены в id, в `debrief.term` и `debrief.longExplanation` (как вторичный образовательный контекст), в документации и комментариях кода.

### Ключевые сущности

| Сущность | Что описывает | Кросс-ссылки |
|---|---|---|
| `InvestigationCase` | Дело: публичная легенда, вопрос расследования, риск, стартовые источники/люди. | `initialSourceIds → CaseSource`, `initialPersonIds → CasePerson` |
| `CasePerson` | Профиль участника дела (роль, факты, метки риска/влияния/достоверности). | `sourceIds → CaseSource` |
| `CaseSource` | Источник материала (лендинг, чат, свидетельство, платёжный мемо и т.д.). | `unlockedByEvidenceIds → EvidenceFragment` |
| `EvidenceFragment` | Атомарный фрагмент из источника: цитата, ссылка, метки риска, вес. | `sourceId → CaseSource`, `linksToPersonIds → CasePerson`, `suggestedPatternIds → ControlPattern`, `unlocksSourceIds → CaseSource` |
| `ControlPattern` | Паттерн (изоляция, финансовое давление и т.д.) с сильными/слабыми/контр-доказательствами. | `strongEvidenceIds / weakEvidenceIds / counterEvidenceIds → EvidenceFragment` |
| `ReportContent` | Финальный отчёт: thresholds, outcomes (исходы), список секций. | `outcomes[].requiredPatternIds / forbiddenPatternIds → ControlPattern` |
| `DebriefEntry` | Образовательная справка по паттерну (термин, объяснение, защитные факторы, примеры). | `exampleEvidenceIds → EvidenceFragment` |

### Текущие сиды

В репозитории два кейса, оба собираются и валидируются:

**`info-business-marathon` — «Марафон личной эффективности».**

- 8 persons: leader, admin, vulnerable participant, ex-member, donor, relative + curator + external observer.
- 12 sources: лендинг, открытый чат, закрытый чат, свидетельство ex-member, платёжный мемо, видеотранскрипт, сообщение родственника, внутренний чек-лист и т. д.
- 47 evidence fragments (включая red herring — `e_landing_results`, `e_video_general_promise`, `e_comments_donor_endorsement`).
- 12 patterns (10 механизмов контроля + 2 защитных — `p_protective_ties`, `p_reality_testing`).
- 6 report outcomes (`ro_insufficient`, `ro_early_signal`, `ro_warning`, `ro_protective_focus`, `ro_system_proven`, `ro_misread`).
- 14 debrief entries.

Source unlocks: `e_landing_special_path → s_testimony_ex`; `e_chat_second_circle_hint → s_chat_closed`; `e_ex_financial_pressure → s_payment_memo`; `e_payment_pressure_script → s_internal_checklist`; `e_chat_refund_hint → s_refund_thread`; `e_checklist_curator_handoff → s_curator_notes`.

**`family-retreat-center` — «Семейный ретрит-центр».**

- 6 persons: наставник, оператор-куратор, новая участница, бывший волонтёр, партнёр участницы, внешний психолог.
- 10 sources: лендинг, приветственное письмо, расписание первых 10 дней, групповой чат, личный дневник, письмо партнёра, платёжный мемо, свидетельство бывшего волонтёра, внутренняя записка персонала, статья районной газеты.
- 31 evidence fragments (включая red herring — `e_news_neutral`).
- 11 patterns (9 наблюдательных + 2 защитных — `p_protective_ties`, `p_reality_testing`).
- 5 report outcomes (`ro_too_early`, `ro_early_signal`, `ro_warning`, `ro_protective_focus`, `ro_system_proven`).
- 11 debrief entries.

Source unlocks: `e_welcome_quiet_period → s_group_chat`; `e_partner_change → s_diary_ekaterina`; `e_diary_money_anxiety → s_payment_memo`; `e_landing_special_path → s_ex_testimony`; `e_ex_unpaid_labor → s_staff_note`.

Оба кейса экспортируются из `src/game/investigation/data.ts` (`infoBusinessMarathonInvestigation`, `familyRetreatCenterInvestigation`) и попадают в массив `investigationContents`. UI на данный момент рендерит только первый кейс — второй существует как content-only сид.

`scripts/validate-investigation.mjs` автоматически находит все папки в `src/game/cases/`, в которых есть `case.json`, и валидирует каждую отдельно. Чтобы добавить третий кейс, достаточно положить новый набор JSON-файлов в `src/game/cases/<new-case-id>/` и добавить экспорт в `data.ts`.

### Правила редактирования контента

Все правки — в JSON-файлах внутри `src/game/cases/<case-id>/`:

- новая улика → `evidence.json` с корректными `sourceId / linksToPersonIds / suggestedPatternIds`;
- новый паттерн → `patterns.json`, плюс при необходимости — `debrief.json`;
- новый источник → `sources.json`, плюс хотя бы одна evidence-цитата;
- изменение исхода — `report.json`.

После любых правок:

```bash
npm run validate:investigation
npm run build
npm run lint
```

Запрещается:

- `Record<string, unknown>` и `any` в core-данных;
- хардкод реальных организаций, контактов, логотипов;
- инструктивные детали («как вербовать», «как удерживать»).

---

## Legacy: карточный сценарий

> Этот раздел оставлен как справка по `src/game/scenarios/...`. Старый карточный движок продолжает собираться, но новые фичи на нём не строятся. Удаление — после переноса UI на dossier-модель.

Контент должен быть модульным: новые сценарии, карты, участники, комбо и финалы добавляются как данные.

## Сценарий

Сценарий — это оболочка партии.

Примеры:

- инфоцыганский марафон;
- псевдопсихологический тренинг;
- эзотерическая студия;
- корпоративная культура;
- конспирологический чат;
- скам-комьюнити.

Сценарий задаёт:

- стартовые метрики;
- набор участников;
- набор карт;
- набор комбо;
- финалы;
- словарь/разбор.

В коде сценарий описывается типом `ScenarioContent` в `src/game/contentSchema.ts`.
Текущий стартовый сценарий разложен по отдельным JSON-файлам в папке `src/game/scenarios/info-business-marathon/`:

```txt
src/game/scenarios/info-business-marathon/
  scenario.json       # id, title, premise, initialGroup
  participants.json   # массив участников
  cards.json          # массив карт
  combos.json         # массив combo rules
```

`src/game/data.ts` импортирует все четыре файла и собирает из них `ScenarioContent`. Наружу по-прежнему экспортируется единственный объект `infoBusinessMarathonScenario: ScenarioContent`, поэтому `engine.ts` и UI ничего не знают о том, что контент лежит в нескольких файлах.

Когда появятся финалы и debrief-словарь, добавим рядом `finales.json` (и при необходимости `debrief.json`) и подключим их в `data.ts` так же, как остальные секции.

## Участник

Участник — главный объект игры.

Поля:

- `id`
- `name`
- `archetype`
- `need`
- `vulnerability`
- `protection`
- `protectionLevel`
- `vulnerabilityLevel`
- `metrics`

### Метрики участника

| Metric | Смысл |
|---|---|
| `trust` | доверие к группе |
| `autonomy` | способность выбирать независимо |
| `dependence` | зависимость от группы |
| `doubt` | сомнение |
| `fatigue` | истощение |
| `shame` | стыд |
| `fear` | страх |
| `financialPressure` | финансовое давление |
| `exitReadiness` | готовность выйти |
| `recruitReadiness` | готовность приводить других |

## Группа

### Метрики группы

| Metric | Смысл |
|---|---|
| `involvement` | активность и количество людей |
| `trust` | вера в безопасность/полезность |
| `money` | деньги |
| `legitimacy` | нормальный внешний вид |
| `harm` | накопленная цена для участников |
| `doubt` | внутреннее напряжение |
| `visibility` | внимание внешнего мира |
| `leaderControl` | управляемость через лидера |
| `radicalization` | отход от исходной оболочки |
| `resistance` | родственники, бывшие участники, специалисты, СМИ |

## Карта

Карта должна иметь два слоя:

1. **Surface** — как это выглядит для участника.
2. **Hidden model** — что это делает в симуляции.

### Обязательные поля

| Field | Смысл |
|---|---|
| `id` | стабильный идентификатор |
| `title` | нейтральное/реалистичное название |
| `type` | practice, crisis, counter |
| `tier` | уровень интенсивности |
| `surface` | внешний текст |
| `intent` | внутренняя логика для прототипа |
| `tags` | скрытые теги для комбо |
| `effects` | изменения метрик |
| `redFlags` | признаки для журнала/разбора |
| `debriefTags` | термины для финального разбора |

## Семантическое правило

Плохо:

- «Манипулировать сомнениями»
- «Запретить критику»
- «Изолировать от семьи»

Хорошо:

- «Разбор внутренних стопоров»
- «Общая позиция команды»
- «Чистая среда фокуса»

Смысл контроля должен быть в тегах и эффектах, а не в прямом названии карты.

## Типы карт

### Practice

Действие группы.

Примеры:

- стартовый эфир;
- окно поддержки;
- единый ритм потока;
- приглашение в следующий круг.

### Crisis

Событие, которое проверяет систему.

Примеры:

- участник выгорел;
- вопрос от близкого;
- неловкая ветка вопросов;
- пост бывшего участника.

### Counter

Защитное событие или возвращение автономии.

Примеры:

- пауза на проверку;
- разговор с человеком вне потока;
- консультация специалиста;
- финансовая пауза.

## Комбо

Комбо показывает, что опасность возникает не из одной карты, а из связки.

Пример:

`support + belonging + leader_aura + money`

Может дать паттерн:

> Тёплая воронка доверия.

Комбо имеет:

- `requiredTags`
- `windowTurns`
- `effects`
- `redFlag`
- `debriefTags`

## Финал

Финал должен быть следствием стратегии.

Примеры:

- мягкий распад;
- дорогой прорыв;
- публичный разбор;
- закрытый круг успеха;
- свой язык, свой круг;
- уход в подполье;
- перерождение в безопасный формат.

## Контентный checklist

Перед добавлением карты проверить:

- Название звучит как реальная упаковка?
- Есть скрытые теги?
- Есть эффекты на группу или участников?
- Есть красный флаг?
- Есть debrief tags?
- Нет инструктивных деталей?
- Карта интересна как игровой выбор?
- Карта может участвовать хотя бы в одном комбо?

## JSON editing rule

Контентные правки вносить в JSON-файлы внутри `src/game/scenarios/info-business-marathon/`, а не в `src/game/data.ts` или `src/game/engine.ts`:

- новая или изменённая карта → `cards.json`;
- участник или его метрики → `participants.json`;
- комбо-правило → `combos.json`;
- стартовые метрики группы, заголовок и premise → `scenario.json`.

После любых правок контента:

```bash
npm run build
npm run lint
```

Если build падает из-за schema mismatch, сначала исправить JSON, а не обходить validation.
