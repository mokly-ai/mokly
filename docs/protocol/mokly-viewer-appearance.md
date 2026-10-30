# Viewer Appearance

Status: In progress under the [shell views plan](../../plans/ui-package-shell-views.md).

## One Control In Standalone, Two Inputs When Embedded

The model has two inputs: the interface appearance around previews and the
preview colour scheme inside them. Standalone Browse exposes one control that
sets both, so the catalogue reads all light or all dark. An embedded host
supplies the appearance, and the viewer keeps its own preview control.

| Input                 | Values                  | Standalone Browse                                  | Embedded viewer                                  |
| --------------------- | ----------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Interface appearance  | `auto`, `light`, `dark` | **Appearance** control and saved preference        | `theme` prop; `auto` when omitted                |
| Preview colour scheme | `light`, `dark`         | Follows the effective appearance; no other control | `selection.colorScheme` and the preview controls |

The effective appearance resolves Auto through the browser's
`prefers-color-scheme`, including changes while open; a browser that reports no
preference resolves to Light. Explicit Light or Dark wins over the system.
Auto is the default in both contexts.

In standalone Browse the effective preview scheme equals the effective
appearance. Dark shows each entry's dark views where they exist, so the
catalogue, its device screens, component samples and comparisons change
together; a Markdown document, rendered once per scheme with no viewport axis,
opens its dark render. A screen with no dark view keeps its light frames and
the fallback caption when the catalogue has dark views elsewhere; a catalogue
with no dark views shows light previews with no captions under a dark
interface. That light-only fallback does not change the document's effective
Dark appearance: the shell renders under the Dark appearance while its preview
selection independently normalizes to the available Light views. The
standalone top bar, head band and component workspace carry no separate
preview scheme control.

In an embedded root, `selection.colorScheme` keeps its preview meaning and
stays independent of `theme`: a dark interface around a light preview and the
reverse are both supported, and the viewer's preview controls remain. A host
that wants previews to follow its application theme passes a matching
`defaultSelection.colorScheme` or controls the selection.

`ViewerSelection.colorScheme`, `InstanceRef.colorScheme` and the colour-scheme
fields of the index, the details and the comparison formats keep their preview
meaning everywhere. The index, the details, the comparison formats and the
adapter wire carry no appearance field.

## Changed Preview Indicators

A change confined to another preview scheme marks the standalone Appearance
selector with the shared change dot and an `Other theme changed` description.
The viewport dropdown keeps the separate other-viewport indicator. Embedded
viewers mark their Dark preview control instead. The active workspace supplies
both controls from one entry-owned evidence and view resolution, including
Light fallback and later detail updates. Leaving a workspace clears its mark;
no control depends on a second evidence fetch.

## React API

The `@mokly/viewer` package exports a documented `ViewerTheme` type:

```ts
export type ViewerTheme = "auto" | "dark" | "light";
```

`MoklyViewerProps` carries `theme?: ViewerTheme`. Omission means Auto. This is
an independent presentation prop, not a member of selection or an imperative
selection operation. Unsupported values from untyped JavaScript resolve to
Auto; they do not invalidate the index.

```tsx
<MoklyViewer
  index={indexUrl}
  detail={(path, snapshotId) => detailUrl(path, snapshotId)}
  theme="dark"
  defaultSelection={{ screenPath: null, colorScheme: "dark" }}
/>
```

Embedded hosts own their appearance controls and persistence, normally passing
the same theme as their surrounding application. The embedded viewer adds no
second application appearance selector, `defaultTheme`, change callback, router
state or storage access. Hosts may place their own control in an existing slot.
The viewer's own preview controls stay, and their accessible names and tooltips
identify **Preview color scheme** or **Dark preview** rather than saying Dark
mode. Changing or removing `theme` takes effect on the mounted root at once.

