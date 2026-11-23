# @mokly/ui

`@mokly/ui` holds every element and every stylesheet of the Mokly Browse
shell: its components, its theme, and its layout. It also holds the named
palettes of the Mokly design language as typed data. `@mokly/viewer` composes
the components into the shell that Serve, the static build, and React hosts
render, and the design mockup catalogue under `examples/basic` renders the same
components. Depend on this package only when you render one of its components
or read a palette yourself; a host that embeds a catalogue uses
`@mokly/viewer`, which depends on this package at the exact shared version.

## Responsibilities

- Every element of the shell: the markup, the styles, and the local
  interaction of each component, with props in and callbacks out. The viewer
  renders no element of its own.
- Every style rule of the shell: the theme, the reset class `mbk-reset`, one
  CSS file beside each component, the shell layout, and the rules of the
  embedded root.
  Every rule stays outside every cascade layer, and `styles.css` holds them
  all.
- The highlight mask that marks component instances over a preview, drawn from
  the boxes that the viewer's frame adapters return.
- The named palettes: the colours of the light and dark schemes and the font
  stacks of each palette, as data that applies nothing. The theme stylesheet
  and the palette part of the `mokly-html` Markdown style are generated from
  the Canvas palette, so no component reads the module itself.
- Nothing else. A component reads no store, no context, no catalogue read
  model type, no network, and no history. It renders the `<iframe>` element of
  a preview but never reads the frame's document. React and React DOM are the
  only peers.

## What This Package Does

Each component is a subpath export, such as `@mokly/ui/appearance-selector`,
and `@mokly/ui/styles.css` is the only stylesheet subpath. `@mokly/ui/palette`
is the one subpath that is not a component. The package has no root entry.
`styles.css` holds the rules of every component; a component's own stylesheet
leaves out the components it renders, such as the change mark of the
appearance selector. The viewer bundles `styles.css` into its own `shell.css`
and `styles.css`, so a delivery or a host loads one stylesheet as before. A
shell container that needs the store stays in `@mokly/viewer` and renders
package components.

The theme declares the shell's tokens, such as `--chrome-surface`, and the
Light and Dark palette on the viewer root class `mbk` and on the standalone
stub's document class `mbk-document`, never through a `:root`, `html`, or
`body` selector. It is generated from the Canvas palette: it declares every
Canvas role as a `--cv-*` property, such as `--cv-signal`, and each shell
token takes its value from a Canvas role, a mix of two, or a fixed value. A
root states its appearance in `data-mokly-theme`; Auto follows the reader's
system. Each component puts the reset class `mbk-reset`
on every element that it renders, apart from the host slots, whose content
stays the host's. The class gives the element border-box sizing and the
reader's reduced motion, resets links and text blocks, and gives a focusable
element the focus glow. No rule reaches the host page or host slot content. A
host that renders a component outside a viewer root puts it inside an element
with the viewer root class, or declares the tokens itself, as the design
catalogue's `examples/basic/design.css` does.

`@mokly/ui/palette` exports `palettes`, each named palette by its name, with
its types. A palette gives the `PaletteColors` of its `light` and `dark`
schemes, and its `fonts`: the `sans` and `mono` stacks. Each colour is an
opaque `#rrggbb` value: the surfaces `background`, `surface`,
`surfaceRaised`, and `surfaceMuted`, the grid's `dot`, the inks `text`,
`textSecondary`, and `textMuted`, the lines `border` and `borderStrong`, the
signal roles `signal`, `onSignal`, `signalSoft`, and `signalDeep`, the button
pair `signalFill` and `onSignalFill`, and in `people` the `fill` and `ink` of
each person colour. The inks and `signalDeep` read at 4.5:1 on every surface,
as do the labels on `signal` and on each person colour; `borderStrong` and the
button label reach 3:1. A test holds each pair. `canvas`, the look of a design
file, is the only palette. It names Geist and Geist Mono but ships no font
file, so a page that draws in it loads the faces itself: the viewer delivers
them for the shell, and `examples/basic/design-fonts/geist.css` loads them for
the design catalogue. The module applies nothing: a consumer declares the
values in its own terms, such as the custom properties of a stylesheet, as the
generated theme does.

```ts
import { palettes } from "@mokly/ui/palette";

const { background, text, signalFill } = palettes.canvas.light;
```

## Quick Start

```tsx
import { AppearanceSelector } from "@mokly/ui/appearance-selector";
import "@mokly/ui/styles.css";

export function Toolbar() {
  return (
    <AppearanceSelector
      value="auto"
      changed={false}
      changedId="toolbar-appearance-changed"
      changedText="Other theme changed"
      onChange={(theme) => console.log(theme)}
    />
  );
}
```

`changed` shows the change mark, and `changedId` names its wording, which the
select's `aria-describedby` points at while the control is marked. By default
the select is uncontrolled, so `value` is only its first choice. A host that
keeps the appearance in its state sets `controlled`, and the select then
shows `value` at every render.

`ComparisonToolbar` renders its modes as toggle buttons that report through
`onMode`. A host that runs no script, such as a static mockup, passes
`modeHref` to draw each mode that has an address as a link, and
`interactive={false}` to draw the other modes as inert text and Refresh as a
picture of itself. The link or the text of the shown mode is marked as the
current page. Scroll together stays a native switch in every band. The mode
group renders the package's segmented control, and the package stylesheet
gives a link and inert text the line box and centring of a button.

`TopBar`, `CatalogueNavigation`, and `ScreenHeader` draw controls that act
through a script. A static mockup gives `TopBar` a `brandHref`, which draws
the brand as a link, and sets `interactive={false}`, which draws a brand
without an address as a picture of itself and leaves out the compact search.
The bar draws no menu, also in a static mockup, because the dock opens the
catalogue's sheet; its `drawerOpen`, `navigationId`, and `onDrawer` props
stay for earlier hosts and change nothing. It gives `CatalogueNavigation` a
`filterHref`, which draws each filter that has an address as a link, and sets
`operable={false}`, which draws Collapse all and the other filters as text and
the separator as a picture of its grip. The link or the text of the shown
filter is marked as the current page. A tree row without an address is a
picture of the row. On `ScreenHeader`, `interactive={false}` draws the path
chip as a picture of itself and a folder crumb as text.

