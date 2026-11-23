# Comparison Scroll Together

Status: Scroll together in Swipe and on every frame of the canvas is not built yet. The [right panel and compare milestone](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds it.

## Reader Control

The Scroll together switch is a native `input type="checkbox"` with
`role="switch"`. Its visible label, accessible name, and product copy are all
**Scroll together**. The [Changes tab](./mokly-changes-controls.md#changes-tab)
places it after the mode tiles and before Refresh in every compare mode other
than Current, including loading or failure states. Current has no switch. The
switch is on by default.

The standalone shell of Serve and the static build stores `on` or `off` under the origin-local key
`mokly:comparison-scroll-together`; missing, invalid, or unreadable means on,
and a failed write leaves the in-memory choice active. The standalone shell
reads the stored choice once before its first render. Embedded viewers never access
browser storage: each mounted viewer keeps the choice across routes,
comparisons, and source replacement for that mount. It resets to on after the
viewer root remounts; independent roots have independent choices.

- In Side by side, on mirrors page viewports and paired regions; off leaves
  each version's page and regions independent. Each page viewport still drives
  and clamps only its own document, and both page viewports keep the pair
  maximum range.
- In Overlay, Difference, and Swipe, on mirrors paired regions. Off stops
  region mirroring, but the page still has one structural offset because both
  layers remain in one page viewport and its lower layer has no separate page
  scrollbar.
- Current has one version, so the hidden preference has no behavioral effect.

Changing the switch applies to the open comparison without refetching,
re-presenting, or reloading a pane. Turning it off performs no write and leaves
every page and region exactly where it settled. While it is off, the viewer
still tracks the last-scrolled version, but it writes no counterpart offsets.

### Design Geometry

The design catalogue draws a 12.5px label in `--cv-text-secondary` that fills
the row, followed by an 8px gap and a 32×18px pill track with a 1px border and
a 12px knob inset 2px. On uses `--cv-signal-deep` for the track and its border
and `--cv-surface` for the knob at the far end; off uses `--cv-surface` for
the track and `--cv-border-strong` for its border and knob at the start. A
keyboard-focused control draws a 2px `--cv-signal-deep` ring 2px outside the
track, and the transparent checkbox covers the whole control. The runtime
switch draws these [palette](./mokly-viewer-palette.md) values in each
appearance. It never uses the consumer-tunable `--mokly-accent-contrast`. The
knob has a border, so forced colours keep it visible without opting out.

Every Canvas artboard in a compare mode other than Current shows the switch
on, and its off state toggles in place; Current shows none.

## Last-Scrolled Version

Track one last-scrolled version, Before or Current, per open comparison; every
compared view of that comparison shares it. A non-echo page, document, or
region offset change owns it; Side by side assigns each page viewport to its
sole version, and a pointer press, wheel, touch, key, or focus that begins in a
pane document, or an anchor followed there, assigns that pane. Dragging a
stack's one shared scrollbar has no version and leaves the owner unchanged.
Viewer writes, echoes, measurement reapplication, clamping, and switch-on
realignment never change it. Initialize it to Current, or Before when Current
does not exist, so the no-scroll case is deterministic.

## Realignment

Turning the switch on uses that version as authority. For each compared view
independently, copy its page offset to every other version, then visit all of
its inner regions in document order, resolve any match not cached since the
last measurement with the
[normal algorithm](./mokly-comparison-region-pairing.md), and copy both settled
offsets to every counterpart. This includes zero offsets, so a counterpart is
reset when the authoritative region is at its start. When several views are
compared, they share the chosen version, but the offsets of one view are never
copied to another view. A missing authoritative version in one view falls back
to the version that exists there.
