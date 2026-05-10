# Cult Sim Prototype

Кликабельный MVP для карточной доски деструктивной группы.

Стартовый сценарий: инфоцыганский марафон личной эффективности.

## Что уже есть

- React + TypeScript + Vite.
- 6 участников с потребностями, уязвимостями, защитными факторами и состояниями.
- Карты недели с нейтральной внешней семантикой и скрытыми тегами.
- Шкалы группы: вовлечённость, доверие, деньги, легитимность, вред, сомнение, видимость, контроль лидера, радикализация, сопротивление.
- Комбо-правила: обычные практики складываются в деструктивные паттерны.
- Журнал событий, красные флаги и финальный разбор.

## Команды

```bash
npm install
npm run dev
npm run build
npm run lint
```

Перед каждым PR обязательно прогонять:

```bash
npm run build
npm run lint
```

## Архитектура

```txt
src/game/types.ts   # типы карт, участников, эффектов и состояния игры
src/game/data.ts    # стартовые участники, карты и комбо
src/game/engine.ts  # применение карт, комбо и расчёт финала
src/App.tsx         # интерфейс доски
src/App.css         # визуальный слой
```

Контент специально вынесен в `src/game/data.ts`, чтобы дальше добавлять новые карты, сценарии и кейсы без переписывания интерфейса.

## Studio docs

Рабочие документы проекта:

- [Roadmap](docs/ROADMAP.md) — путь от прототипа до Яндекс Игр и дальше.
- [Backlog](docs/BACKLOG.md) — ближайшие задачи и приоритеты.
- [Agent brief](docs/AGENT_BRIEF.md) — что должен помнить следующий агент.
- [Metrics](docs/METRICS.md) — игровые, продуктовые и контентные метрики.
- [Content model](docs/CONTENT_MODEL.md) — правила карт, участников, комбо и финалов.

Рабочие таблицы:

- [Card balance](docs/tables/card_balance.csv)
- [Participant matrix](docs/tables/participant_matrix.csv)
- [Combo rules](docs/tables/combo_rules.csv)
- [Finale matrix](docs/tables/finale_matrix.csv)
- [Analytics events](docs/tables/analytics_events.csv)

## Ближайший фокус

Не прыгать сразу в продакшен и сторы. Сначала:

1. playable vertical slice;
2. сохранения;
3. контент в JSON;
4. мобильный UX;
5. Yandex Games SDK adapter;
6. публикация MVP на Яндекс Играх;
7. только потом Google Play / iOS.