A static mockup gives `TagChip` an `href`, which draws the chip as a link, and
sets `interactive={false}`, which draws a chip without an address as a
picture of itself. It gives `TagPicker` a `toggleHref` and each tag an `href`,
which draw the button and the chips as links, and sets `operable={false}`,
which draws the button and each chip without an address as pictures. Behind a
link or a picture nothing can open a closed picker, so the picker leaves its
closed panel out. `renderChip` draws each chip through the host's own
component, so that the design catalogue records each chip. On `ViewControls`,
`interactive={false}` draws each toggle as `IconSwitch`, a native switch with
the button's look, which acts in place as the native viewport select does.

`CatalogueNavigation` renders the column around `CatalogueTree`, which draws
plain records that the host builds: sections, folders, entries, and the
variants and members of an entry's list, each with its keys, label, depth,
address, and open, hidden, and changed states. Each disclosure choice reaches
`onDisclosure` with its key and its new open state, and the resize separator
reports widths through `onWidth` and `onWidthCommit`. A double click restores
`startingWidth`, 252px by default, or asks a host that passes `onWidthReset`
to forget the chosen width. While the Changes filter shows, the foot names
the comparison `base`. `TopBar` takes the tag
picker and the end control as slots. An embedded root also gives it `host`,
the `TopBarHost` containers of its three top-bar slots: the bar places the
start slot after the brand, the centre slot in its middle column, and the end
slot after the end control, and a bar with host slots draws the mark alone.
The search field shows a key hint before the tag picker, a picture of the keys
that `searchShortcut` names: `⌘K` by default, or `Ctrl K` for `control`. The
hint hides below the layout breakpoint. The field of an interactive bar names
the search keys, `⌘K`, Ctrl+K, and `/`, to assistive technology through
`aria-keyshortcuts`, and its host binds them.
`ScreenHeader` takes the view's status and controls as slots.

`TagPicker` draws the tag button of the search field and the picker that it
opens. The host holds the open state and the focused chip. It receives the
open state, each step of the focus, and each chosen tag through callbacks,
and the picker keeps the roving focus of its chips, Escape, and the focus
return to its button. `TagChip` is the toggle chip of one tag, which an
entry's details also draw. `ViewControls` takes the viewport, the preview
scheme, the highlight state, and the change marks of its controls as props,
and draws them with the 34px `IconButton` and `IconSelect`. `ChangeStatus`
shows an entry's change status beside its title.

`Inspector` draws the workspace inspector: its tabs, the open tab's title and
panel, and Close. The host holds the open state and the open tab, and it
receives each choice through `onOpenChange`. The inspector keeps the arrow
keys, Home, and End of its tabs, and Close returns focus to the tab that the
reader pressed last. The `InspectorHandle` that `ref` receives closes the
inspector in the same way, such as on Escape anywhere in the host's shell,
moves focus to a tab through `focusTab`, and names its element. The host holds
the inspector's size: `height`, `minimumHeight`, and `maximumHeight` give the
height on a desktop and the separator's value, `expanded` the state of the
narrow sheet, and `sheetHeight` the sheet's height during a drag. The host
attaches its drag and its keys to the separator and the sheet grab through
`resizeRef` and `grabRef`. In the right panel of the Canvas layout the
inspector takes the height of its content, and the layout's stylesheet hides
the separator and the grab. `DetailsPanel` draws
the collapsible Details below a page's stage, and `DetailsBody` the body that
it and the Details tab show. `MetadataRow` draws one labelled value, as a row
of the metadata column or, in its `props` presentation, as a `dt` and `dd`
pair, and `MetadataCode`, `MetadataLink`, `MetadataChips`, and `EntryChip`
draw the values of a row. `PropField` draws one field of the Props tab with
the native control of its kind; its help and its error take the ids
`{id}-help` and `{id}-error`. `ControlsPanel` and `SavedPropsPanel` draw the
edit form and the saved props, and `EditStatus` draws the status of a render
of edited props over the preview. `PropsPanel`, `UsageList`, and
`InstanceTree` draw the Props, Usage, and Components tabs from plain records,
and `ComparisonEvidence` draws the comparison facts of an entry's Details in
the designs' order. The host supplies each text that it derives from the
catalogue, and the controls' wording, which the design catalogue shares.
`TextButton` is the text button of these panels.

`CanvasStage` draws the canvas of the wide layout: a full-bleed dot grid that
holds one section, with the zoom pill at the bottom centre of its stage. The
canvas keeps its view, the zoom and the position of the section, itself, so a
pan or a zoom renders the canvas alone and not the host's tree. The host
reaches the view through the `CanvasStageHandle` that `ref` receives: `fit`,
`zoomIn`, `zoomOut`, `zoomTo`, `zoomAt`, and `run`, which runs the command
that `canvasKeyCommand` gives for a key. `zoomAt` multiplies the zoom by a
factor about a point of the page, which keeps its place, for a wheel or a
pinch that a frame's document forwards. The host listens for the keys where
they belong, such as on a whole document or on one root, and a later control,
such as a dock's Fit, uses the same handle. `wheelZoom` gives the zoom after a
wheel distance, at the canvas's own rate, and `wheelPixels` counts a wheel's
lines and pages in pixels as the canvas's own wheel does, for a host that
zooms the canvas from input that it receives elsewhere. The host passes the
section as
`section`, a `CanvasSection` without its reading size, and names it with
`fitKey`: a new name fits the canvas again, a fitted canvas refits when its
stage or the section's lengths change, and `onViewChange` hears of each pan,
zoom, and Fit. The stage is the canvas less `--mbk-canvas-inset-top`,
`--mbk-canvas-inset-end`, `--mbk-canvas-inset-bottom`, and
`--mbk-canvas-inset-start`, each 0 until a layout sets it, and less the zoom
pill's room. The canvas measures an invisible box of that size, so a change
of an inset refits like a resize. The canvas takes the drags, wheels, and
pinches around the frames, Safari's `gesturestart`, `gesturechange` and
`gestureend` included, and cancels the page's own zoom for each gesture; a
frame's document keeps its own. Below the layout breakpoint the canvas has no
zoom pill and no pill room, and a section with `compact` draws no box and no
head, leaves only its frames' labels' room, and Fit stands it at the stage's
top.