Apply the theme to loading, unavailable-selection, error/retry and ready roots.
Changing `theme` preserves the runtime, frame elements and sessions, selected
entry, comparison mode, temporary props, inspector disclosure/width,
navigation and scroll. It emits no selection, navigation or pick events and
does not cancel active picking or lose highlights and markers. Geometry
updates may run when needed, without triggering fragment requests or
comparison generation. An explicit mode is present in the root's first render;
Auto resolves through CSS, with no script guess and no light render before
dark styling.

## Standalone Appearance Control

Serve and the static build expose one compact native selector labelled
**Appearance**, with **Auto**, **Light** and **Dark** options, in the global
top bar. It is the only scheme control in the standalone shell: there is no
top-bar or head-band `Light | Dark` preview switch and no Dark mode button in
the component workspace, and it is present even when the catalogue has no
dark views. It stays reachable on home, pages, documents, flows, empty and
unavailable routes, and at narrow widths, and preserves catalogue search and
menu access.

Choosing a value applies the interface appearance and the effective preview
scheme together: the shell root's appearance mark, every screen and flow
frame's light or dark document swap, component samples and comparison frames.
The swap rules apply unchanged, including the light-only fallback caption.
In-shell navigation, Back and Forward keep the current reader choice, even
when the destination URL contains an older or conflicting `scheme` pin.
Before any reader choice, a scheme-bearing in-shell destination applies its
pin to the whole appearance without saving it; an unpinned destination keeps
the current document appearance. Only the appearance controller interprets
these pins; route installation never independently overwrites preview
selection. A standalone appearance change swaps only document sources and
keeps the navigation, viewport, inspector, scroll and search state.

On a full page load the effective appearance is resolved in this order: a
`scheme` URL parameter of `light` or `dark` pins the appearance for that
document without saving it; otherwise a valid stored override applies;
otherwise Auto. A user selection wins for the lifetime of the current
document, replacing a URL pin, even if storage is unavailable. A link without
`scheme` follows each reader's own appearance, so two readers can see
different views; a link with `scheme` shows the same views to everyone.

Standalone preferences use the origin-local key `mokly:theme`. Store only
explicit `light` or `dark`; selecting Auto removes the override. Invalid
stored values are ignored. Read, write and remove failures do not break
navigation or show a catalogue error. No credentials or cookies are involved.

The shell bundle resolves the effective appearance before its first render,
as the [shell delivery contract](./mokly-shell-delivery.md) requires: the
shell root carries the appearance mark from its first render, and every frame
mounts with the document of the effective preview scheme. No frame loads a
light document and swaps to dark at startup, and no pre-paint script exists.
Under Auto the appearance follows system changes while the document is open.
Later choices and system changes update the shell root and the preview
selection together, and only the frame adapters navigate preview documents.
Appearance changes never add iframe history entries or consume catalogue
Back/Forward actions. A second installation of the appearance behaviour
duplicates no callback or storage write. A page that the browser's
back-forward cache restores refreshes its appearance. In-shell navigation,
detail updates and Serve publications carry the current effective appearance
forward rather than a separate preview state.

Before the bundle runs, and without JavaScript, the stub shows only its
`<noscript>` sentence. The shell stylesheet gives the stub's document class
the Auto interface appearance through `prefers-color-scheme`. The selector
exists only once the bundle installs its behaviour, so no control without a
change handler is ever shown. Persisted overrides need the bundle.

## Palette And Ownership

