# Viewer Appearance

## Delivery Status

This document is the canonical status for viewer appearance. Other protocols
link here rather than restating it.

Both halves are implemented. Embedded: `theme` on `MoklyViewerProps` and
`ServerViewerProps`, applied to every viewer root and resolved for Auto through
CSS; per-frame preview `color-scheme`; and preview controls renamed to name the
preview they change. Standalone: one Appearance selector in the top bar on
every document, the classic `appearance-startup.js` asset that restores the
appearance before the first paint, and the documented precedence over the
`scheme` pin, the stored override and the server-supplied initial theme. The
standalone scheme switches and the workspace Dark preview button are gone from
standalone documents; an embedded root keeps its own preview control.

One package-owned semantic palette carries the recorded swatches and their
three Light corrections, in
[mokly-viewer-palette.md](./mokly-viewer-palette.md). The appearance mockups
are delivered: every appearance entry renders in both schemes, the depicted top
bar component owns the one Appearance control, and the legacy head-band scheme
depictions are gone.

The [dark-mode plan](../../plans/viewer-dark-mode.md) tracks the work.

## One Control In Standalone, Two Inputs When Embedded

The model has two inputs: the interface appearance around previews and the
preview color scheme inside them. Standalone Browse exposes one control that
sets both, so the catalogue reads all light or all dark. An embedded host
supplies the appearance, and the viewer keeps its own preview control.

| Input                | Values                  | Standalone Browse                                  | Embedded viewer                                  |
| -------------------- | ----------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Interface appearance | `auto`, `light`, `dark` | **Appearance** control and saved preference        | `theme` prop; `auto` when omitted                |
| Preview color scheme | `light`, `dark`         | Follows the effective appearance; no other control | `selection.colorScheme` and the preview controls |

The effective appearance resolves Auto through the browser's
`prefers-color-scheme`, including changes while open; a browser that reports no
preference resolves to Light. Explicit Light or Dark wins over the system.
Auto is the default in both contexts.

In standalone Browse the effective preview scheme equals the effective
appearance. Dark shows each screen's dark fragments where they exist, so the
catalogue, its device screens, component samples and comparisons change
together. A screen with no dark render keeps its light frames and the existing
fallback caption when the catalogue has dark fragments elsewhere; a catalogue
with no dark fragments shows light previews with no captions under a dark
interface. That light-only preview fallback does not change the document's
effective Dark appearance: React hydrates from the scheme already applied to
the body while its preview selection independently normalizes to the available
Light files. The standalone top bar, head band and component workspace carry
no separate preview scheme control.

In an embedded root, `selection.colorScheme` keeps its preview meaning and
stays independent of `theme`: a dark interface around a light preview and the
reverse are both supported, and the viewer's preview controls remain. A host
that wants previews to follow its application theme passes a matching
`defaultSelection.colorScheme` or controls the selection.

`ViewerSelection.colorScheme`, `InstanceRef.colorScheme` and catalogue or
rendering color-scheme fields keep their preview meaning everywhere. Appearance
creates no catalogue, manifest, comparison or adapter-wire schema change.

## Changed Preview Indicators

A change confined to another preview scheme marks the standalone Appearance
selector with the shared change dot and an `Other theme changed` description.
The viewport dropdown keeps the separate other-viewport indicator. Embedded
viewers mark their Dark preview control instead. The active workspace supplies
both controls from one route-owned evidence and view resolution, including
Light fallback, selected component variant, and later evidence updates. Leaving
a workspace clears its mark; no control depends on a second evidence fetch.

## React And Server API

The root package exports a documented `ViewerTheme` type:

```ts
export type ViewerTheme = "auto" | "dark" | "light";
```

`MoklyViewerProps` and `ServerViewerProps` each gain `theme?: ViewerTheme`.
Omission means Auto. This is an independent presentation prop, not a member
of selection or an imperative selection operation. Unsupported values from
untyped JavaScript resolve to Auto; they do not invalidate the catalogue.

```tsx
<MoklyViewer
  catalogue={catalogueUrl}
  theme="dark"
  defaultSelection={{ screenId: null, colorScheme: "dark" }}
/>
```

Embedded hosts own their appearance controls and persistence, normally passing
the same theme as their surrounding application. The embedded viewer adds no
second application appearance selector, `defaultTheme`, change callback, router
state or storage access. Hosts may place their own control in an existing slot.
The viewer's own preview controls stay, and their accessible names and tooltips
identify **Preview color scheme** or **Dark preview** rather than saying Dark
mode. Changing or removing `theme` takes effect on the mounted root immediately.