`FloatingPanel` draws a panel that floats over the canvas at its `side`, the
catalogue at the left or the right panel at the right, and below the layout
breakpoint is a bottom sheet: it shows only while its `sheet` is open, at its
compact or expanded height, with a grabber, the size toggle that a press or a
drag switches, and a close control, which `noun` names, such as `Close
catalogue`. A `label` makes the panel a region, and `scroll` makes its body
scroll its content. `CanvasDock` draws the compact layout's dock, a group
named `Canvas controls` with Catalogue, the right panel's current tab, and
Fit, each from its callback, and gives Catalogue and the tab to the host's
refs. `EntryBar` draws the compact layout's entry bar: the title tag, the
`Component` kind tag, the status slot, an optional `quietLabel`, such as
"Showing previous version", and the frame picker, a native select named
`Frame` of the `picker`'s frames. The dock and the entry bar show below the
layout breakpoint only.

`CanvasSection` draws the section: the box of a screen, a document or a use
case, or the dashed outline of a component's variant set, its head with the
title tag, the `Component` kind tag, the path chip that reports `onCopyPath`,
the status slot and an optional `quietLabel`, such as "Showing previous
version", and its frames in a grid. Each frame takes its cell from its `column`
and `row`. A `hidden` frame stays mounted, with its document, but takes no
room in the grid or in Fit. `section-layout.ts` holds the padding, the gaps,
and the reading size, which the section draws and Fit reads, so the two
agree. A use case's section leaves more room at its top, for each step's
description. `CanvasFrame`
draws one bare frame at its nominal `width` and `height` times the canvas's
zoom, `--mbk-canvas-zoom`, with its label and size tag, and holds its
document at the nominal size, scaled. A nominal size can hold a fraction of a
pixel, as a component's measured document does: the size tag reads whole
pixels, rounded, and the document's box rounds the size up, so the document
fits without a scrollbar and the frame clips the fraction. A frame too narrow
for its label and its size tag drops the tag. A reading frame has no tag and takes the reading size
that its section gives. A use case's step frame takes the step's number as
`step`, which leads the label in a dark tag that reads `Step 1`, a `link`,
which makes its name a link with a chevron and an accessible name of the
host's, and a `description`, which reads muted below the label. Its label
keeps room around the link for the focus glow. `lightOnly` adds `Light only`
after the name. `focusVisible` draws the focus glow on the frame's box while
the host reports keyboard focus inside the frame's document. `place` replaces the document with what stands in the frame's
place: the place keeps the frame's size and label, draws a dashed outline and
no surface, ring, shadow or size tag, and holds its content unscaled.
`CanvasMissingView` puts the note of `PreviewNotCaptured` there for a view
that was never captured, and hides its second sentence while the host says
that a frame of the other viewport shows. `CanvasState` draws the canvas
without a section, so without the pill, and holds a state, such as an
`EmptyState`, in a card in the middle of the stage. `CanvasPreviousVersion`
is the host of a removed entry's previous version, which carries
`data-mokly-preview` and announces each state. `CanvasZoomPill` draws the
pill, a group named Zoom, from the zoom and three callbacks, and
`CanvasIcon` the canvas glyphs on the
Canvas design's 16-unit grid. The canvas parts mix their rings, fills, and
shadows from the Canvas roles through `light-dark()`, so they follow the
colour scheme that the shell root states for its appearance.

`Stage` draws the dotted stage of a preview, which a removed entry's previous
version and the static depictions of the earlier stage keep.
`PreviewFrame` draws one frame on
it: the wrapper that records the scheme of the shown render, the viewport's
label with the `LightOnlyNote` of `scheme-fallback`, and the lines of a
preview that is unavailable or that failed to load. The failed line shows Try
again when the host passes `retry`: a callback, or an address in a static
depiction. `DocumentFrame` hosts a
whole document, and `PreviewIframe` is the `<iframe>` element itself, always
sandboxed without scripts. The host passes the frame's `ref`, its `src` or
`srcDoc`, its `key`, and its data attributes in their order, and it loads and
reads the frame's document; no component reads it. `PhoneFrame` and
`BrowserFrame` draw the device chrome, and the window draws its bar with
`BrowserBar`. A press on the address reaches `onCopy` and shows "URL copied"
for a moment, and the toggle asks for the expanded state through
`onExpandedChange`, because the host owns which window is expanded.

`FlowStage` and `FlowStep` draw a user flow's column of steps and
`PreviousVersion` a removed entry's band and stage host, which the design
catalogue still draws; the viewer shows both on the canvas. `StageLoading`,
`StageFailure`, `PreviewLoading`, `PreviewUnavailable`, and
`PreviewNotCaptured` draw the states of a preview that has not arrived.
`EmptyState` draws the quiet state of a
stage, and `HomeState`, `MissingRouteState`, `RemovedState`, and
`RemovedVariantState` the shell's own. `ComparisonStage` draws the comparison
of an entry around the band that the host renders, with its sections, panes
grid, and failure. `ComparisonPane` and `ComparisonLayer` draw one version,
and `ComparisonViewport` and `ComparisonSurface` pass their elements to the
host's scroll controller through refs. `VariantBar` draws a component's saved
variants. The host supplies the wording of its copy modules, such as the
unavailable previous version and the comparison's state labels.