The [shared UI package](./mokly-ui-package.md#theme-and-host-pages) owns the
one semantic palette, which supplies both the standalone shell stylesheet and
the embedded stylesheet. Dark interface backgrounds, text and boundaries align
with Mokly Cloud's warm neutral Folio palette, with sage reserved for accents
and status. The [semantic palette](./mokly-viewer-palette.md#cloud-alignment)
records the role mapping, the approved swatches and their recorded contrast;
the cloud repository is a design reference, not a runtime dependency.

Provide Light and Dark values for these responsibilities:

- Background, surface, raised and hover/selected surfaces; primary, secondary,
  muted and disabled text; decorative and interactive borders; focus indicators.
- Accent fills, contrast text, tint and text links; Added, Changed, Removed and
  Ignored status text/background pairs; validation and unavailable states.
- Navigation guides, stage dots, browser toolbar/address controls, tooltips,
  backdrops, shadows, inspector tabs, native fields and scrollbars.

Theme-dependent colours in the components and stylesheets of the shared UI
package use semantic roles, not a dark-mode override sheet. A
theme-dependent colour literal appears only in a palette definition, including
the roles of fixed device artwork.

Keep the public overrides `--mokly-accent`, `--mokly-accent-contrast` and
`--mokly-accent-soft`. Unset overrides receive the current theme's defaults;
host-supplied values, including inherited values, win in both themes. The
stylesheet builder does not depend on one hardcoded Light fallback set.
Internal tokens and selectors stay private; no general palette API exists.

Embedded theme attributes and CSS stay on each `.mokly-viewer` root. Never
mutate the host's `html`/`body`, neighbouring viewers or slot content. No
rule matches slot content, but CSS inheritance into slots still applies, and
hosts can set their slot content's own appearance. Explicitly themed host
content keeps its styles, including host-owned markers.

Support readable default palettes in both modes: normal text at least 4.5:1,
large text at least 3:1, and required control, state and focus graphics at
least 3:1 against adjacent colours. Decorative hairlines are not control
boundaries. These targets follow
[WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
Consumer overrides keep the consumer contrast responsibility.

Appearance changes no layout or typography. Use full-surface selection,
spacing, icons and normal focus outlines; no left-edge accent rails. Respect
forced colours and reduced motion, without animated theme changes.

## Preview Isolation

The interface and a preview can still differ: an embedded host may pair any
`theme` with any `selection.colorScheme`, and a standalone light-only screen
keeps its light frames under a dark interface. Viewer surfaces, the browser
toolbar and the workspace inspector follow appearance. Phone status and home
indicators, phone-screen surfaces and preview loading surfaces follow that
frame's effective preview scheme. Use independent preview tokens rather than
deriving a light phone's text from dark shell ink. Fixed phone hardware and
traffic-light artwork keep their intended colours.

One preview stylesheet owns iframe colour schemes and the opaque backgrounds
behind transparent preview content. Screen, page, component, flow, historical
and comparison canvases use the selected preview's Light or Dark surface;
layout styles must not override them with an interface surface or a fixed
colour. Switching interface appearance alone must preserve the pixels of a
transparent preview, including its loading surface and comparison base.

Set each managed iframe's CSS `color-scheme` to its effective preview scheme
before loading it, including page, document, component, flow and comparison
frames; a page has no scheme axis and keeps the Light context. Frame wrappers
record the selected document's scheme independently of the outer document and
of fallback captions; iframe context, device-screen styling and comparison
bases read that per-frame value. CSS colour scheme can otherwise affect an
embedded document's media queries, even across origins; see
[MDN embedded color schemes](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme#embedded_elements).

Changing the interface appearance alone must not change a preview's media-query
result, document URL, native control appearance, content, or resource requests.
Keep the same-origin and postMessage adapters and sandbox permissions.
Appearance never injects a theme stylesheet into authored documents or
fabricates dark output. Inspection overlays must stay readable over both
preview schemes without restyling the underlying screen.

Preserve Before/Current comparison scheme selection and Difference/Overlay
compositing. Give comparison canvases an opaque base appropriate to their
preview scheme so changing the outer appearance alone cannot change the visual
difference result.

## Mockup Contract

The [appearance mockup contract](./mokly-viewer-appearance-mockups.md) defines
the design screens of the appearance and their owning folders.

## Related Docs

- [Viewer semantic palette](./mokly-viewer-palette.md)
- [Shell device chrome and preview scheme](./mokly-shell-device-chrome.md)
- [Embeddable viewer](./mokly-viewer.md)