Apply the theme to loading, unavailable-selection, error/retry and ready roots.
Changing `theme` preserves the runtime, frame elements and sessions, selected
variant, comparison mode, temporary props, inspector disclosure/width,
navigation and scroll. It emits no selection/navigation/pick events and does
not cancel active picking or lose highlights and markers. Existing geometry
updates may run when needed, without triggering fragment requests or comparison
generation.

`renderViewer` applies the same prop to embedded static markup and to its
first-party full-document rendering path. On that path an explicit prop
overrides the host context's initial theme, while an omitted prop preserves the
host context. Explicit modes must be present in the initial markup. Auto
resolves through CSS, without a server guess or a client-only light render
before dark styling. Matching server/client inputs must not produce
theme-related hydration differences.

## Standalone Appearance Control

Serve and exported Browse expose one compact native selector labelled
**Appearance**, with **Auto**, **Light** and **Dark** options, in the global
top bar. It is the only scheme control in a standalone document: it replaces
the top-bar and head-band `Light | Dark` preview switch and the component
workspace's Dark mode button, and it is present even when the catalogue has no
dark fragments. It remains reachable on home, pages, flows, empty and
unavailable routes, and at narrow widths, and preserves catalogue search and
menu access.

Choosing a value applies the interface appearance and the effective preview
scheme together: the document's scheme mark, every screen and flow frame's
light/dark fragment swap, component samples and comparison frames. The existing
swap rules apply unchanged, including the light-only fallback caption. In-shell
navigation, Back and Forward keep the current reader choice, even when the
destination URL contains an older or conflicting `scheme` pin. Before any
reader choice, a scheme-bearing in-shell destination applies its pin to the
whole appearance without saving it; an unpinned destination keeps the current
document appearance. Only the appearance controller interprets these pins;
route installation must never independently overwrite preview selection.

On a full page load the effective appearance is resolved in this order: a
`scheme` URL parameter of `light` or `dark` pins the appearance for that
document without saving it; otherwise a valid stored override applies;
otherwise the server-supplied initial theme; otherwise Auto. A user selection
wins for the lifetime of the current document, replacing a URL pin, even if
storage is unavailable. A link without `scheme` follows each reader's own
appearance, so two readers can see different fragments; a link with `scheme`
shows the same fragments to everyone.

Standalone preferences use the origin-local key `mokly:theme`. Store only
explicit `light` or `dark`; selecting Auto removes the override. Invalid stored
values are ignored. Read/write/remove failures do not break navigation or show
a catalogue error. No credentials or cookies are involved.

A small package-owned classic startup asset restores the effective appearance
on the document root before the shell stylesheet can paint, then installs the
selector behavior once the controls exist and, under Auto, follows system
changes while the document is open. When the effective scheme is dark at
startup, it replaces each frame's server-rendered light source before or as
early as possible in that frame's first load, and at most once. The classic
implementation remains outside the React hydration bundle and exposes only a
narrow choose/route/refresh handoff. The standalone browser entry refreshes parsed
markup before hydration, then the shell bridge adopts the effective document
scheme and asks the store for matching preview files; later choices and Auto
system changes update both owners through the same callback. Once the bridge
installs that callback, only React's frame adapters navigate preview documents;
the startup controller no longer assigns their sources. Appearance changes must
not add iframe history entries or consume catalogue Back/Forward actions.
Installation is
idempotent; the final handle release removes both the system-theme listener
and every bound selector listener so a later installation cannot duplicate
callbacks or storage writes.
Persisted `pagehide` events keep the controller alive for the browser's
back-forward cache, and persisted `pageshow` refreshes the restored document;
a final non-persisted `pagehide` disposes it and removes its lifecycle
listeners.
React-owned navigation, evidence refreshes and watched reload recovery carry
the current effective appearance forward rather than a separate preview state.

The asset is listed by the generated browser-output manifest, validated with
the complete build directory, and copied into export inventories. Exported
shell documents use the root-absolute URL
`/__mokly/client/appearance-startup.js`: a root deployment works directly, while
a deployment beneath a URL prefix needs a prefix-stripping hosting mount that
also resolves the export's root-absolute asset routes. Export does not rewrite a
deployment prefix; a `--base-path` option is separate work. The classic asset
contains no React, inline-script/CSP exception or remote dependency; the
separate `react-shell.js` bundle hydrates the server-rendered document.
Without JavaScript, CSS still provides the initial/Auto interface appearance,
frames keep their server-rendered light sources, and the manual selector stays
hidden until its behavior is installed. If the startup asset is missing but
React still hydrates, the selector remains hidden rather than exposing a
control with no change handler. Persisted overrides require the asset.

