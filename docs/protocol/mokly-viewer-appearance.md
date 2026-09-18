# Viewer Appearance

## Delivery Status

Designed, not implemented. The [dark-mode plan](../../plans/viewer-dark-mode.md)
tracks this target for `@mokly/viewer`, local Serve and static exports. The
mockups under `design/browse/appearance/` and the
[semantic palette](./mokly-viewer-palette.md) are delivered; the current
[viewer](./mokly-viewer.md) and [shell design](./mokly-shell-design.md) remain
light-only around previews until the runtime implementation lands.

## Two Independent Settings

| Setting              | Values                  | Default                | Affects                                                                 |
| -------------------- | ----------------------- | ---------------------- | ----------------------------------------------------------------------- |
| Viewer appearance    | `auto`, `light`, `dark` | `auto`                 | Package-owned interface around previews                                 |
| Preview color scheme | `light`, `dark`         | Existing Light default | Authored screen/component fragments and preview-specific device details |

Auto follows the browser's `prefers-color-scheme`, including changes while
open; no preference resolves to Light. Explicit Light or Dark wins over the
system. Appearance works even when a catalogue has no dark fragments.

`ViewerSelection.colorScheme`, `InstanceRef.colorScheme`, the `scheme` URL
parameter and catalogue/rendering color-scheme fields keep their preview
meaning. Appearance creates no catalogue, manifest, comparison or adapter-wire
schema change. A dark interface with a light preview and the reverse are both
supported. Light-only previews retain their real light document and fallback
label under a Dark preview selection.

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
  defaultSelection={{ screenId: null, colorScheme: "light" }}
