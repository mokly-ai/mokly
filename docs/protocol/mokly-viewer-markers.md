# Viewer Markers And Multi-Instance Highlights

## Delivery Status

Implemented. Delivery and verification are tracked by the active
[viewer comment anchoring plan](../../plans/viewer-comment-anchoring.md). The
viewer composes the existing instance identity and frame adapter without adding
a comment model or changing the adapter wire protocol.

## Purpose And Boundary

`@mokly/viewer` positions host-owned React content on component instances and
can highlight several exact instances at once. This lets a host render comment
markers without adding a comment, tenant, auth or storage model to the viewer.
The host owns marker content, accessibility, interaction and persistence.

Markers address only component instances represented by an
[`InstanceRef`](./mokly-instances.md). Point and region annotations are outside
this contract. The viewer exposes no raw geometry, selectors or portal target.
`renderViewer` does not accept markers, and standalone Serve/export render no
marker layer.

## Public Contract

```ts
interface ViewerMarker {
  id: string;
  instance: InstanceRef;
  content: ReactNode;
}
type MarkerStatus = "visible" | "hidden" | "unavailable";
interface MarkerState {
  id: string;
  status: MarkerStatus;
}
interface MoklyViewerProps {
  markers?: readonly ViewerMarker[];
  onMarkerChange?: (states: readonly MarkerState[]) => void;
}
interface MoklyViewerHandle {
  highlightInstances(instances: readonly InstanceRef[]): Promise<void>;
}
```

`markers` defaults to an empty list. Marker ids must be unique within the
current prop value. Duplicate ids render no markers and emit one
`onError({ code: "markers", ... })` for that invalid value. Replacing the prop
with valid markers recovers without remounting the viewer.

## Matching And States

Each marker matches its complete reference against the effective mounted view:
screen, saved variant when present, flow step when present, viewport, effective
scheme and instance key. A Dark selection that falls back to a light-only view
mounts Light, so a Light reference matches it. A host supplies separate markers
when one logical comment should appear on several views.

The viewer evaluates every marker to exactly one state:

- `visible`: a matching Current frame is mounted and ready with valid usage,
  the key is present, and at least one measured box remains visible after frame
  and stage clipping.
- `hidden`: the matching Current frame is mounted and ready, its usage contains
  the key, but measurement produces no visible box.
- `unavailable`: there is no exact current frame; the frame or usage is pending
  or unavailable; the key is absent; the entry is a page; the frame is showing
  a non-Current comparison; or boundary measurement fails.

Unavailable markers do not cause navigation, variant changes, scrolling or
fallback to another instance. Marker evaluation does not emit inspection,
selection or pick events.

`onMarkerChange` receives the complete ordered state list once after the first
evaluation of each valid prop value, including an empty list. Later evaluations
emit only when at least one status changes; position-only changes do not emit.
Callbacks use the marker prop order and never expose geometry. A measurement
failure reports at most one safe `markers` error for that refresh generation.

## Placement

For every visible marker, the viewer renders its `content` inside an absolutely
positioned container equal to the union of the instance's visible boxes. It:

1. reads authenticated frame-relative boxes through
   `MountedFrame.listInstanceBoundaries()`;
2. applies the frame chrome scale and the iframe's `clientLeft`/`clientTop`;
3. translates into viewer-stage coordinates; and
4. intersects the result with the iframe's visible box, stage clipping and the
   viewer root.

The union covers all visible roots/ranges for that key. Empty and fully clipped
boxes produce `hidden`. The container has `pointer-events: none`; marker content
may opt in with its own pointer-event style. Host interaction remains ordinary
React interaction and cannot start picking or synthesize instance events.

The marker and package-label layers remain above an expanded Current frame.
Their stacking returns to normal after collapse. Marker content remains outside
the frame and is never injected into consumer HTML.

## Refresh And Scheduling

Placement and package-owned instance labels refresh after:

- an authenticated in-frame `geometry` notification;
- capture-phase scrolling at the viewer root, including outer stage scrolling;
- resize of the viewer root, stage or a mounted frame;
- frame expansion or collapse;
- frame mount, replacement or disposal;
- validated usage/evidence adoption; and
- a `markers` prop change.

Refreshes are coalesced to at most one boundary measurement per animation frame
per frame session. Every session has a generation and dirty bit. A trigger that
arrives while `listInstanceBoundaries()` is unresolved marks the session dirty;
after that read settles, one trailing read runs against the current generation.
This prevents an asynchronous stale snapshot from losing a geometry wake-up.
Replacement or disposal invalidates the generation, cancels scheduled work and
prevents late results, errors or callbacks from reaching the host.

The hydrated shell owns one frame registry per shell root. Workspace inspection
labels and host markers acquire that registry's single geometry scheduler and
contribute their demanded sessions to one deduplicated set. They therefore
share a boundary read when both target the same session. Validated usage
adoption increments the retained session's usage revision; the scheduler
supersedes unresolved work for the prior revision before refreshing. A late old
success or failure cannot delay, replace or report against the fresh snapshot.

## Multi-Instance Highlight

`highlightInstances(refs)` highlights the exact union of all referenced Current
frame sessions. Each selected session receives only the keys whose complete
references match it. References may span Both viewports, schemes and flow steps.
Duplicate references have no additional effect.

The operation is atomic. Before changing the current presentation, the viewer
requires every reference to match a ready Current session with valid usage and
a present key. Any mismatch rejects with the frame adapter's existing
`missing-instance` semantics and leaves the prior highlight unchanged. The
viewer never guesses a variant, flow step, viewport, scheme or replacement key.

`highlightInstances([])` clears every highlight. `highlightInstance(ref)` is
single-reference sugar over this operation; `highlightInstance(null)` also
clears. Existing package masks, outlines, catalogue labels and accessible
instance lists are reused, and label text remains `Component · id`.

Picking temporarily owns the same presentation. Frame replacement, picking,
evidence changes and superseded async work follow the main
[viewer lifecycle](./mokly-viewer.md#selection-events-and-imperative-use). If
ready evidence or any referenced key disappears, every mask and label in the
multi-frame highlight clears atomically; an active pick ends once with
`reason: "evidence"`. Unrelated evidence updates neither wait for nor redraw
the presentation.

## Errors And Lifecycle

Current marker/highlight failures emit one product-safe viewer error without
private paths, selectors or consumer text. User callback exceptions are not
reclassified. Source or adapter replacement disposes the old marker scheduler
before mounting the new runtime. Unmount removes observers, scroll listeners,
scheduled animation frames, marker containers and adapter subscriptions, and no
late marker state or error callback may fire.

The adapter wire schema and embedded inspector bundle are unchanged. Markers and
multi-highlight compose existing `list`, `highlight`, `geometry` and host-side
frame identity primitives described by the
[frame adapter protocol](./mokly-frame-adapter.md).
