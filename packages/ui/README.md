# @mokly/ui

Status: In progress under the [shell views plan](../../plans/ui-package-shell-views.md).

`@mokly/ui` holds every element and every stylesheet of the Mokly Browse
shell: its components, its theme, and its layout. `@mokly/viewer` composes
them into the shell that Serve, the static build, and React hosts render, and
the design mockup catalogue under `examples/basic` renders the same
components. Depend on this package only when you render one of its components
yourself; a host that embeds a catalogue uses `@mokly/viewer`, which depends
on this package at the exact shared version.

## Responsibilities

- Every element of the shell: the markup, the styles, and the local
  interaction of each component, with props in and callbacks out. The viewer
  renders no element of its own.
- Every style rule of the shell: the theme, the reset class, one CSS file
  beside each component, the shell layout, and the rules of the embedded root.
  Every rule stays outside every cascade layer, and `styles.css` holds them
  all.
- The highlight mask that marks component instances over a preview, drawn from
  the boxes that the viewer's frame adapters return.
- Nothing else. A component reads no store, no context, no catalogue read
  model type, no network, and no history. It renders the `<iframe>` element of
  a preview but never reads the frame's document. React and React DOM are the
  only peers.

## What This Package Does

Each component is a subpath export, such as `@mokly/ui/appearance-selector`,
and `@mokly/ui/styles.css` is the only stylesheet subpath. The package has no
root entry.
`styles.css` holds the rules of every component; a component's own stylesheet
leaves out the components it renders, such as the change mark of the
appearance selector. The viewer bundles `styles.css` into its own `shell.css`
and `styles.css`, so a delivery or a host loads one stylesheet as before. A
shell container that needs the store stays in `@mokly/viewer` and renders
package components.

The theme declares the shell's tokens, such as `--chrome-surface`, and the
Light and Dark palette on the viewer root class and on the standalone stub's
document class, never through a `:root`, `html`, or `body` selector. Each
component puts the reset class on its own elements that need a reset. No rule
reaches the host page or host slot content. A host that renders a component
outside a viewer root puts it inside an element with the viewer root class, or
declares the tokens itself, as the design catalogue's
`examples/basic/design.css` does.

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
select's `aria-describedby` points at while the control is marked.

`ComparisonToolbar` renders its modes as toggle buttons that report through
`onMode`. A host that runs no script, such as a static mockup, passes
`modeHref` to draw each mode that has an address as a link, and
`interactive={false}` to draw the other modes as inert text and Refresh as a
picture of itself. The link or the text of the shown mode is marked as the
current page. Scroll together stays a native switch in every band. The mode
group renders the package's segmented control, and the package stylesheet
gives a link and inert text the line box and centring of a button.

`TopBar`, `CatalogueNavigation`, and `ScreenHeader` draw controls that act
through a script. A static mockup gives `TopBar` a `brandHref` and a
`menuHref`, which draw the brand and the menu as links, and sets
`interactive={false}`, which draws a control without an address as a picture
of itself and leaves out the compact search. It gives `CatalogueNavigation` a
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
reports widths through `onWidth` and `onWidthCommit`. `TopBar` takes the tag
picker and the end control as slots, and `ScreenHeader` takes the view's
status and controls as slots.

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
inspector in the same way, such as on Escape anywhere in the host's shell, and
names its element. The resize separator and the sheet grab keep the
attributes through which the host sizes the inspector. `DetailsPanel` draws
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

`Stage` draws the dotted stage of a preview. `PreviewFrame` draws one frame on
it: the wrapper that records the scheme of the shown render, the viewport's
label with the `LightOnlyNote` of `scheme-fallback`, and the lines of a
preview that is unavailable or that failed to load. `DocumentFrame` hosts a
whole document, and `PreviewIframe` is the `<iframe>` element itself, always
sandboxed without scripts. The host passes the frame's `ref`, its `src` or
`srcDoc`, its `key`, and its data attributes in their order, and it loads and
reads the frame's document; no component reads it. `PhoneFrame` and
`BrowserFrame` draw the device chrome, and the window draws its bar with
`BrowserBar`. A press on the address reaches `onCopy` and shows "URL copied"
for a moment, and the toggle asks for the expanded state through
`onExpandedChange`, because the host owns which window is expanded.