## Palette And Ownership

One package-owned semantic palette supplies both `SHELL_CSS` and the scoped
embedded stylesheet. Use the existing neutral/sage family, with a dark surface
hierarchy; the cloud marketing site's separate Folio palette is not a runtime
dependency. The approved swatches, their recorded contrast and the Light
corrections they required are the
[semantic palette](./mokly-viewer-palette.md), already implemented in the
appearance mockups.

Provide Light and Dark values for these responsibilities:

- Background, surface, raised and hover/selected surfaces; primary, secondary,
  muted and disabled text; decorative and interactive borders; focus indicators.
- Accent fills, contrast text, tint and text links; Added, Changed, Removed and
  Ignored status text/background pairs; validation and unavailable states.
- Navigation guides, stage dots, browser toolbar/address controls, tooltips,
  backdrops, shadows, inspector tabs, native fields and scrollbars.

Audit literal colors in `src/shell/css_*.ts`, `src/viewer/styles.ts` and
package-owned overlay/control creation. Replace theme-dependent literals with
semantic roles, not a growing dark-mode override sheet. Use a focused source
rule with an explicit allowance for fixed device artwork to prevent new
theme-dependent color literals outside palette definitions.

Keep the public overrides `--mokly-accent`, `--mokly-accent-contrast` and
`--mokly-accent-soft`. Unset overrides receive the current theme's defaults;
host-supplied values, including inherited values, win in both themes. The
stylesheet builder does not depend on one hardcoded Light fallback set.
Internal tokens and selectors remain private; no general palette API is added.

Embedded theme attributes and CSS stay on each `.mokly-viewer` root. Never
mutate the host's `html`/`body`, neighboring viewers or slot content. Existing
scope exclusions remain; ordinary CSS inheritance into slots still applies,
and hosts can set their slot content's own appearance. Explicitly themed host
content must retain its styles, including host-owned markers.