A state that a host focuses after Try again takes a ref: `focusRef` on
`StageLoading`, `PropsStatus`, `UsageStatus`, `UsageList`, and the loading
`RootState`, and `stageRef` on `ComparisonStage`. Each element then takes
`tabindex="-1"`, so that a script can focus it and Tab skips it.

`ShellLayout` draws the standalone shell's root, which states its appearance
and its preview scheme: the skip link, the top bar, and the body with the
navigation and the `MainRegion`, and the `RouteStatus` that announces each
navigation. `EmbeddedLayout` draws an embedded root with
the same parts and its host's slots. With `catalogueSheet` both roots draw
the Canvas layout: the main region is the canvas, the catalogue, or an
embedded root's rail host with its slots, floats over it in a
`FloatingPanel`, the `dock` floats at the canvas's bottom, and
`navigationWidth` sets the catalogue's width that the canvas's start inset
follows. The main region is the containing block of a view's right panel and
entry bar, and a right panel in it sets the canvas's end inset. Without
`catalogueSheet` the navigation stands in a column, as a static depiction of
the earlier layout draws it. `HomeState` and `MissingRouteState` with
`canvas` stand in a card on the canvas. Its `topBar` function receives the
containers of the three top-bar slots, which the bar places in its columns.
It places each slot's content
without reading it, keeps the host's stage overlay over the shown preview,
and takes the host's `MarkerLayer` and label layer. The shown preview is a
workspace's preview, or the routed canvas that holds a use case's section or
a document's reading frame. `WorkspaceLayout` lays out
a workspace's preview with its `entryBar` and the right `panel` that holds
the header, the variant bar, and the inspector, or, without a panel, the
header and the variant bar above the preview beside the inspector.
`RootState` takes a root's place while its catalogue loads, cannot be loaded, or needs a
compatible viewer, or when the requested view is unavailable, as the
`EmptyState` of the standalone root or of an embedded root, with the root class
and the root's appearance. `LabelLayer` and
`HighlightLabel` draw the labels of highlighted instances. `HighlightMask`
draws the dimmed layer with a cutout and an outline for each box, in the
colours of the `--mbk-highlight-scrim` and `--mbk-highlight-edge` roles.
The masks, the label layers and an embedded root's marker layer lie over the
canvas and under its floating chrome: the zoom pill, the entry bar, the
dock, the floating panels and the top bar cover them, as they cover the
frames.

Both roots mark the state that the stylesheets select on the root. `resizing`
names the separator that the reader drags, so the whole shell keeps the
drag's cursor.

The package gives a host each element that the host measures, focuses, or
scrolls through a ref. `WorkspaceLayout` gives its preview pane and its panes
to `previewRef` and `panesRef`. `BrowserFrame`, `FlowStage`, `DocumentFrame`,
`Stage`, and `MainRegion` give their element to `ref`, and `Inspector` its
panels' region to `contentRef`. `CanvasStage` gives its canvas, which clips
its frames, to `canvasRef`. `TagPicker` gives its button and its picker to
`toggleRef` and `pickerRef`, and `ViewControls` its Highlight components
button to `highlightRef`. `CatalogueNavigation` gives the current page's row
to `currentRowRef`, and each section and folder summary, by its disclosure
key, to `summaryRef`. `EmbeddedLayout` names each host slot's container
through `slotRef`. `TopBar` gives its `TopBarHandle` to `ref`: `focusSearch()`
moves focus to the search field, and where the compact search hides the
field, it opens the compact search first, whose field then takes focus.

A static mockup sets `disclosures` on `Inspector`, which draws each tab as a
native disclosure of one group, named by `contentId`: a tab opens its panel
and closes it again without a script, one tab at a time, and Close is part of
the open tab. A tab with an `href` is a link, which is its one keyboard stop.
The resize separator is then a picture of its grip, and the sheet's grab is a
native switch that `expanded` starts checked, which a host stylesheet reads to
size the sheet. `PropFieldFrame` frames a native control that the mockup draws
itself in the field's label column, Set check box, Not set line, help, and
error. An optional field draws both its control and its Not set line under
`data-native-supply`, and the package stylesheet shows the one that matches
the Set check box. `TextButton` with an `href` is a link with the button's
look, and the controls panels take `resetHref`, `retryHref`, `startHref`, and
`currentHref`, which draw Reset while the props differ, the alert's action, a
failed start's action, and Switch to Current as links. `PropsStatus` and
`UsageStatus` take `retryHref`, which draws Try again of a failed load as a
link. `InstanceTree` draws an
instance with an `href` as a link with the button's look, whose selected one is
the current page, and starts with the nested lists that `initiallyExpanded`
names open.

A static mockup sets `interactive={false}` on `BrowserFrame` or `BrowserBar`,
which draws the bar as a picture of itself: the address copies nothing, the
toggle is a picture named by what it would do, and neither takes the pointer
or the hover look. On `EmptyState`, `interactive={false}` draws an action
without an `href` as a picture of itself. A `VariantBar` variant without an
`href` is a picture of its link that keeps the link's look and its current
mark.

A static mockup cannot measure its preview, so it gives `HighlightMask` its
width, its height, and its boxes as SVG lengths, such as `100%` or
`calc(100% - 48px)`, which the drawing resolves against its area, and it gives
`HighlightLabel` its place as CSS lengths. `HighlightLabel` with an `href` is a
link with the label's look, which `current` marks as the current page, and
`interactive={false}` draws a label without an address as a picture of itself
that keeps the arrow.

## Development

From the repository root, `npm run build` builds this package before the
viewer. `npm run typecheck` includes it. Tests live under `tests/` and run with
`npm test -- packages/ui/tests/<file>`. A test that mounts a component imports
`tests/dom.ts` first, which registers a happy-dom window for Testing Library.
Compare DOM nodes with the helpers of `tests/dom-assertions.ts`, not with
`assert.equal`: a failed comparison formats a happy-dom node, which runs out
of memory. File names are kebab-case, such as `top-bar.tsx` exporting
`TopBar`. A lint
checks the rule only for the JavaScript and TypeScript files under `src/` and
`tests/` and for the directories that hold them. A component imports only
`react`, `react-dom`, and the other components of this package by relative path;
a lint holds that rule too.