`FlowStage` and `FlowStep` draw a user flow's steps, `PreviousVersion` a
removed entry's band and stage host, and `StageLoading`, `StageFailure`,
`PreviewLoading`, `PreviewUnavailable`, and `PreviewNotCaptured` the states
of a preview that has not arrived. `EmptyState` draws the quiet state of a
stage, and `HomeState`, `MissingRouteState`, `RemovedState`, and
`RemovedVariantState` the shell's own. `ComparisonStage` draws the comparison
of an entry around the band that the host renders, with its sections, panes
grid, and failure. `ComparisonPane` and `ComparisonLayer` draw one version,
and `ComparisonViewport` and `ComparisonSurface` pass their elements to the
host's scroll controller through refs. `VariantBar` draws a component's saved
variants. The host supplies the wording of its copy modules, such as the
unavailable previous version and the comparison's state labels.

A static mockup sets `disclosures` on `Inspector`, which draws each tab as a
native disclosure of one group, named by `contentId`: a tab opens its panel
and closes it again without a script, one tab at a time, and Close is part of
the open tab. A tab with an `href` is a link, which is its one keyboard stop.
The resize separator is then a picture of its grip, and the sheet's grab is a
native switch that `expanded` starts checked, which a host stylesheet reads to
size the sheet. `PropFieldFrame` frames a native control that the mockup draws
itself in the field's label column, Set check box, Not set line, help, and
error. `TextButton` with an `href` is a link with the button's look, and the
controls panels take `resetHref`, `retryHref`, `startHref`, and `currentHref`,
which draw Reset while the props differ, the alert's action, a failed start's
action, and Switch to Current as links.

## Development

From the repository root, `npm run build` builds this package before the
viewer. `npm run typecheck` includes it. Tests live under `tests/` and run with
`npm test -- packages/ui/tests/<file>`. A test that mounts a component imports
`tests/dom.ts` first, which registers a happy-dom window for Testing Library.
File names are kebab-case, such as `top-bar.tsx` exporting `TopBar`. A lint
checks the rule only for the JavaScript and TypeScript files under `src/` and
`tests/` and for the directories that hold them. A component imports only
`react`, `react-dom`, and the other components of this package by relative path;
a lint holds that rule too.

The design library and the design artboards under `examples/basic/specs/design`
import each package component that they show, with its stylesheets, from
`src/` by repository path, not from `dist`: the base side of a Changes
comparison renders from Git, which holds no build output. A change here
therefore also changes their design mockups, so run the mockup check of
[`AGENTS.md`](../../AGENTS.md) after it.

A component lives in `src/<name>/`: `<name>.tsx`, and `<name>.css` when it has
styles. Its subpath in the `exports` map is `./<name>`, with `types` and
`import` targets in `dist/<name>/`. The build copies
`<name>.css` beside the JavaScript. Each stylesheet keeps its rules outside
every cascade layer, so neither an element reset nor a host layer overrides a
component rule, and a host rule competes with them by specificity and order; a
test holds the rule.

`src/styles.css` sets the order of `styles.css`. It lists the component
stylesheets with one `@import` each, in cascade order: the theme, the shared
controls, the components, then the layout and its responsive rules. The build
concatenates the stylesheets in that order. A component stylesheet that the
list omits joins the end in name order, with a build warning. Add each new
stylesheet to the list at its place in the cascade. A later rule of equal
specificity overrides an earlier one, as the narrow-width layout rules
override the desktop layout rules.

### Key Code

- [`src/icons/icons.tsx`](./src/icons/icons.tsx) — the shell glyphs and the
  workspace control icons, with `IconSvg` as their frame
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
- [`src/top-bar/top-bar.tsx`](./src/top-bar/top-bar.tsx) — `TopBar`: the
  drawer menu, the brand, and the catalogue search with its compact form and
  its focus return
- [`src/top-bar/top-bar-links.tsx`](./src/top-bar/top-bar-links.tsx) — the
  menu and the brand, as controls, links, or pictures of a static depiction
- [`src/catalogue-navigation/catalogue-navigation.tsx`](./src/catalogue-navigation/catalogue-navigation.tsx)
  — `CatalogueNavigation`: the column, the All and Changes filter, the status
  line, and the resize separator with its drag and keys
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
  handles, the panels, Close with its focus return, and the resize separator
  and sheet grab
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
  the supplied props and slots, the line of an empty tab, and its loading
- [`src/usage-list/usage-list.tsx`](./src/usage-list/usage-list.tsx) —
  `UsageList` and `UsageStatus`: the Used by and affected consumers, and the
  tab's loading and unchecked states
