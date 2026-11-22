# Viewer Appearance

Status: The shell has no canvas stage, right panel or Frames filter yet. [Milestone 11](../../plans/canvas-redesign-milestones-viewer.md#milestone-11-canvas-stage-in-moklyui) builds the canvas stage, and [Milestone 12](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds the right panel and its Frames filter.

## Interface Appearance And Frame Schemes

The model has two inputs: the interface appearance around the frames, and the
preview colour scheme of a view that shows one scheme. Standalone Browse
exposes one Appearance control. An embedded host supplies the appearance, and
the viewer keeps its own preview controls.

| Input                 | Values                  | Standalone Browse                           | Embedded viewer                                  |
| --------------------- | ----------------------- | ------------------------------------------- | ------------------------------------------------ |
| Interface appearance  | `auto`, `light`, `dark` | **Appearance** control and saved preference | `theme` prop; `auto` when omitted                |
| Preview colour scheme | `light`, `dark`         | Follows the effective appearance            | `selection.colorScheme` and the preview controls |

The effective appearance resolves Auto through the browser's
`prefers-color-scheme`, including changes while open; a browser that reports no
preference resolves to Light. Explicit Light or Dark wins over the system.
Auto is the default in both contexts.

The [canvas stage](./mokly-shell-canvas-stage.md) shows both schemes at once.
Each frame renders its own scheme's view, whatever the interface appearance: a
screen opens as its Light and Dark frames, and a component opens as its
variant set, with each variant in Light beside Dark. The
[Frames filter](./mokly-shell-canvas-stage.md#frames-filter) in Inspect turns
the Light frames and the Dark frames on and off. It chooses frames and never
changes the interface appearance. A screen with no dark view holds only its
Light frames, and the Frames filter's Dark toggle is disabled and reads Light
only. A Markdown document opens as one reading frame in the preview colour
scheme, so standalone Browse shows the document in the catalogue's
appearance. A view with no dark view keeps its light frames and the fallback
caption when the catalogue has dark views elsewhere; a catalogue with no dark
views shows light previews with no captions under a dark interface. That
light-only fallback does not change the outer document's effective Dark
appearance: the shell renders under the Dark appearance while its preview
selection independently normalizes to the available Light views. A page has no
scheme axis and keeps the Light context.

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

On the canvas stage, a screen and a component show the frames of both
schemes, so the Appearance control marks no change for them. Instead, a
[Frames filter](./mokly-shell-canvas-stage.md#frames-filter) toggle that hides
a changed view carries the shared change dot and names `Other theme changed`
or `Other viewport changed`. A Markdown document shows one preview scheme.
There, a change confined to another preview scheme marks the standalone
Appearance selector with the shared change dot and an `Other theme changed`
description, and the viewport dropdown keeps the separate other-viewport
indicator. Embedded viewers mark their Dark preview control instead. The
active workspace supplies these marks from one entry-owned evidence and view
resolution, including Light fallback and later detail updates. Leaving a
workspace clears its mark; no control depends on a second evidence fetch.

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
The viewer's own preview and frame controls stay. Their accessible names and
tooltips name the frames or the preview scheme, such as **Frames**, **Dark** or
**Dark preview**, and never say Dark mode. Changing or removing `theme` takes
effect on the mounted root at once.

Apply the theme to loading, unavailable-selection, error/retry and ready roots.
Changing `theme` preserves the runtime, frame elements and sessions, selected
entry, comparison mode, temporary props, the Frames filter, the canvas's pan
and zoom, the right panel's tab and sections, navigation and scroll. It emits
no selection, navigation or pick events and does not cancel active picking or
lose highlights and markers. Geometry updates may run when needed, without
triggering fragment requests or comparison generation. An explicit mode is
present in the root's first render; Auto resolves through CSS, with no script
guess and no light render before dark styling.

## Standalone Appearance Control

Serve and the static build expose one **Appearance** control, with **Auto**,
**Light** and **Dark** options, in the global top bar. The
[standalone appearance control](./mokly-viewer-appearance-standalone.md)
defines it: what a choice changes, the `scheme` URL pin, the stored
preference, and the first render.

## Palette And Ownership

The [Canvas palette](./mokly-viewer-palette.md#canvas-palette) of the
`@mokly/ui` palette module is the one semantic palette. The
[shared UI package](./mokly-ui-package.md#theme-and-host-pages) generates its
theme from it, and that theme supplies both the standalone shell stylesheet
and the embedded stylesheet. The [semantic palette](./mokly-viewer-palette.md)
records the role mapping, the values and their recorded contrast. One Canvas
look serves every Mokly surface, the open-source shell included, and no host
package or network request is needed to render it.

Provide Light and Dark values for these responsibilities:

- Background, surface, raised and hover/selected surfaces; primary, secondary,
  muted and disabled text; decorative and interactive borders; focus indicators.
- Accent fills, contrast text, tint and text links; Added, Changed, Removed and
  Ignored status text/background pairs; validation and unavailable states.
- Navigation guides, canvas dots, browser toolbar/address controls, tooltips,
  backdrops, shadows, panel tabs, native fields and scrollbars.

Theme-dependent colours in the components and stylesheets of the shared UI
package use semantic roles, not a dark-mode override sheet. A
theme-dependent colour literal appears only in a palette definition, including
the roles of fixed device artwork.

Keep the public overrides `--mokly-accent`, `--mokly-accent-contrast` and
`--mokly-accent-soft`. Unset overrides receive the current theme's defaults;
host-supplied values, including inherited values, win in both themes. The
stylesheet builder does not depend on one hardcoded Light fallback set.
Internal tokens and selectors stay private. No custom property other than
these three is a theming API, and `@mokly/ui/palette` exports the palette as
data that applies nothing. Decision: one built-in Canvas look, not documented
theme properties for a host's own palette or a second built-in palette that a
host selects (decision 1, options B and E), because one look from one source
cannot drift between the cloud and the open-source shell.

Embedded theme attributes and CSS stay on each `.mokly-viewer` root. Never
mutate the host's `html`/`body`, neighbouring viewers or slot content. No
rule matches slot content, but CSS inheritance into slots still applies, and
hosts can set their slot content's own appearance. Explicitly themed host
content keeps its styles, including host-owned markers.

Support readable default palettes in both modes: normal text at least 4.5:1,
large text at least 3:1, and required control, state and focus graphics at
least 3:1 against adjacent colours. The label of a filled button needs 3:1 on
its fill, as the [Canvas palette](./mokly-viewer-palette.md#canvas-palette)
decides. Decorative hairlines are not control boundaries. These targets follow
[WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
Consumer overrides keep the consumer contrast responsibility.

Appearance changes no layout or typography. Use full-surface selection,
spacing, icons and normal focus outlines; no left-edge accent rails. Respect
forced colours and reduced motion, without animated theme changes.

## Preview Isolation

The interface and a preview often differ: the canvas shows Light and Dark
frames under either appearance, an embedded host may pair any `theme` with
any `selection.colorScheme`, and a light-only screen keeps its light frames
under a dark interface. The floating catalogue and right panel, the frame
labels and size tags, and the browser toolbar follow appearance. Phone status
and home indicators, phone-screen surfaces and preview loading surfaces follow
their frame's scheme. Use independent preview tokens rather than deriving a
light phone's text from dark shell ink. Fixed phone hardware and
traffic-light artwork keep their intended colours.

One preview stylesheet owns iframe colour schemes and the opaque backgrounds
behind transparent preview content. Screen, page, component, flow, historical
and comparison backgrounds use their frame's Light or Dark preview surface;
layout styles must not override them with an interface surface or a fixed
colour. Switching interface appearance alone must preserve the pixels of a
transparent preview, including its loading surface and comparison base.

Set each managed iframe's CSS `color-scheme` to its frame's scheme before
loading it, including page, document, component, flow and comparison frames;
a page has no scheme axis and keeps the Light context. Frame wrappers record
the selected document's scheme independently of the outer document and of
fallback captions; iframe context, device-screen styling and comparison bases
read that per-frame value. CSS colour scheme can otherwise affect an embedded
document's media queries, even across origins; see
[MDN embedded color schemes](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme#embedded_elements).

Changing the interface appearance alone must not change a preview's media-query
result, document URL, native control appearance, content, or resource requests.
Keep the same-origin and postMessage adapters and sandbox permissions.
Appearance never injects a theme stylesheet into authored documents or
fabricates dark output. Inspection overlays must stay readable over both
preview schemes without restyling the underlying screen.

Preserve each frame's Before and Current scheme in a comparison, the Overlay
and Difference compositing, and the Swipe split. Give comparison backgrounds
an opaque base appropriate to their frame's scheme, so that changing the outer
appearance alone cannot change the visual difference result.

## Mockup Contract

The [appearance mockup contract](./mokly-viewer-appearance-mockups.md) defines
the design screens of the appearance and their owning folders.

## Related Docs

- [Viewer semantic palette](./mokly-viewer-palette.md)
- [Standalone appearance control](./mokly-viewer-appearance-standalone.md)
- [Viewer preview palette](./mokly-viewer-palette-preview.md)
- [Shell device chrome and preview scheme](./mokly-shell-device-chrome.md)
- [Embeddable viewer](./mokly-viewer.md)