/>
```

Embedded hosts own their appearance controls and persistence, normally passing
the same theme as their surrounding application. The embedded viewer adds no
second application appearance selector, `defaultTheme`, change callback, router
state or storage access. Hosts may place their own control in an existing slot.
Changing or removing `theme` takes effect on the mounted root immediately.

Apply the theme to loading, unavailable-selection, error/retry and ready roots.
Changing appearance preserves the runtime, frame elements and sessions, selected
variant, comparison mode, temporary props, inspector disclosure/width, navigation
and scroll. It emits no selection/navigation/pick events and does not cancel
active picking or lose highlights and markers. Existing geometry updates may
run when needed, without triggering fragment requests or comparison generation.

`renderViewer` applies the same prop to embedded static markup and to its
first-party full-document rendering path. Explicit modes must be present in
the initial markup. Auto resolves through CSS, without a server guess or a
client-only light render before dark styling. Matching server/client inputs
must not produce theme-related hydration differences.

## Standalone Appearance Control

Serve and exported Browse expose one compact native selector labelled
**Appearance**, with **Auto**, **Light** and **Dark** options, in the global
top bar. It remains reachable on home, pages, flows, empty and unavailable
routes, and at narrow widths. Preserve catalogue search and menu access.

Preview controls retain their current behavior and eligibility. Their
accessible names/tooltips must identify **Preview color scheme** or
**Dark preview**, rather than ambiguously saying Dark mode. Do not combine the
two settings or duplicate the preview selector across visible controls.

Standalone preferences use the origin-local key `mokly:theme`. Store only
explicit `light` or `dark`; selecting Auto removes the override. On a full
page load, a valid stored override wins over the server-supplied initial theme;
otherwise use that initial theme, defaulting to Auto. A user selection wins
for the lifetime of the current document even if storage is unavailable.
Invalid stored values are ignored. Read/write/remove failures do not break
navigation or show a catalogue error. No credentials or cookies are involved.

A small package-owned classic startup asset restores the preference on the
document root before the shell stylesheet can paint. It then installs the
selector behavior once the controls exist. Keep that asset out of the React
entry's execution path. Installation is idempotent and provides cleanup for
installed listeners. Progressive navigation, evidence refreshes and watched
reload recovery must not overwrite the current appearance with preview state.

The asset is served through the existing explicit allowlist and included in
export inventories, with portable URLs at root and subpath deployments. Do not
add inline-script/CSP exceptions, React, hydration or remote assets to exports.
Without JavaScript, CSS still provides the initial/Auto appearance; hide the
manual selector until its behavior is installed. Persisted overrides require
the startup asset.

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
stylesheet builder must stop depending on one hardcoded Light fallback set.
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
criteria; the three such changes are recorded in the palette contract. These targets follow
[WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
Consumer overrides retain the existing consumer contrast responsibility.

Keep the established layout and typography. Use full-surface selection,
spacing, icons and normal focus outlines; no left-edge accent rails. Respect
forced colors and reduced motion, without introducing animated theme changes.

## Preview Isolation

Viewer surfaces, the browser toolbar and the workspace inspector follow
appearance. Phone status/home indicators, phone-screen surfaces and preview
loading surfaces follow that frame's effective preview scheme. Use independent
preview tokens rather than deriving a light phone's text from dark shell ink.
Fixed phone hardware and traffic-light artwork retain their intended colors.

Set each managed iframe's CSS `color-scheme` to its effective preview scheme
before loading it, including page/component/flow and comparison frames. For
documents without a scheme axis, retain the existing Light context. CSS color
scheme can otherwise affect an embedded document's media queries, even across
origins; see [MDN embedded color schemes](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme#embedded_elements).

Changing appearance must not change a preview's media-query result, document
URL, native control appearance, content, or resource requests. Keep existing
same-origin and postMessage adapters and sandbox permissions. Appearance never
injects a theme stylesheet into authored documents or fabricates dark output.
Inspection overlays must stay readable over both preview schemes without
restyling the underlying screen.

Preserve Before/Current comparison scheme selection and Difference/Overlay
compositing. Give comparison canvases an opaque base appropriate to their
preview scheme so changing the outer appearance cannot change the visual
difference result.

## Mockup Contract

The owning catalogue is `examples/basic/entries/design`, generated under
`examples/basic/generated/design`; use its registered shared components and
existing screen compositions. Theme context must be explicit per artboard so
examples remain deterministic and independent of the outer viewer's appearance.
Design artboards may retain their `colorSchemes: ["light"]` generation policy
while depicting either shell appearance through that explicit context.

A linked Appearance section sits under Browse, with matching source directories
under `examples/basic/entries/design/browse/appearance/`. Each page's canonical
route is the group's own collection; its children are the owning screens.

| Page                         | Owning screens                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `design/browse/appearance/`  | `overview.html`: the canonical dark interface holding a light preview                      |
| `.../appearance/states/`     | Light/light, light/dark, dark/dark, light-only fallback, Auto selector                     |
| `.../appearance/workspaces/` | Props validation, selected-instance inspector, navigation drawer, Side by side, Difference |
| `.../appearance/status/`     | Home/empty, catalogue loading, error/retry, Changes unavailable, use-case flow             |

The catalogue hierarchy links the overview to its three child pages; artboards
carry no navigation footer. Each screen has its own mobile and desktop
component and reuses the registered shared components, including a registered
`chrome/appearance-selector` composed into the top bar. Do not inline duplicate
screen markup. Keep no more than five owning screen definitions per page.
Existing light-shell/dark-preview destinations stay valid. The exact ids and
routes are listed in the [shell design inventory](./mokly-shell-design.md#design-mockups).
Update inventories, style ownership and example documentation, and keep notes
outside the screens.

Artboards select their appearance explicitly through a `data-mbk-appearance`
attribute on the artboard root, so a generated design page never follows the
appearance of the browser showing it.

## Required Verification

- Test preference normalization, storage failures, startup ordering and cleanup;
  SSR markup and exports; semantic contrast and inherited accent overrides.
- In browsers, cross Light/Dark appearance with Light/Dark previews, both
  viewports and light-only catalogues. Include native/media-query-driven preview
  fixtures for both adapters and comparison frames.
- Test Auto changes, explicit overrides, theme-prop updates, two independent
  embedded roots, host/slot isolation and loading/error/retry transitions.
- Verify no frame reload, selection event, lost props, ended pick or marker
  loss during appearance changes; retain preview-switch replacement behavior.
- Exercise keyboard selection, focus, forced colors, mobile drawer/inspector,
  hover/disabled/error states, expanded frames and comparison compositing.
- Smoke Serve, saved appearance after full/watched reload, root/subpath exports,
  SSR first paint and packaged React/SSR consumers. Run the repository gate.