The design library and the design artboards under `examples/basic/specs/design`
import each package component that they show, with its stylesheets, from
`src/` by repository path, not from `dist`: the base side of a Changes
comparison renders from Git, which holds no build output. A change here
therefore also changes their design mockups, so run the mockup check of
[`AGENTS.md`](../../AGENTS.md) after it. The Canvas design family there
imports the palette module by repository path too, and
`@mokly-cloud/tokens` imports `@mokly/ui/palette` for the Canvas drawings of
the cloud mockups under `docs/mockups`. After a change of a palette value,
also run the check that the [mockups README](../../docs/mockups/README.md)
gives.

Two stylesheets are generated from the Canvas palette and committed: this
package's `src/theme/theme.css`, and the repository's
`crates/mokly-html/src/document_palette.css`, the colours and fonts of the
Markdown documents. Each starts with a header that names its source. Do not
edit either file. Change the palette module, or the role table in
`scripts/palette-roles.mjs` for a role without a Canvas source, then run
`npm run palette:generate` from the repository root and commit both files. The generator computes each mix in sRGB, as `color-mix()` does, and
formats each file with Prettier, so the bytes pass `npm run format:check`.
`npm run palette:check` writes nothing; it names each file that differs from
the module or is missing, and exits 1. The repository suite runs it. The
generator is not part of `npm run build`.

A component lives in `src/<name>/`: `<name>.tsx`, and `<name>.css` when it has
styles. Its subpath in the `exports` map is `./<name>`, with `types` and
`import` targets in `dist/<name>/`. The build copies
`<name>.css` beside the JavaScript. The palette module keeps the same layout
without a stylesheet: `src/palette/palette.ts` under the `./palette` subpath.
Each stylesheet keeps its rules outside every cascade layer, so neither an
element reset nor a host layer overrides a component rule, and a host rule
competes with them by specificity and order; a test holds the rule.

A component's own rules name its `mbk-` classes, so they match only its
elements. A rule whose selector names only generic class names, such as
`.address` or `.browser-frame`, adds `:where(.mbk-reset)` to its subject: the
rule then weighs the same and still never matches a host element that carries
the same class name. Give each new element the reset class, last in its class
list, and give no rule a selector of the page or of a bare element; the
viewer's styles test holds both stylesheets to that.

