# Content model

> До PR #14 здесь жил карточный прототип; модель удалена в PR #33. Этот документ описывает только текущую investigation/dossier-модель.
>
> Для рекомендаций по объёму и составу нового кейса, по правилам адаптации реальных
> историй и по структуре сезона — см. `docs/SEASON_AND_CASE_FRAMEWORK.md`.

## Investigation content

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