- [`src/instance-tree/instance-tree.tsx`](./src/instance-tree/instance-tree.tsx)
  — `InstanceTree`: the viewport choice and the instances, whose nested lists
  keep their open state
- [`src/count/count.ts`](./src/count/count.ts) — `count`, the internal count
  wording of the usage list and the instance tree, such as "1 instance" and
  "3 instances"
- [`src/comparison-evidence/comparison-evidence.tsx`](./src/comparison-evidence/comparison-evidence.tsx)
  — `ComparisonEvidence`: the comparison facts of Details in the designs'
  order, with the heading and the files of `evidence-files.tsx`
- [`src/text-button/text-button.tsx`](./src/text-button/text-button.tsx) —
  `TextButton`, the text button of the inspector's panels
- [`src/stage/stage.tsx`](./src/stage/stage.tsx) — `Stage`, the dotted
  surface of live frames, of a component's canvases, or of a state
- [`src/preview-frame/preview-frame.tsx`](./src/preview-frame/preview-frame.tsx)
  — `PreviewFrame`, `DocumentFrame`, and `PreviewIframe`: a frame's wrapper,
  label, and lines, a whole document's frame, and the `<iframe>` element
- [`src/device-frame/device-frame.tsx`](./src/device-frame/device-frame.tsx)
  — `PhoneFrame` with the status band of `phone-status.tsx`, and
  `BrowserFrame`, whose expanded window covers the page
- [`src/browser-bar/browser-bar.tsx`](./src/browser-bar/browser-bar.tsx) —
  `BrowserBar`: the traffic lights, the address with its "URL copied"
  message, and the expand toggle of a browser window
- [`src/flow-step/flow-step.tsx`](./src/flow-step/flow-step.tsx) —
  `FlowStage` and `FlowStep`: a user flow's column of numbered steps
- [`src/previous-version/previous-version.tsx`](./src/previous-version/previous-version.tsx)
  — `PreviousVersion`: the band and the stage host of a removed entry
- [`src/preview-state/preview-state.tsx`](./src/preview-state/preview-state.tsx)
  — the loading, failed, unavailable, and missing states of a preview
- [`src/scheme-fallback/scheme-fallback.tsx`](./src/scheme-fallback/scheme-fallback.tsx)
  — `LightOnlyNote` and `LightOnlyBand`, which only a Dark shell shows
- [`src/empty-state/empty-state.tsx`](./src/empty-state/empty-state.tsx) —
  `EmptyState` with its action, and the home, missing route, and removed
  states
- [`src/comparison-stage/comparison-stage.tsx`](./src/comparison-stage/comparison-stage.tsx)
  — `ComparisonStage`, `ComparisonSection`, `ComparisonPanes`, and
  `ComparisonFailure`: Current, the comparison stage, and its sections
- [`src/comparison-pane/comparison-pane.tsx`](./src/comparison-pane/comparison-pane.tsx)
  — `ComparisonPane`, `ComparisonLayer`, `ComparisonViewport`,
  `ComparisonSurface`, and `ComponentFrame`: one version and its viewport
- [`src/variant-bar/variant-bar.tsx`](./src/variant-bar/variant-bar.tsx) —
  `VariantBar`: the links of a component's saved variants and the status
- [`scripts/build.mjs`](./scripts/build.mjs) — compiles the package, copies
  each CSS file beside its JavaScript, and writes `styles.css`
- [`scripts/styles.mjs`](./scripts/styles.mjs) — finds the component
  stylesheets and orders `styles.css`
- [`tests/dom.ts`](./tests/dom.ts) — the happy-dom window, the act
  environment, and the cleanup of each DOM test
- [`tests/navigation-fixture.ts`](./tests/navigation-fixture.ts) — the
  records and props of the catalogue navigation tests
- [`tests/tag-picker-fixture.tsx`](./tests/tag-picker-fixture.tsx) — the tags
  of the tag picker tests and a host that holds the picker's state
- [`tests`](./tests) — Testing Library tests on happy-dom

### Related Docs

- [Shared UI package contract](../../docs/protocol/mokly-ui-package.md)
- [Package and consumer boundary](../../docs/architecture/package-boundary.md)
- [Design components](../../docs/protocol/mokly-design-components.md)
- [Viewer appearance](../../docs/protocol/mokly-viewer-appearance.md)