Keyboard focus draws the focus glow that the
[shell design](../../docs/protocol/mokly-shell-design.md#focus) requires. The
reset class declares its two shadows: `--mbk-focus-glow` outside the box and
`--mbk-focus-glow-inset` inside it, both in the shell accent at 75%. Its
baseline rule gives each focusable element the outer glow in place of the
browser's outline, and a 2px `Highlight` outline in forced colours. The rule
weighs one pseudo-class, so a component's own focus rule wins. Write such a
rule for a control that draws a shadow of its own, and repeat that shadow
after the glow, as the shown segment of a segmented control does. Write one
for a control in a container that clips or scrolls, which draws the inset
glow, as a catalogue row does on its pill. Write one for a drawn control
under a transparent native control, which shows the glow with `:has()` and
adds its own forced-colours outline. The baseline rule leaves a search input
to its field, so the top bar's search field draws its input's glow the same
way. A focus rule sets only the shadow, so the baseline keeps the
forced-colours outline. `palette.test.ts` holds the glow at 3:1 on each
surface in both appearances.

Shell widths use `px` or `em`, not `rem`, unless a protocol contract requires
`rem`. A `rem` length follows the root font size of the page. A host page that
embeds the viewer sets that size, so a `rem` width can change from host to
host. An `em` width follows the element's own font size instead. The
[responsive behaviour](../../docs/protocol/mokly-shell-device-chrome.md#responsive-behavior)
requires the two `rem` queries, the layout breakpoint at `56.25rem` and the
panel step at `73.75rem`, and the viewer's styles test holds the package to
them. The drawer of a navigation column without a floating panel keeps
`max-width: 20rem`, the one `rem` width, for a static depiction of the
earlier layout; the
[compact layout](../../docs/protocol/mokly-shell-device-chrome.md#compact-layout)
replaces that drawer with sheets.

`src/styles.css` sets the order of `styles.css`. It lists the component
stylesheets with one `@import` each, in cascade order: the theme and the reset
class, the shared controls, the components, then the layout and its
responsive rules. The build
concatenates the stylesheets in that order. A component stylesheet that the
list omits joins the end in name order, with a build warning. Add each new
stylesheet to the list at its place in the cascade. A later rule of equal
specificity overrides an earlier one, as the narrow-width layout rules
override the desktop layout rules.

### Key Code

- [`src/theme/theme.css`](./src/theme/theme.css) — generated: the Canvas
  roles, the tokens, and the Light and Dark palette on the root class and the
  stub's document class, Auto through the system appearance, and the stub
  page's own rules
- [`scripts/palette-generate.mjs`](./scripts/palette-generate.mjs) — the
  command behind `npm run palette:generate` and `npm run palette:check`:
  `generatePaletteStylesheets` writes each generated stylesheet that differs,
  or reports it in a check
- [`scripts/palette-styles.mjs`](./scripts/palette-styles.mjs) —
  `themeStylesheet` and `documentPaletteStylesheet`, the renderers from a
  palette to CSS text, and `paletteStylesheets`, the generated files by path
- [`scripts/palette-roles.mjs`](./scripts/palette-roles.mjs) and
  [`scripts/palette-sources.mjs`](./scripts/palette-sources.mjs) — the source
  of each generated role, with the fixed values of the roles without a Canvas
  source, and the sRGB mixes, tints, and shadows that the sources compute
- [`src/reset/reset.css`](./src/reset/reset.css) — the reset class: border-box
  sizing, the reader's reduced motion, the link and text block resets, and
  the focus glow with its baseline focus rule and forced-colours outline
- [`src/palette/palette.ts`](./src/palette/palette.ts) — `palettes`, the named
  palettes, with the `PaletteColors`, `PaletteFonts`, and `Palette` types;
  `canvas` is the only palette and the source of the generated stylesheets
- [`src/icons/icons.tsx`](./src/icons/icons.tsx) — the shell glyphs and the
  workspace control icons, with `IconSvg` as their frame; the icons entry
  also exports `BrandIcon` and `CanvasIcon`
- [`src/change-mark/change-mark.tsx`](./src/change-mark/change-mark.tsx) —
  `ChangeMark`, the dot and the screen reader wording that mark a view control
  whose other view changed
- [`src/appearance-selector/appearance-selector.tsx`](./src/appearance-selector/appearance-selector.tsx)
  — `AppearanceSelector`, the Auto, Light, and Dark control of the standalone
  shell
- [`src/comparison-toolbar/comparison-toolbar.tsx`](./src/comparison-toolbar/comparison-toolbar.tsx)
  — `ComparisonToolbar` and its `ComparisonMode`: the mode group, the Scroll
  together switch, and Refresh, as buttons or as the links and inert text of
  a static band
- [`src/segmented-control/segmented-control.tsx`](./src/segmented-control/segmented-control.tsx)
  — `SegmentedControl`, the named group of segments that the viewport and
  scheme switches and the comparison modes render, as buttons or as the links
  and inert text of a static depiction
- [`src/top-bar/top-bar.tsx`](./src/top-bar/top-bar.tsx) — `TopBar`,
  `TopBarHost`, and `TopBarHandle`: the three columns with the brand, the
  catalogue search with its compact form, its focus return, and the handle
  that moves focus to it, and an embedded root's top-bar slots
- [`src/top-bar/search-hint.tsx`](./src/top-bar/search-hint.tsx) —
  `SearchHint`, the search field's key cap of `⌘K` or `Ctrl K`, and the
  `SearchShortcut` that it names
- [`src/top-bar/top-bar-links.tsx`](./src/top-bar/top-bar-links.tsx) — the
  brand, as a control, a link, or a picture
- [`src/top-bar/brand-icon.tsx`](./src/top-bar/brand-icon.tsx) — `BrandIcon`,
  the Mokly mark, whose parts the top bar's stylesheet colours
- [`src/catalogue-navigation/catalogue-navigation.tsx`](./src/catalogue-navigation/catalogue-navigation.tsx)
  — `CatalogueNavigation`: the column, the All and Changes filter, the status
  line, the foot of the comparison base, and the resize separator with its
  drag and keys
- [`src/catalogue-tree/catalogue-tree.tsx`](./src/catalogue-tree/catalogue-tree.tsx)
  — `CatalogueTree`: the sections, folders, entry rows with their changed
  mark, and entry lists, drawn from the records of `tree-records.ts`
- [`src/screen-header/screen-header.tsx`](./src/screen-header/screen-header.tsx)
  — `ScreenHeader`: the breadcrumb trail, the title, and the path chip
- [`src/tag-picker/tag-picker.tsx`](./src/tag-picker/tag-picker.tsx) —
  `TagPicker`: the tag button of the search field and its picker, with the
  roving focus of the chips, Escape, and the focus return
- [`src/tag-picker/tag-picker-toggle.tsx`](./src/tag-picker/tag-picker-toggle.tsx)
  — the picker's button, as a control, a link, or a picture of a static
  depiction
- [`src/tag-chip/tag-chip.tsx`](./src/tag-chip/tag-chip.tsx) — `TagChip`, the
  toggle chip of one tag; its stylesheet holds the rules of every chip
- [`src/view-controls/view-controls.tsx`](./src/view-controls/view-controls.tsx)
  — `ViewControls`: the viewport select, the Dark preview toggle, and the
  Highlight components toggle, with their change marks
- [`src/icon-control/icon-control.tsx`](./src/icon-control/icon-control.tsx) —
  `IconButton` and `IconSelect`, the workspace's 34px icon controls, whose
  look the inspector tabs share, and `IconSwitch`, the native switch of a
  static depiction
- [`src/change-status/change-status.tsx`](./src/change-status/change-status.tsx)
  — `ChangeStatus`: the change status beside an entry's title
- [`src/inspector/inspector.tsx`](./src/inspector/inspector.tsx) —
  `Inspector` and `InspectorHandle`: the tabs, whose keys `tab-keys.ts`
  handles, the panels, and Close with its focus return
- [`src/inspector/inspector-sizer.tsx`](./src/inspector/inspector-sizer.tsx)
  — the resize separator and the sheet grab, and `InspectorSizing`, the
  height, the bounds, the sheet state, and the refs through which the host
  sizes the inspector
- [`src/inspector/inspector-disclosures.tsx`](./src/inspector/inspector-disclosures.tsx)
  — the inspector of a static depiction, whose tabs are native disclosures
- [`src/details-panel/details-panel.tsx`](./src/details-panel/details-panel.tsx)
  — `DetailsPanel` and `DetailsBody`: the collapsible Details and the body
  with the description, the rationale, and the metadata column
- [`src/metadata-row/metadata-row.tsx`](./src/metadata-row/metadata-row.tsx)
  — `MetadataRow` in its metadata and props presentations, and the code
  chips, links, chip groups, and entry chips of a value
- [`src/prop-field/prop-field.tsx`](./src/prop-field/prop-field.tsx) —
  `PropField` and `PropFields`: a field with its label, help, error, and
  optional supply, and the native control of each kind in `prop-input.tsx`;
  `PropFieldFrame` frames a static depiction's own control
- [`src/controls-panel/controls-panel.tsx`](./src/controls-panel/controls-panel.tsx)
  — `ControlsPanel` and `SavedPropsPanel`: the edit form with its alerts and
  focus targets, and the saved props
- [`src/edit-status/edit-status.tsx`](./src/edit-status/edit-status.tsx) —
  `EditStatus`, the status of a render of edited props over the preview
- [`src/props-panel/props-panel.tsx`](./src/props-panel/props-panel.tsx) —
  `PropsPanel`, `PropValues`, `PropSlots`, `PropsMessage`, and `PropsStatus`:
  the supplied props and slots, the line of an empty tab, and its loading and
  failed states
- [`src/usage-list/usage-list.tsx`](./src/usage-list/usage-list.tsx) —
  `UsageList` and `UsageStatus`: the Used by and affected consumers, and the
  tab's loading, failed, and unchecked states
- [`src/instance-tree/instance-tree.tsx`](./src/instance-tree/instance-tree.tsx)
  — `InstanceTree`: the viewport choice and the instances, whose nested lists
  keep their open state
- [`src/count/count.ts`](./src/count/count.ts) — `count`, the internal count
  wording of the usage list and the instance tree, such as "1 instance" and
  "3 instances"
- [`src/comparison-evidence/comparison-evidence.tsx`](./src/comparison-evidence/comparison-evidence.tsx)
  — `ComparisonEvidence`: the comparison facts of Details in the designs'
  order, with the saved variant's rows, the heading, and the files of
  `evidence-files.tsx`
- [`src/text-button/text-button.tsx`](./src/text-button/text-button.tsx) —
  `TextButton`, the text button of the inspector's panels
- [`src/canvas-stage/canvas-stage.tsx`](./src/canvas-stage/canvas-stage.tsx)
  — `CanvasStage` and `CanvasStageHandle`: the dot-grid canvas with its
  section and its zoom pill, and the handle with Fit and the zoom steps
- [`src/canvas-stage/use-canvas-view.ts`](./src/canvas-stage/use-canvas-view.ts)
  — the measured stage, the fitted view, and the handle's commands
- [`src/canvas-stage/canvas-view.ts`](./src/canvas-stage/canvas-view.ts) —
  Fit, the zoom steps, a zoom about a point, and a pan, over the section's
  fixed and scaled lengths
- [`src/canvas-stage/canvas-gestures.ts`](./src/canvas-stage/canvas-gestures.ts)
  — the drag, the wheel, and the pinch of the canvas, and `wheelPixels`
- [`src/canvas-stage/canvas-gesture-pinch.ts`](./src/canvas-stage/canvas-gesture-pinch.ts)
  — Safari's pinch: the gesture events that zoom the canvas about their
  point
- [`src/canvas-stage/canvas-keys.ts`](./src/canvas-stage/canvas-keys.ts) —
  `canvasKeyCommand`: the keys of the canvas and the rules of a text field and
  the modifiers
- [`src/canvas-section/canvas-section.tsx`](./src/canvas-section/canvas-section.tsx)
  — `CanvasSection`: the section box or the variant set's outline, its head
  with its quiet label, and its grid of frames
- [`src/canvas-section/section-layout.ts`](./src/canvas-section/section-layout.ts)
  — the section's padding and gaps by kind, the reading size, and
  `sectionExtent`, the lengths that Fit reads
- [`src/canvas-frame/canvas-frame.tsx`](./src/canvas-frame/canvas-frame.tsx) —
  `CanvasFrame`: a bare frame, its label and size tag, a step's description,
  and its scaled document or the place that holds a note
- [`src/canvas-frame/frame-label.tsx`](./src/canvas-frame/frame-label.tsx) —
  the frame's label: its glyph, a step's number, its name or the link that it
  is, `Light only`, and its size tag
- [`src/canvas-missing-view/canvas-missing-view.tsx`](./src/canvas-missing-view/canvas-missing-view.tsx)
  — `CanvasMissingView`: the note of a view never captured, in its frame's
  place
- [`src/canvas-state/canvas-state.tsx`](./src/canvas-state/canvas-state.tsx)
  — `CanvasState`: the canvas that holds a state in place of a section, in a
  card
- [`src/canvas-previous-version/canvas-previous-version.tsx`](./src/canvas-previous-version/canvas-previous-version.tsx)
  — `CanvasPreviousVersion`: the host of a removed entry's previous version on
  the canvas
- [`src/canvas-zoom-pill/canvas-zoom-pill.tsx`](./src/canvas-zoom-pill/canvas-zoom-pill.tsx)
  — `CanvasZoomPill`: Zoom out, the zoom, Zoom in, and Fit
- [`src/canvas-dock/canvas-dock.tsx`](./src/canvas-dock/canvas-dock.tsx) —
  `CanvasDock`: the compact layout's group of Catalogue, the current tab, and
  Fit
- [`src/entry-bar/entry-bar.tsx`](./src/entry-bar/entry-bar.tsx) —
  `EntryBar`: the compact layout's entry name, status, and frame picker
- [`src/floating-panel/floating-panel.tsx`](./src/floating-panel/floating-panel.tsx)
  — `FloatingPanel` and `FloatingPanelSheet`: the panel over the canvas and
  its bottom sheet, with the grabber of `sheet-grab.tsx` and the close control
- [`src/icons/canvas-icons.tsx`](./src/icons/canvas-icons.tsx) — `CanvasIcon`,
  the glyphs of the frames' kinds, the zoom pill, the dock, the sheet, and
  the frame picker
- [`src/stage/stage.tsx`](./src/stage/stage.tsx) — `Stage`, the dotted
  surface of live frames, of a component's canvases, or of a state
- [`src/preview-frame/preview-frame.tsx`](./src/preview-frame/preview-frame.tsx)
  — `PreviewFrame`, `DocumentFrame`, and `PreviewIframe`: a frame's wrapper,
  label, and lines, a whole document's frame, and the `<iframe>` element
- [`src/device-frame/device-frame.tsx`](./src/device-frame/device-frame.tsx)
  — `PhoneFrame` with the status band of `phone-status.tsx`, and
  `BrowserFrame`, whose expanded window covers the page, or whose bar is a
  picture in a static depiction
- [`src/browser-bar/browser-bar.tsx`](./src/browser-bar/browser-bar.tsx) —
  `BrowserBar`: the traffic lights, the address with its "URL copied"
  message, and the expand toggle of a browser window, as controls or as
  pictures of a static depiction
- [`src/flow-step/flow-step.tsx`](./src/flow-step/flow-step.tsx) —
  `FlowStage` and `FlowStep`: a user flow's column of numbered steps
- [`src/previous-version/previous-version.tsx`](./src/previous-version/previous-version.tsx)
  — `PreviousVersion`: the band and the stage host of a removed entry
- [`src/preview-state/preview-state.tsx`](./src/preview-state/preview-state.tsx)
  — the loading, failed, unavailable, and missing states of a preview
- [`src/scheme-fallback/scheme-fallback.tsx`](./src/scheme-fallback/scheme-fallback.tsx)
  — `LightOnlyNote` and `LightOnlyBand`, which only a Dark shell shows
- [`src/empty-state/empty-state.tsx`](./src/empty-state/empty-state.tsx) —
  `EmptyState` with its action, as a link, a button, or the picture of a
  static depiction, and the home, missing route, and removed states
- [`src/comparison-stage/comparison-stage.tsx`](./src/comparison-stage/comparison-stage.tsx)
  — `ComparisonStage`, `ComparisonSection`, `ComparisonPanes`, and
  `ComparisonFailure`: Current, the comparison stage, and its sections
- [`src/comparison-pane/comparison-pane.tsx`](./src/comparison-pane/comparison-pane.tsx)
  — `ComparisonPane`, `ComparisonLayer`, `ComparisonViewport`,
  `ComparisonSurface`, and `ComponentFrame`: one version and its viewport
- [`src/variant-bar/variant-bar.tsx`](./src/variant-bar/variant-bar.tsx) —
  `VariantBar`: the links of a component's saved variants, or the pictures
  of a static depiction, and the status
- [`src/shell-layout/shell-layout.tsx`](./src/shell-layout/shell-layout.tsx)
  — `ShellLayout`, the standalone root; `SkipLink`, `ShellBody`,
  `MainRegion`, `RouteStatus`, and `FloatingCatalogue`, which both roots
  draw; and `RootState`, the state of a root without a shell
- [`src/shell-layout/root-marks.ts`](./src/shell-layout/root-marks.ts) — the
  class of a root's drag, and the Canvas layout's mark and catalogue width,
  which both roots share
- [`src/merged-ref/merged-ref.ts`](./src/merged-ref/merged-ref.ts) —
  `useMergedRef`, the internal ref of an element that a component and its
  host both need
- [`src/embedded-layout/embedded-layout.tsx`](./src/embedded-layout/embedded-layout.tsx)
  — `EmbeddedLayout`, an embedded root with the host slots, whose top-bar
  containers it hands to the top bar, and the stage overlay of
  `host-slot.tsx`, and `MarkerLayer`, the host's markers
- [`src/workspace-layout/workspace-layout.tsx`](./src/workspace-layout/workspace-layout.tsx)
  — `WorkspaceLayout`: the preview on the canvas with the entry bar and the
  right panel, or the header, the variant bar, and the preview beside the
  inspector
- [`src/highlight-label/highlight-label.tsx`](./src/highlight-label/highlight-label.tsx)
  — `LabelLayer` and `HighlightLabel`: the layer and the labels of
  highlighted instances, as buttons or as the links and pictures of a static
  depiction
- [`src/highlight-mask/highlight-mask.tsx`](./src/highlight-mask/highlight-mask.tsx)
  — `HighlightMask`: the dimmed layer with a cutout and an outline for each
  box, as an SVG mask
- [`scripts/build.mjs`](./scripts/build.mjs) — compiles the package, copies
  each CSS file beside its JavaScript, and writes `styles.css`
- [`scripts/styles.mjs`](./scripts/styles.mjs) — finds the component
  stylesheets and orders `styles.css`
- [`tests/dom.ts`](./tests/dom.ts) — the happy-dom window, the act
  environment, and the cleanup of each DOM test
- [`tests/dom-assertions.ts`](./tests/dom-assertions.ts) —
  `assertSameElement`, `assertNotSameElement`, and `assertSameList`, which
  compare DOM nodes by identity and describe them in a few words
- [`tests/navigation-fixture.ts`](./tests/navigation-fixture.ts) — the
  records and props of the catalogue navigation tests
- [`tests/tag-picker-fixture.tsx`](./tests/tag-picker-fixture.tsx) — the tags
  of the tag picker tests and a host that holds the picker's state
- [`tests`](./tests) — Testing Library tests on happy-dom

### Related Docs

- [Shared UI package contract](../../docs/protocol/mokly-ui-package.md)
- [Package and consumer boundary](../../docs/architecture/package-boundary.md)
- [Design components](../../docs/protocol/mokly-design-components.md)
- [Viewer appearance](../../docs/protocol/mokly-viewer-appearance.md) and
  [Viewer palette](../../docs/protocol/mokly-viewer-palette.md), the Canvas
  palette and the theme that the package draws in
- [Shell design](../../docs/protocol/mokly-shell-design.md),
  [Shell canvas stage](../../docs/protocol/mokly-shell-canvas-stage.md) and
  [Shell canvas frames](../../docs/protocol/mokly-shell-device-chrome.md), the
  Canvas stage, its frames, pan, zoom and Fit, and the compact layout
- [Component inspector design](../../docs/protocol/mokly-component-inspector-design.md),
  the right panel with Inspect and Changes,
  [Canvas selection](../../docs/protocol/mokly-viewer-selection-canvas.md),
  the selection on a frame and its box model, and
  [Comparison panes](../../docs/protocol/mokly-comparison-panes.md), the
  compare modes
- [Shell brand](../../docs/protocol/mokly-shell-brand.md), the mark that the
  top bar draws
