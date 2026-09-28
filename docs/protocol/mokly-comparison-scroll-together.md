# Comparison Scroll Together

## Delivery Status

The [comparison pane scroll alignment plan](../../plans/comparison-pane-scroll-alignment.md)
delivered this reader control in Milestone 7. It decides whether the versions
of an open comparison scroll together under the
[comparison scrolling contract](./mokly-comparison-scrolling.md). The
[shell design](./mokly-shell-design.md#in-place-comparisons) fixes how the
switch is drawn and placed. The runtime implements it in
`packages/viewer/src/shell/comparison_toolbar.tsx`,
`comparison_scroll_preference.ts`, `use_scroll_together.ts`,
`comparison_scroll_owner.ts`, and the section controller
`comparison_scroll_sync.ts`.

## Reader Control

The comparison toolbar places a native `input type="checkbox"` with
`role="switch"` immediately after the comparison-mode group and before
Refresh. Its visible label, accessible name, and product copy are all
**Scroll together**. It is visible in Side by side, Overlay, and Difference,
including loading or failure states, and absent in Current. It is on by default.

Standalone Serve and export store `on` or `off` under the origin-local key
`mokly:comparison-scroll-together`; missing, invalid, or unreadable means on,
and a failed write leaves the in-memory choice active. A standalone document
reads the stored choice once; its server markup and hydration render show the
switch on and the stored choice follows at once, so hydration never
mismatches. Embedded viewers never access
browser storage: each mounted viewer keeps the choice across routes,
comparisons, and source replacement for that mount. It resets to on after the
viewer root remounts; independent roots have independent choices.

- In Side by side, on mirrors page viewports and paired regions; off leaves
  each version's page and regions independent. Each viewport still drives and
  clamps only its own document, and both spacers keep the pair maximum.
- In Overlay and Difference, on mirrors paired regions. Off stops region
  mirroring, but the page still has one structural offset because both layers
  remain in one chrome and its lower layer has no separate page scrollbar.
- Current has one version, so the hidden preference has no behavioral effect.

Changing the switch applies to the open comparison without refetching,
re-presenting, or reloading a pane. Turning it off performs no write and leaves
every page and region exactly where it settled. Matching and last-scroll
tracking continue while off, but counterpart writes are suppressed.

## Last-Scrolled Version

Track one last-scrolled version, Before or Current, per open comparison; every
viewport section of that comparison shares it. A non-echo page, document, or
region offset change owns it; Side by side assigns its viewport to its sole
version, and a pointer press, wheel, touch, key, or focus that begins in a pane
document, or an anchor followed there, assigns that pane. Dragging a stack's
one shared scrollbar has no version and leaves the owner unchanged. Viewer
writes, echoes, measurement reapplication, clamping, and switch-on realignment
never change it. Initialize it to Current, or Before when Current does not
exist, so the no-scroll case is deterministic.

## Realignment

Turning the switch on uses that version as authority. For each viewport
section independently, copy its page offset to every other version, then visit
all of its inner regions in document order, resolve any match not cached since
the last measurement with the
[normal algorithm](./mokly-comparison-region-pairing.md), and copy both settled
offsets to every counterpart. This includes zero offsets, so a counterpart is
reset when the authoritative region is at its start. When Both is shown, the
chosen version is shared but mobile and desktop offsets are never copied to
each other. A missing authoritative version in one section falls back to the
version that exists there.

## Acceptance

`tests/browser/comparison_regions_switch.spec.ts` proves placement, copy,
default, the drawn states, keyboard focus, forced colours, the narrow layout,
and the loading and failure states;
`comparison_regions_toggle.spec.ts` proves the off behavior in Side by side,
Overlay, and Difference, realignment to the version scrolled last, no pane
reload, persistence across screens and reloads in Serve, invalid values, and a
refused write; and `comparison_regions_hosts.spec.ts` proves persistence in a
static export and a storage-free, mount-scoped choice in an embedded viewer
through both frame adapters, across screens and source replacement. Unit
tests under `packages/viewer/tests/` cover the preference stores, the toolbar
markup, and the controller's off, on, and ownership rules.
