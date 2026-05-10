# Art direction

Цель визуала — не «секта как хоррор-клише», а документальная доска дела с мрачной, стильной, слегка сатирической упаковкой инфобизнеса.

## Базовое направление

Рабочее описание:

> Dark investigative dashboard meets glossy self-help marketing.

Игра должна выглядеть как смесь:

- доски расследования;
- кабинета психолога/исследователя;
- интерфейса аналитической системы;
- глянцевого марафона личной эффективности, который постепенно начинает выглядеть тревожно.

## Тон

Можно:

- чёрный юмор в маркетинговом абсурде;
- ирония над псевдоуспешностью;
- тревожные детали в интерфейсе;
- документальная аккуратность.

Нельзя:

- романтизировать вред;
- делать жертв смешными;
- использовать символику реальных радикальных организаций;
- использовать инструктивные криминальные детали.

## Палитра v1

### Интерфейс расследования

- Background: `#020617`
- Panel: `#0f172a`
- Panel highlight: `#1e293b`
- Text main: `#e2e8f0`
- Text muted: `#94a3b8`
- Border: `rgba(148, 163, 184, 0.18)`

### Акценты

- Trust / insight: cyan `#38bdf8`
- Ambition / status: violet `#8b5cf6`
- Risk / harm: orange `#f59e0b`
- Danger / crisis: red `#ef4444`
- Protection / autonomy: green `#34d399`

## Типы ассетов

### Портреты участников

Формат:

- square 1024×1024 source;
- export 512×512 web;
- без знаменитостей;
- semi-realistic / illustrated documentary style;
- нейтральный фон;
- выражение лица не карикатурное.

Нужно v1:

- Аня — выгоревшая офисная сотрудница.
- Илья — начинающий предприниматель.
- Марина — участница после развода.
- Даня — студент.
- Света — опытная участница марафонов.
- Олег — скептик.

### Иллюстрации карт

Формат:

- 3:2 или 4:3 source;
- export 768×512;
- маленькие драматичные сцены, не буквальные инструкции.

Типы:

- practice — глянцевая/мягкая упаковка;
- crisis — тревожная документальная деталь;
- counter — спокойная внешняя опора.

### Иконки метрик

Формат:

- SVG preferred;
- 24×24;
- одноцветные или duotone.

Нужно:

- вовлечённость;
- доверие;
- деньги;
- легитимность;
- вред;
- сомнение;
- видимость;
- контроль лидера;
- радикализация;
- сопротивление;
- автономия;
- зависимость;
- истощение;
- стыд;
- страх.

### Фоны

Нужно:

- главный фон доски дела;
- мягкий фон финального разбора;
- фон сценария инфомарафона;
- later: фоны для других сценариев.

## Prompt-шаблоны

### Портрет участника

```txt
Semi-realistic editorial illustration portrait of [character], dark investigative UI game art, subtle psychological drama, neutral background, soft cinematic lighting, modern Eastern European context, no text, no logo, not caricature, 1:1
```

### Карта практики

```txt
Editorial illustration for a card game about social influence: [scene]. Glossy self-help webinar aesthetic mixed with subtle investigative unease, dark blue and violet palette, no readable text, no logos, cinematic composition, 4:3
```

### Карта кризиса

```txt
Documentary-style illustration for an investigative card game: [scene]. Quiet tension, realistic details, dark interface-friendly palette, no gore, no explicit harm, no readable text, 4:3
```

### Карта защиты

```txt
Calm documentary illustration: [scene]. A person reconnecting with outside support, grounded and humane mood, dark blue palette with green accent, no readable text, 4:3
```

## File naming

```txt
assets/art/participants/participant_anya_v01.png
assets/art/cards/card_opening_broadcast_v01.png
assets/art/icons/icon_trust_v01.svg
assets/art/backgrounds/bg_case_board_v01.png
```

## Workflow

1. Добавить желаемый ассет в `docs/tables/asset_manifest.csv`.
2. Сгенерировать 2–4 варианта.
3. Выбрать лучший.
4. Сохранить source и web export.
5. Подключать в игру только после сжатия.

## Проверка ассета

- Он читается маленьким?
- Он не выглядит как generic stock?
- Он не даёт инструктивных деталей?
- Он подходит под документальный тон?
- Он не делает пострадавшего объектом шутки?
- Он помогает понять состояние/событие?
