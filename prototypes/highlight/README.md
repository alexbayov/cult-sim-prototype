# Drag-highlight interaction prototype

A self-contained HTML/JS demo of the **drag-highlight gesture** that will
power the Wave 4 investigation game (see `docs/GAME_DESIGN.md` §4.1 and §4.2
on the design-pivot branch). Not loaded by the game, not imported by any
`src/` code, not part of `npm run build`. Production wiring of this gesture
into the real workspace is Dev δ's job — this file's purpose is to give Dev δ
a battle-tested interaction to port, plus a written list of UX gotchas
discovered while building it.

## How to view

```bash
open prototypes/highlight/index.html         # macOS
xdg-open prototypes/highlight/index.html     # Linux
start prototypes/highlight/index.html        # Windows
```

No build, no server, no npm install. Just `file://` it.

Verify both modes work:

- **Chrome desktop** (1024+ wide). Default mode should resolve to `desktop`
  via `(hover: hover) and (pointer: fine)`. Drag-select any phrase inside a
  message; the phrase wraps in a yellow `<mark>` and appears in the right
  panel labelled `range-<start>-<end>`.
- **Chrome DevTools mobile emulator** — DevTools → device toolbar →
  **iPhone 14 (390 × 844)** → reload. Default mode should resolve to
  `mobile`. Tap any message bubble to highlight the whole paragraph (label
  `abz-<msgId>`). Tap again to remove. Drag-select is disabled in this mode
  (`user-select: none` on the doc panel).
- **Manual override** — the **auto / desktop / mobile** switcher in the
  header forces a mode regardless of the matchMedia probe. The chosen mode
  is persisted in `localStorage` under `highlight-prototype:mode`.

## Sample document

A neutral filler chat between «Мать» and «Сын» — ~14 messages over three
days, mixing short replies and longer ones. Message #11 is intentionally a
single very long paragraph (5 sentences, ~110 words) so the mobile
tap-on-paragraph UX edge case is testable. **None** of the forbidden case-01
or audit-flagged vocabulary appears (`шум`, `улика`, `доказательство`,
`паттерн`, `red herring`, `фрейм`, `love bombing`, `coercive control`,
`секта` — all zero matches).

## Known limitations of the prototype

These are intentional and documented; **production must fix them**:

- **Range capture assumes a single-paragraph selection.** If the user drags
  across two `<p>` elements (e.g. starting in message 3 and ending in
  message 4), the prototype refuses the selection silently (returns `null`
  from `captureRange`). Production should either (a) clamp to the start
  paragraph or (b) split into N highlights, one per paragraph.
- **Range capture only supports the prototype's flat text-node tree.** The
  offset walker handles the case where a paragraph already contains
  `<mark>` children from previous highlights, but it has not been tested
  with inline `<em>`, `<a>`, emoji-as-image, or anything else more
  structured than what the sample doc uses. Production documents will need
  the same logic generalised to the actual rich content tree.
- **No keyboard accessibility.** Tab does not navigate between highlights,
  arrow keys do not extend selection, Backspace does not remove the focused
  highlight. Production must add these — the gesture is currently
  mouse/touch-only, which is an accessibility hole.
- **No long-press fallback on mobile.** Tap is the only mobile gesture. A
  long-press → finer range selection would let advanced mobile users do
  sub-paragraph highlights. Out of scope here, but worth considering.
- **No undo / redo.** The `✕` button on each panel entry is the only way to
  remove a highlight. A keyboard shortcut and a session-level Undo stack
  are obvious production must-haves.
- **`Selection.toString()` quirks on iOS Safari.** Observed: trailing space
  is sometimes included when the user lifts their finger over the gap
  between two text nodes. Prototype calls `.trim()` on the captured text
  before storing, which is a workaround but means the stored
  `start`/`end` offsets can disagree with the visible text by ±1 char.
  Production should pick one source of truth (the offsets, probably) and
  derive the displayed text from them on every render, instead of storing
  both.
- **Mode switch does not migrate highlights.** Highlights captured in
  `desktop` mode survive a switch to `mobile`, and vice versa — including
  the now-inappropriate label format (`range-127-189` shown while in mobile
  mode, etc.). Production should either clear on mode switch or normalise
  both to a single internal shape.

## UX observations

These are what Dev δ should mine when designing the real workspace.

