# Core concepts

This page belongs to the [`@mokly/viewer` README](../../README.md). It explains how the viewer reads a catalogue, what a selection holds, and how a host connects to the viewer.

## Catalogue sources

`MoklyViewer` reads two shapes of the
[shell delivery contract](../../../../docs/protocol/mokly-shell-delivery.md): the
catalogue index, read model v7, and one entry detail v2 per entry.

| Prop     | Accepts                                                 | Rule                                                                                |
| -------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `index`  | An absolute HTTP(S) `string` or `URL`                   | The viewer fetches the index; the final response URL sets the catalogue origin root |
| `index`  | A `CatalogueReadModel` object                           | Requires `baseUrl`, the origin root of the catalogue files                          |
| `detail` | `(entryPath, snapshotId?) => detail, URL, or a promise` | Called once per entry the viewer does not hold; a URL must be on the origin root    |

The viewer validates the index and each detail before it reads a field. It
fetches a URL with a plain GET, `credentials: "omit"`, and no custom header, and
it rejects a redirect outside the origin. When another deployment replaces the
files, the viewer emits one `onError` and keeps its state. A React host
supplies newer data by replacing `index`. The
[viewer contract](../../../../docs/protocol/mokly-viewer.md#package-and-props)
defines which details the viewer accepts and how it recovers from a revision
mismatch.

Keep the `index` object, the URL value, the `detail` function, and the frame
adapter identities stable while the viewer is mounted. Replacing one remounts
the viewer and cancels pending work.

## Selection

`screenPath` names one catalogue entry by its path, such as
`checkout/overview`: a screen, page, document, use case, component, or a
variant of a screen or component. A variant's path is its parent's path plus
its slug, so there is no separate variant field. The component page's variant
bar navigates between the parent's own entry and its variant entries, and
controlled hosts receive ordinary `screenPath` proposals. `null` selects home.
The shell URL of every entry is `/view/<path>/`; `viewHref(path)` from
`@mokly/viewer/data` builds it.

Use `defaultSelection` for an uncontrolled viewer:

```tsx
<MoklyViewer
  index={indexUrl}
  detail={detail}
  defaultSelection={{ screenPath: "checkout/overview", viewport: "desktop" }}
/>
```

Use `selection` with `onSelectionChange` when application state owns the active
entry and filters:

```tsx
import { useState } from "react";
import {
  MoklyViewer,
  type MoklyViewerProps,
  type ViewerSelection,
} from "@mokly/viewer";

interface ControlledCatalogueProps {
  indexUrl: string;
  detail: MoklyViewerProps["detail"];
}

export function ControlledCatalogue({
  indexUrl,
  detail,
}: ControlledCatalogueProps) {
  const [selection, setSelection] = useState<ViewerSelection>({
    screenPath: null,
    view: "all",
    viewport: "both",
    colorScheme: "light",
    search: "",
    tags: [],
  });

  return (
    <MoklyViewer
      index={indexUrl}
      detail={detail}
      selection={selection}
      onSelectionChange={setSelection}
    />
  );
}
```

Controlled changes are proposals until the host passes the new selection back.
Do not provide `defaultSelection` in controlled mode. Remount the viewer to
change modes.

`view` selects the All or Changes catalogue filter, not a comparison mode.
`viewport`, `colorScheme`, `search`, and `tags` complete the selection. A view
that has only a Light render keeps the Dark selection and shows the Light-only
label; status, change marks, and comparisons use the effective Light view.

A removed entry of any kind can publish an opaque `snapshotId` beside its
record. Supply it with `screenPath` to select that exact historical record. A
path-only selection normalizes to the published identity, and an unknown or
stale identity renders unavailable. The viewer carries the id through
controlled proposals and navigation events. A removed screen shows its
read-only version from the base commit, with no picking, inspection, or
comparison action.

The Details panel shows the workspace of the entry detail in every delivery:
Used by, Affected screens, related changed components, and input changes with
Before and Current props. While Changes is ready, it also lists the rule and
resource evidence of the selected view.

## Host integration

The viewer owns catalogue presentation, navigation, comparison, and inspection.
The host owns the surrounding product experience and connects it through:

- **Slots** — add React content to the top bar, the navigation rail, a side
  panel, the preview stage overlay, or the catalogue home.
- **Events** — observe selection, screen navigation, instance hover and click,
  picking, marker visibility, and safe viewer errors.
- **Markers** — place host-owned React content on an exact `InstanceRef`; the
  host keeps ownership of comment data and interaction.
- **Imperative methods** — select entries, highlight or scroll to component
  instances, and start or cancel instance picking.

Slot children are ordinary host-owned React nodes. The viewer does not inspect
their DOM or event handlers, and updating a slot does not reset selection or
frame sessions.

## Component instance references

Instance events carry `frame: { entryPath, stepIndex? }` and an `InstanceRef`
scoped to a screen, component variant, or flow step, a viewport, a colour
scheme, and a stable component key. Persist that value to reconnect external
data such as a review comment. `resolveInstance` compares a saved
`ComponentInstanceRecord` with the record of the same key in a newer catalogue
and returns `"present"`, `"moved"`, or `"missing"`, without fetching preview
evidence.

`InstanceRef.screenPath` is the owning entry's path, also for a component
variant; the shape has no `variantId`. `onScreenNavigate` reports
`{ screenPath, snapshotId?, fragment?, navigation? }`, with no route or variant
id. `snapshotId` is present when the removed record publishes an opaque
identity, under the
[viewer contract](../../../../docs/protocol/mokly-viewer.md#package-and-props).

A marker takes a unique `id`, an exact `instance`, and React `content`. The
marker container is pointer-inert; opt an interactive child in with its own
`pointer-events` style. Geometry stays viewer-owned and is not a host API.

Served and built documents keep the `mokly-instance` and `mokly-slot` comment
markers of every region the core composed. The published inspector resolves
instance regions in the live page from them.

## Live controls

Entry detail v2 supplies control declaration order. The Props tab follows it
for editable fields and saved values. Saved props remain visible while the
detail loads.

Saved props must satisfy their schema. A saved value outside its narrower
editing bounds remains visible. The build reports a warning, while live edits
must satisfy the complete merged props and control bounds.

Every screen and component is a render over props, and the Props tab of the
inspector derives its controls from the entry's prop schema. In `mokly serve`,
the standalone shell edits props temporarily through the render capability of
the live descriptor, and it follows the event stream of publications. An
embedded `MoklyViewer` and the static output of `mokly build` have no live
capability: their controls are read-only, they show the saved props, and they
open no event stream. A temporary edit never enters the index, a detail, a URL,
or browser storage. The
[controls contract](../../../../docs/protocol/mokly-component-controls.md#rendering-boundary)
owns the boundary.