Support readable default palettes in both modes: normal text at least 4.5:1,
large text at least 3:1, and required control/state/focus graphics at least 3:1
against adjacent colors. Decorative hairlines are not control boundaries.
Existing Light colors may change where a touched semantic role fails these
criteria; the three such changes are recorded in the palette contract. These
targets follow
[WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
Consumer overrides retain the existing consumer contrast responsibility.

Keep the established layout and typography. Use full-surface selection,
spacing, icons and normal focus outlines; no left-edge accent rails. Respect
forced colors and reduced motion, without introducing animated theme changes.

## Preview Isolation

The interface and a preview can still differ: an embedded host may pair any
`theme` with any `selection.colorScheme`, and a standalone light-only screen
keeps its light frames under a dark interface. Viewer surfaces, the browser
toolbar and the workspace inspector follow appearance. Phone status/home
indicators, phone-screen surfaces and preview loading surfaces follow that
frame's effective preview scheme. Use independent preview tokens rather than
deriving a light phone's text from dark shell ink. Fixed phone hardware and
traffic-light artwork retain their intended colors.

Set each managed iframe's CSS `color-scheme` to its effective preview scheme
before loading it, including page/component/flow and comparison frames. For
documents without a scheme axis, retain the existing Light context. Frame
wrappers record the selected file's scheme independently of the outer document
and of fallback captions; iframe context, device-screen styling and comparison
bases read that per-frame value. The classic startup updates it before swapping
a fragment source, so the same contract holds before React hydrates. CSS color
scheme can otherwise affect an embedded document's media queries, even across
origins; see [MDN embedded color schemes](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme#embedded_elements).

Changing the interface appearance alone must not change a preview's media-query
result, document URL, native control appearance, content, or resource requests.
Keep existing same-origin and postMessage adapters and sandbox permissions.
Appearance never injects a theme stylesheet into authored documents or
fabricates dark output. Inspection overlays must stay readable over both
preview schemes without restyling the underlying screen.

Preserve Before/Current comparison scheme selection and Difference/Overlay
compositing. Give comparison canvases an opaque base appropriate to their
preview scheme so changing the outer appearance alone cannot change the visual
difference result.

## Mockup Contract

The owning catalogue is `examples/basic/entries/design`, generated under
`examples/basic/generated/design`; use its registered shared components and
existing screen compositions. Appearance screens and their affected shared
component samples publish Light and Dark fragments for both viewports through
Mokly's existing authoring: the entries inherit the configured `colorSchemes`,
`mokly build` writes one file per scheme, and Browse's existing outer preview
control swaps between them at the same entry and route. A shared render context
carries the renderer's `input.colorScheme` to the artboard roots as a
pass-through, not a second theme setting, and each artboard's
`data-mbk-appearance` reflects that requested scheme. Generated pages must not
read the building or viewing machine's system theme; the Auto example uses the
requested scheme as its deterministic system-theme fixture.

Each artboard draws exactly one scheme control: the registered
`chrome/appearance-selector` composed into the top bar. It depicts the delivered
standalone control and has no authored transitions. The depicted top bar
component owns it, so every artboard drawing a top bar shows it rather than
opting in. The depicted screen header carries the viewport control only, with no
preview theme icon, and depicted component toolbars carry no scheme switch. The Auto artboard's selector reads
Auto in both renders; every other artboard's selector reads the name of the
scheme it was rendered for.

Previews follow the artboard. Subjects with a dark render, such as Welcome, the
comparison panes and the flow's first step, use the dark device-screen
treatment in the Dark render and the light one in the Light render. The
light-only Details subject keeps its light frames in both renders and shows the
fallback caption in the Dark render, because that is a fact about the screen.
Device-screen tokens stay independent of the interface palette.

A linked Appearance section sits under Browse, with matching source directories
under `examples/basic/entries/design/browse/appearance/`. Each page's canonical
route is the group's own collection; its children are the owning screens.

| Page                         | Owning screens                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `design/browse/appearance/`  | `overview.html`: the canonical interface around a selected screen, all light or all dark   |
| `.../appearance/states/`     | Auto selector, light-only screen fallback                                                  |
| `.../appearance/workspaces/` | Props validation, selected-instance inspector, navigation drawer, Side by side, Difference |
| `.../appearance/status/`     | Home/empty, catalogue loading, error/retry, Changes unavailable, use-case flow             |

The catalogue hierarchy links the overview to its three child pages; artboards
carry no navigation footer. Each screen has its own mobile and desktop
component and reuses the registered shared components. Do not inline duplicate
screen markup. Keep no more than five owning screen definitions per page. The
exact ids and routes are listed in the
[shell design inventory](./mokly-shell-design.md#design-mockups). The
branch-only `light-preview` and `dark-preview` scenarios are removed by the
single-control correction. `design-browse-dark-scheme`,
`design-browse-light-only` and `design-review-dark-scheme` are removed:
`design-browse-screen`, `design-browse-details-screen` and
`design-review-changed` render in both schemes and subsume them. No design
artboard depicts a separate preview-scheme control, so `controls/view-controls`
carries none and the design catalogue authors no scheme link pairs. Update
inventories, style ownership and example documentation, and keep notes outside
the screens.

## Required Verification

- For the mockups, use the standalone Appearance control to switch Dark → Light
  → Dark on the same entry in both viewports. Assert actual fragment URLs, computed
  artboard colors, the depicted previews' treatment, the light-only caption and
  the absence of a second scheme control. Validate all four generated variants.
- Test effective-appearance resolution, preference normalization, the `scheme`
  URL pin, storage failures, startup ordering and cleanup; SSR markup and
  exports; missing-startup fail-closed behavior; back-forward-cache restoration;
  semantic contrast and inherited accent overrides.
- In standalone browsers, cross Auto/Light/Dark with mixed and light-only
  catalogues at both widths, including live system changes under Auto, a
  `scheme` pin, pinned navigation and Back/Forward after Light or Auto choices,
  clean Dark hydration for a light-only catalogue, component
  samples and comparison frames. In embedded browsers,
  cross Light/Dark `theme` with Light/Dark previews and light-only catalogues,
  including native/media-query-driven preview fixtures for both adapters.
- Test Auto changes, explicit overrides, theme-prop updates, two independent
  embedded roots, host/slot isolation and loading/error/retry transitions.
- Verify an embedded `theme` change causes no frame reload, selection event,
  lost props, ended pick or marker loss. Verify a standalone appearance change
  swaps only fragment sources and preserves navigation, viewport, inspector,
  scroll and search state.
- Exercise keyboard selection, focus, forced colors, mobile drawer/inspector,
  hover/disabled/error states, expanded frames and comparison compositing.
- Smoke Serve, saved appearance after full/watched reload, root/subpath exports,
  SSR first paint and packaged React/SSR consumers. Run the repository gate.

During standalone hydration, the workspace adopts the server-rendered status,
comparison availability and change marks for its first React render. It then
recomputes that metadata from the active preview selection immediately after
hydration. The early appearance script already selected the preview files;
this metadata handoff preserves those frames and avoids rebuilding the shell
when stored Dark appearance differs from the server's initial Light evidence.
