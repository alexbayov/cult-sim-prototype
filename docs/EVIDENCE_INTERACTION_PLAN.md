# Evidence interaction integration plan

Этот документ описывает, как игровая модель «работы с фрагментами» из PR #10 проектируется поверх контент-модели из PR #13 (`src/game/investigation/`) **без** изменения существующего UI (`src/investigation/DossierApp.tsx`) и без подмешивания зависимостей. Он сопровождает чистый модуль помощников `src/investigation/interactionModel.ts`, который реализует логику без React, DOM и побочных эффектов, и smoke-фикстуру `scripts/smoke-interaction-model.mjs`, которая проверяет три канонических состояния.

Документ задаёт словарь, формат состояния, переходы и точки расширения. Реализация кликабельного UI и анимаций сюда не входит — это следующий шаг после того, как модель и помощники будут приняты.

---

## 1. Контекст и принципы

**Контент-модель (PR #13).** Источник правды — `src/game/investigation/types.ts`. Кейс состоит из `case`, `persons`, `sources`, `evidence` (фрагменты), `patterns` (наблюдения), `report` (исходы) и `debrief` (образовательные пояснения). JSON-файлы по кейсу лежат в `src/game/cases/<case-id>/`, оба сидовых кейса экспортируются из `src/game/investigation/data.ts` (`infoBusinessMarathonInvestigation`, `familyRetreatCenterInvestigation`).

**Прежний прототип (PR #10).** Идея: игрок переключает «закладки» на отдельных строках источника, набор закладок копится в «дневнике», по нему ИИ-наставник собирает «сводку», часть источников появляется только после набора нужных закладок.

**Цель PR #13 + этой работы.** Соединить две модели через узкий API, в котором:

- состояние = множество выбранных фрагментов (`selectedFragmentIds`);
- набор видимых источников вычисляется детерминированно;
- статусы наблюдений вычисляются детерминированно;
- черновик сводки выбирается детерминированно из выбранных наблюдений и состава `report.outcomes`.

**Что НЕ делаем здесь.**

- Не трогаем `src/investigation/DossierApp.tsx`, `src/investigation/dossier.css`, `src/investigation/dossierMock.ts`.
- Не правим `src/App.tsx`, `src/App.css`, `src/index.css`.
- Не реализуем кликабельный UI, drag-and-drop, тосты, тулзу диктофона из PR #10.
- Не вносим новых зависимостей.
- Не правим контент существующих кейсов (кроме того, что уже сделано в PR #14/#15).

**Принципы.**

1. **Чистые функции.** Все помощники в `interactionModel.ts` — без React, без `Date.now()`, без `Math.random()`, без I/O. Это означает, что они одинаково работают в браузере, в Node-фикстуре и в будущих юнит-тестах.
2. **JSON-сериализуемое состояние.** Состояние сводится к множеству строковых id; его можно положить в `localStorage`, передать по URL, отправить в save-game без структурных перетрясок.
3. **Монотонность.** Выбор большего количества фрагментов никогда не «понижает» статус наблюдения и никогда не убирает из видимости источник, который уже стал видимым. Это позволяет UI безопасно анимировать переходы только в одном направлении.
4. **Нейтральный словарь в API.** Внешние имена функций и типов используют слова, которые игрок видит — `fragment`, `observation`, `summary`. Канонические имена типов из `types.ts` (`EvidenceFragment`, `ControlPattern`, `ReportOutcome`) остаются — это shape-of-data на диске.

---

## 2. Маппинг PR #10 → текущая модель

| Концепт PR #10 | Поле / тип в `types.ts` | Комментарий |
|---|---|---|
| «Закладка / маркер» на строке источника | `EvidenceFragment.id` в `state.selectedFragmentIds` | Игрок не «создаёт улику», а помечает существующий фрагмент текста. Сам фрагмент уже описан в `evidence.json`. |
| «Дневник игрока» | `state.selectedFragmentIds: Set<string>` | Никакого отдельного объекта «note» нет — всё, что игрок собрал, — это упорядоченный набор id выбранных фрагментов. |
| «Скрытый источник, который раскрывается после набора маркеров» | `EvidenceFragment.unlocksSourceIds` + `CaseManifest.initialSourceIds` | Любой выбранный фрагмент может расширить набор видимых источников; начальные источники видны всегда. |
| «Степень уверенности в гипотезе» | `ControlPattern` со `strongEvidenceIds` / `weakEvidenceIds` / `counterEvidenceIds` + `requiredEvidenceCount` | Сравнение выбранных фрагментов с этими списками даёт статус наблюдения. |
| «Сводка от наставника» | `ReportContent.outcomes[]` | Текст сводки — `outcome.summary` / `outcome.recommendedFraming`. Выбор конкретного исхода — задача `buildSummaryDraft`. |
| «Подсказка наставника» | `ControlPattern.debriefText` + `DebriefEntry.longExplanation` | Подсказка не генерируется LLM — она лежит в данных. UI решает, когда её показать (например, при первом достижении `supported`). |
| «Лента сомнения / red herring» | `EvidenceFragment.isRedHerring` + `counterEvidenceIds` | Red herring остаются в общем списке, выбор red herring не повышает ни одно наблюдение. |

Карта помогает понять: **никаких новых сущностей в данные мы не вводим**. Всё, что PR #10 описывал как «закладки», «дневник», «сводка», уже лежит в текущей контент-модели — нужно только аккуратно описать переходы.

---

## 3. Формат состояния и API

### 3.1 Состояние

```ts
type SelectedFragmentId = string

type InteractionState = {
  selectedFragmentIds: ReadonlySet<SelectedFragmentId>
}
```

Сериализованная форма (для `localStorage` / save-game):

```json
{
  "selectedFragmentIds": ["e_ex_isolation_request", "e_relative_no_contact"]
}
```

Это сознательно минимальное состояние. Всё остальное (какие источники видимы, какой статус у каждого наблюдения, какая сводка) — вычисляемо. Если UI хочет хранить какие-то ещё артефакты (последнее открытое окно, прочитанные debrief-карточки), они хранятся отдельно и не влияют на модель.

### 3.2 Публичный API `src/investigation/interactionModel.ts`

```ts
export type SelectedFragmentId = string
export type ObservationStatus = 'hidden' | 'signal' | 'supported' | 'strong'

export type InteractionState = {
  selectedFragmentIds: ReadonlySet<SelectedFragmentId>
}

export type ObservationStatusResult = {
  patternId: string
  status: ObservationStatus
  strongCount: number
  weakCount: number
  counterCount: number
  totalWeight: number
}

export type SummaryDraft = {
  outcome: ReportOutcome | null
  strongObservationIds: string[]
  supportedObservationIds: string[]
  selectedFragmentCount: number
  reason: string
}

export function createInteractionState(
  selected: Iterable<SelectedFragmentId>,
): InteractionState

export function getSelectedFragments(
  content: InvestigationContent,
  state: InteractionState,
): EvidenceFragment[]

export function computeUnlockedSourceIds(
  content: InvestigationContent,
  state: InteractionState,
): Set<string>

export function computeObservationStatus(
  pattern: ControlPattern,
  state: InteractionState,
  fragmentsById: ReadonlyMap<string, EvidenceFragment>,
): ObservationStatusResult

export function computeObservationStatuses(
  content: InvestigationContent,
  state: InteractionState,
): ObservationStatusResult[]

export function buildSummaryDraft(
  content: InvestigationContent,
  state: InteractionState,
): SummaryDraft
```

### 3.3 Алгоритм статуса наблюдения

Псевдокод (полностью реализован в `computeObservationStatus`):

```
strongSet  = pattern.strongEvidenceIds
weakSet    = pattern.weakEvidenceIds
counterSet = pattern.counterEvidenceIds

strongCount, weakCount, counterCount, totalWeight = 0

for fid in state.selectedFragmentIds:
  fragment = fragmentsById[fid]
  if fid in strongSet:
    strongCount += 1; totalWeight += fragment.weight
  elif fid in weakSet:
    weakCount += 1; totalWeight += fragment.weight
  elif fid in counterSet:
    counterCount += 1
  elif pattern.id in fragment.suggestedPatternIds:
    weakCount += 1; totalWeight += fragment.weight

supportCount = strongCount + weakCount
status =
  'hidden'    if supportCount == 0
  'strong'    elif supportCount >= pattern.requiredEvidenceCount and strongCount >= 1
  'supported' elif strongCount >= 1
  'signal'    else
```

**Свойства алгоритма.**

- *Монотонность*: добавление нового выбранного фрагмента может только увеличить `strongCount` / `weakCount` / `counterCount`, но никогда не уменьшить. Поэтому статус может только подниматься по цепочке `hidden → signal → supported → strong`.
- *Counter-evidence сейчас не понижает статус*. Он считается отдельно и возвращается в результате (`counterCount`) — будущая логика отчёта может им пользоваться, но статус остаётся монотонным. Это сознательное проектное решение; см. §6.
- *`suggestedPatternIds` работает как «слабый» сигнал*. Если фрагмент явно не в strong/weak/counter списке паттерна, но указывает на него в `suggestedPatternIds`, он повышает `weakCount`. Это позволяет evidence-only авторам не возиться с дублированием ссылок в каждом паттерне.

### 3.4 Видимые источники

```
visible = new Set(case.initialSourceIds)
for fid in state.selectedFragmentIds:
  fragment = fragmentsById[fid]
  for sid in fragment.unlocksSourceIds:
    visible.add(sid)
```

Источник, единожды раскрытый, никогда не «закрывается» обратно. UI может анимировать момент появления, но в самой модели — это идемпотентное `Set.add`.

### 3.5 Выбор исхода для сводки

```
strongPatternIds = { p.id for status in observationStatuses if status == 'strong' }

eligible = [
  o in report.outcomes
  where strongPatternIds.size >= o.minPatternConfirmedCount
    and all required in strongPatternIds for required in o.requiredPatternIds
    and no forbidden in strongPatternIds for forbidden in o.forbiddenPatternIds
]

if eligible is empty:
  outcome = first(o for o in report.outcomes where minPatternConfirmedCount == 0 and requiredPatternIds == [])
  reason  = 'no strong-pattern outcome eligible; fell back to ' + outcome.id

else:
  outcome = sort eligible by (
    -minPatternConfirmedCount,        # выше — раньше
    -requiredPatternIds.length,       # более конкретный — раньше
    index in report.outcomes          # стабильный порядок объявления
  )[0]
  reason  = 'picked highest-threshold eligible outcome (' + outcome.id + ')'
```

**Почему так.** Если выбранные фрагменты подтверждают несколько уровней сразу (например, и `ro_warning`, и `ro_system_proven`), мы предпочитаем более «глубокий» исход — у него выше `minPatternConfirmedCount`, и обычно у него же больше `requiredPatternIds`. Это соответствует принципу «UI показывает наиболее конкретную сводку, какую данные позволяют». При равных параметрах сохраняется порядок объявления в `report.outcomes`, чтобы редактор мог влиять на тай-брейкер вручную.

---

## 4. Нейтральный язык в потенциальном UI

Когда UI будет надстроен поверх модели, для надписей и подписей рекомендуется использовать:

| Игровая роль | Подпись для UI | Комментарий |
|---|---|---|
| `EvidenceFragment` | **фрагмент** | Не «улика», не «доказательство». В видимых полях это слово запрещено валидатором. |
| Действие «пометить фрагмент» | **закладка** | Глагол — «поставить закладку», «снять закладку». |
| `ControlPattern` | **наблюдение** | Не «паттерн» в видимых заголовках (валидатор предупреждает). Слово «паттерн» допустимо во внутренних описаниях и debrief. |
| `ReportOutcome` | **сводка** / **черновик сводки** | Не «дело», не «досье» (запрещены валидатором). |
| Статусы наблюдения | **пока тишина / сигнал / устойчиво / складывается** | Соответствие `hidden / signal / supported / strong`. Это рекомендация для UI, само API статусов — английское. |

Эти ограничения уже зафиксированы в `scripts/validate-investigation.mjs` (warnings на `улика`, `доказательство`, `ДЕЛО`, `ДОСЬЕ`, `секта`, `love bombing`, `coercive control`, `gaslighting`, `газлайтинг`, плюс `паттерн` в специальных полях). Когда UI начнёт добавлять собственные строки, имеет смысл прогнать их через тот же список в код-ревью.

---

## 5. Smoke-фикстура

`scripts/smoke-interaction-model.mjs` запускается командой `npm run smoke:interaction` и печатает три состояния поверх кейса `info-business-marathon`:

1. **Пустое состояние.** Видимы только начальные источники (6), ни одного наблюдения, сводка — `ro_insufficient`.
2. **Раннее состояние.** Выбран один сильный фрагмент `e_ex_isolation_request`. Наблюдение `p_isolation` поднимается до `supported`, сводка по-прежнему `ro_insufficient`, потому что ни одно наблюдение ещё не `strong`.
3. **Сильное состояние.** Выбрано ~14 фрагментов, которые покрывают `p_isolation`, `p_financial_pressure`, `p_coercive_control`, `p_leader_control` (плюс побочно `p_information_control`, `p_protective_ties`). Открываются дополнительные источники (`s_payment_memo`, `s_internal_checklist`, `s_refund_thread`). Сводка переключается на `ro_system_proven`.

Фикстура — *smoke*, а не *unit*: она печатает результат и завершается с кодом 0, если базовый инвариант (в сильном состоянии есть хотя бы одно `strong`-наблюдение) выполняется. Цель — дать ревьюеру быстро посмотреть, что алгоритм не сломан, без подключения тестового фреймворка. JS-копия алгоритма в смоук-скрипте — намеренное дублирование (TS-модуль не исполним из Node как есть); при правках `interactionModel.ts` нужно синхронизировать обе версии.

---

## 6. Расширения и открытые вопросы

Эти пункты вынесены за пределы PR-I и обсуждаемы в следующих PR.

1. **Поведение counter-evidence.** Сейчас counter-фрагменты считаются, но не понижают статус. Альтернативы:
   - понижать на одну ступень при `counterCount > strongCount`;
   - помечать наблюдение отдельным флагом `contested` для UI;
   - влиять только на выбор исхода (например, отключать `ro_system_proven` при >2 counter-фрагментов).
   Решение зависит от того, как авторы хотят балансировать «и так, и так» в сводке.
2. **Снятие закладки.** Текущая модель поддерживает удаление id из `selectedFragmentIds` (просто `Set.delete`). UI обязан анимировать «опускание» статусов корректно — модель этого не запрещает.
3. **Несколько кейсов.** `data.ts` теперь экспортирует `investigationContents`. Когда UI начнёт выбирать кейс, состояние следует индексировать по `case.id`, например `Map<caseId, InteractionState>`. Модули в `interactionModel.ts` уже принимают `InvestigationContent` явно, так что менять API не придётся.
4. **Локализация.** Все рекомендации по словарю в §4 — русские. Если позже потребуется en-локаль, она ложится поверх — алгоритм нечувствителен к языку.
5. **Подсказки наставника.** Сейчас они хранятся как `pattern.debriefText` и `debrief.longExplanation`. Когда UI решит подсвечивать подсказку, имеет смысл различать «короткая реплика» и «полная справка после миссии».
6. **Save / load.** Сериализация состояния в JSON — тривиальна (см. §3.1). Версионирование state-шейпа не требуется до тех пор, пока не появятся дополнительные поля.

---

## 7. Что меняется в этом PR

- **Создаётся** `src/investigation/interactionModel.ts` — чистый модуль с типами и помощниками из §3.
- **Создаётся** `scripts/smoke-interaction-model.mjs` — smoke-фикстура из §5.
- **Создаётся** этот документ (`docs/EVIDENCE_INTERACTION_PLAN.md`).
- **Изменяется** `package.json`: добавлен скрипт `smoke:interaction`.

**Ничего из существующего UI не трогается.** Файлы `src/investigation/DossierApp.tsx`, `src/investigation/dossier.css`, `src/investigation/dossierMock.ts`, `src/App.tsx`, `src/App.css`, `src/index.css` остаются без изменений. Контент-сиды (`src/game/cases/*`) не трогаются. `src/game/investigation/types.ts` и `src/game/investigation/contentSchema.ts` не трогаются.

`npm run validate:investigation`, `npm run build`, `npm run lint`, `npm run smoke:interaction` проходят чисто.