1. **Triple-click already selects a whole paragraph.** On desktop, a triple
   click on any message body natively selects all the text in that `<p>`
   and our `mouseup` handler captures it correctly — same outcome as the
   mobile tap. Recommendation: treat triple-click as equivalent to the
   mobile gesture and store it as `paragraph` rather than `range`, so the
   two surfaces produce identical underlying data. Right now the prototype
   stores it as a range, which means the same logical highlight has two
   different shapes depending on which device produced it.
2. **Tap-highlighting an entire 5+ line paragraph (message #11) feels
   heavy.** The yellow fill covers a quarter of the mobile viewport and
   visually dominates. Recommendation: on mobile, show a **confirmation
   strip** at the bottom of the screen ("Сохранить в блокнот?") instead of
   colouring the whole paragraph immediately. The colour fill could happen
   after confirmation. This also gives the player a graceful exit if they
   tapped a paragraph by accident — currently mistapping is recoverable
   only via the `✕` in the panel, which is two extra interactions.
3. **The 390 × 844 layout is tight.** The bottom-sticky highlights panel
   eats ~140 px (max-height), leaving ~600 px for the document. That's
   3-4 messages visible at once. Acceptable for the prototype but the
   production workspace likely needs **collapsible** highlights — show a
   one-line "3 фрагмента" rail by default; expand on tap. Otherwise the
   panel competes with the document for the player's attention exactly
   when they should be reading.
4. **Mobile users want to know which paragraphs are highlighted at a
   glance.** Scrolling through 14 messages to find what you've already
   marked is awkward when the panel only shows the captured text. A small
   coloured strip on the LEFT edge of each highlighted message (in
   addition to the paragraph fill) would let the player skim. The
   prototype does NOT do this — Dev δ should consider it.
5. **`<mark>` styling reads as "search hit" on desktop.** A bright yellow
   highlight is the same visual treatment Chrome uses for in-page Find
   matches. That's fine for a prototype but the production workspace
   should use a more distinctive treatment (e.g. an underline + a dotted
   left border + a softer fill) so the gesture has its own visual
   identity. The «выделил для блокнота» metaphor is not the same as
   «нашёл через поиск».
6. **The label format `range-127-189` is debug-grade.** It's useful here
   because we want to see what was captured, but it leaks implementation
   detail (character offsets) at the player. Production should drop it
   from the surface and only render the highlighted text + a small "из
   сообщения от 12 окт" provenance line. The offsets stay in the data
   layer.
7. **Removing a highlight via the panel is one click; restoring it is
   impossible.** Combined with the no-undo limitation, this means a
   misclick irrecoverably loses the player's reading work. Production
   should add at minimum a session-level "вернуть удалённое" affordance,
   even if it's a single Cmd/Ctrl+Z.

## Recommendations for production (Dev δ)

**Adopt as-is:**

- The `closestMsgBody` / `offsetWithinBody` walker pattern. It handles the
  "paragraph already has prior `<mark>` children" case correctly, which is
  the non-obvious bit.
- The `Set<paragraphHighlight> + sorted/merged ranges per paragraph` shape
  for the highlights state. Re-rendering the doc panel from scratch on
  every change is fast enough at this size and keeps the rendering logic
  trivial.
- The auto/desktop/mobile switcher pattern (`matchMedia('(hover: hover) and
  (pointer: fine)')` plus a manual override stored in `localStorage`).
  The matchMedia probe is correct for actual touch devices AND for
  desktop browsers in mobile-emulator mode.
- The mobile mode's `user-select: none` on the doc panel. Without it, an
  accidental long-press triggers the native selection menu and competes
  with the tap gesture.

**Redesign before porting:**

- **Single-paragraph clamp.** Either support multi-paragraph drag
  selections (clamp or split) or surface a clear error state. Silent
  refusal is the wrong default for production.
- **Mobile gesture confirmation strip** (see UX observation #2).
- **Visual identity for highlights** (see UX observation #5).
- **Collapsible highlights panel on mobile** (see UX observation #3).
- **Provenance line per highlight** in the panel — message date + speaker —
  instead of the debug-grade label (UX observation #6).
- **Keyboard support** — Tab to focus a highlight, Backspace to remove, Cmd/Ctrl+Z
  to undo. Required for accessibility and for power users.

**Add before shipping:**

- Per-hypothesis slot wiring (the actual workspace from §4.2 — this
  prototype validates the gesture, not the drop target).
- The `KeyPhrase` intersection check from §4.1 — i.e. on submit, walk the
  highlights and check which ones intersect any `keyPhrase.range`.
- Touch-and-hold fallback on mobile.
- Telemetry hooks (optional but cheap to add early).
