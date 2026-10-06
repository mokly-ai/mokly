# Embeddable Mokly Viewer

The viewer library renders one React shell
in Serve, export and embedded hosts. Serve uses the strict
[entry-scoped bootstrap](./mokly-shell-bootstrap.md).

## Package And Props

`@mokly/viewer` is an MIT, ESM npm workspace package under `packages/viewer`,
with declarations and React/React DOM peers. `@mokly/mokly` depends on its
released version; the viewer never imports the CLI, Node, Git or consumer code.
The public React entry exports `MoklyViewer`, its types, the adapters and
`readCatalogue` and `resolveInstance` from the public data contracts.
The documented `./runtime` integration entry supplies recovery, validated
catalogue revision adoption and the private live-host capability contracts
used by Serve. The `./browser` entry owns standalone hydration.
`./data` owns shared pure value/validation contracts used by CLI producers.
These are package entry points, not aliases for CLI modules. `./server` also
exports typed standalone context and `viewerAssetUrl` for package assets.

```ts
import type { CSSProperties, ReactNode, Ref } from "react";
import type { CatalogueReadModel } from "@mokly/viewer";
import type { FrameAdapter, Box, FrameNavigation } from "@mokly/viewer";

interface ViewerSelection {
  /** Entry path of any kind, including a variant; null is home. */
  screenPath: string | null;
  /** Exact removed record; absent for current content. */
  snapshotId?: string;
  view: "all" | "changes";
  viewport: "mobile" | "desktop" | "both";
  colorScheme: "light" | "dark";
  search: string;
  tags: readonly string[];
}
type CatalogueFetcher = (context: { signal: AbortSignal }) => Promise<{
  catalogue: CatalogueReadModel;
  url: URL;
}>;
type CatalogueSource = CatalogueReadModel | string | URL | CatalogueFetcher;
interface InstanceRef {
  screenPath: string;
  stepIndex?: number;
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
  key: string;
}
interface InstanceEvent {
  instance: InstanceRef | null;
  boxes: readonly Box[];
  frame: { entryPath: string; stepIndex?: number };
}
interface ScreenNavigateEvent {
  screenPath: string;
  snapshotId?: string;
  fragment?: string;
  navigation?: FrameNavigation;
}
type PickEnd =
  | { reason: "selected"; instance: InstanceRef }
  | {
      reason:
        | "cancelled"
        | "escape"
        | "navigation"
        | "source-change"
        | "evidence"
        | "error";
    };
interface ViewerError {
  code: "catalogue" | "selection" | "frame" | "comparison" | "markers";
  message: string;
}
interface ViewerMarker {
  id: string;
  instance: InstanceRef;
  content: ReactNode;
}
type ViewerTheme = "auto" | "light" | "dark";
type MarkerStatus = "visible" | "hidden" | "unavailable";
interface MarkerState {
  id: string;
  status: MarkerStatus;
}
interface ViewerSlots {
  topBarStart?: ReactNode;
  topBarEnd?: ReactNode;
  railStart?: ReactNode;
  railEnd?: ReactNode;
  sidePanel?: { content: ReactNode; width: CSSProperties["width"] };
  stageOverlay?: { content: ReactNode; pointerEvents: "none" | "auto" };
  emptyState?: ReactNode;
}
interface MoklyViewerHandle {
  select(selection: Partial<ViewerSelection>): void;
  highlightInstance(instance: InstanceRef | null): Promise<void>;
  highlightInstances(instances: readonly InstanceRef[]): Promise<void>;
  scrollToInstance(instance: InstanceRef): Promise<void>;
  startPick(): Promise<void>;
  cancelPick(): void;
}
interface MoklyViewerProps {
  catalogue: CatalogueSource;
  baseUrl?: string | URL;
  frameAdapter?: FrameAdapter;
  defaultSelection?: Partial<ViewerSelection>;
  selection?: ViewerSelection;
  theme?: ViewerTheme;
  onSelectionChange?: (selection: ViewerSelection) => void;
  markers?: readonly ViewerMarker[];
  onMarkerChange?: (states: readonly MarkerState[]) => void;
  slots?: ViewerSlots;
  onScreenNavigate?: (event: ScreenNavigateEvent) => void;
  onInstanceHover?: (event: InstanceEvent) => void;
  onInstanceClick?: (event: InstanceEvent) => void;
  onPickStart?: () => void;
  onPickEnd?: (event: PickEnd) => void;
  onError?: (error: ViewerError) => void;
  ref?: Ref<MoklyViewerHandle>;
}
```

`ScreenNavigateEvent` names the destination by `screenPath`. Its `snapshotId` is
present when the committed historical record has an opaque identity published
by the catalogue; it is absent for current content and historical records
without one. The event has no `route`, `variantId`, or `kind`: hosts resolve the
entry through the read model and use `viewHref(path)` for its shell URL.

For an object source, `baseUrl` is required and supplies its HTTP(S) artifact
origin root. A URL/string source must be an absolute HTTP(S) catalogue URL;
its validated final response URL establishes that root. A fetcher returns the
same pair explicitly and must honor cancellation; `baseUrl` is invalid for URL
or fetcher sources. Do not resolve artifact paths relative to the embedding app.
Validate every source as [catalogue v4](./mokly-catalogue.md) before rendering.
Fetchers are host-supplied source transports, not permission for viewer telemetry.
Fetch failure renders an explicit error/retry state and emits `onError`.
Missing data is never replaced by examples or invented counts.

Omitted `frameAdapter` uses `sameOriginAdapter()`. Cross-origin hosts explicitly
provide `postMessageAdapter({ frameOrigin })` under the
[adapter protocol](./mokly-frame-adapter.md). One adapter can mount several
independent frames; it owns no global document state.

## Selection, Events And Imperative Use

`screenPath` names one catalogue entry path: a screen, page, document, use case,
component, or a screen or component [variant](./mokly-variants.md); null selects
home. A path with no current or removed entry shows the existing not-found view
with usable navigation. A variant of either kind is selected by its own path;
selecting a component parent shows its first variant entry, and there is no
separate variant selection field.
`view` selects the All/Changes **catalogue filter**, not a comparison mode.
Logical fragments and comparison mode retain their existing route/runtime
state.

`snapshotId` is the optional opaque identity published beside a removed entry.
With it, the pair must resolve exactly one removed record; an unknown, stale,
or cross-catalogue identity is unavailable. A path-only selection of a removed
record remains supported and normalizes to its published identity when present.
Readers reject models where a current and removed record share a path. The same
rules apply to every kind retained in `removedEntries`.
Evidence adoption can compare an explicit snapshot identity directly: a newer
catalogue is adopted, and a replaced or missing selected record becomes
unavailable without retargeting. When no identity is available, adoption
requires the complete removed record to remain unchanged; otherwise the full
reload path requests coherent metadata and preview bytes again.

Defaults are home, All, Both, Light, empty search and no tags, overridden once
by `defaultSelection`. `selection` supplies the complete controlled state;
when present, require `onSelectionChange` and do not also accept
`defaultSelection`. A user action or imperative `select` merges a partial update
into current state, validates it and emits a complete next state only if changed.
Controlled changes remain proposals until the host supplies them back; incoming
props do not echo an event. Uncontrolled mode commits the next state itself.
Invalid selection props, including invalid snapshots, render an unavailable state
and emit one selection error; invalid imperative selections reject without
committing. A partial selection that explicitly supplies `screenPath` without
`snapshotId` returns to current content and clears a historical selection;
viewport, scheme, filter, search and tag changes retain it. Shell links and
pending route intents propose `{ screenPath, snapshotId }` atomically. The
component workspace's variant bar links to the parent's sibling variant
entries, proposing `select({ screenPath })` for the chosen variant; in controlled
mode it changes only after the host supplies that selection back. Comparison
mode behavior across siblings follows
[variant navigation](./mokly-variant-navigation.md). A committed selection
replaces frames and announces `onScreenNavigate` once under the event identity
rule above. Switching control mode requires remounting.
Never mutate supplied objects/arrays.

The Viewer rebuilds `variantOf` for current and removed entries of both kinds
from the public model, so its hierarchy, breadcrumbs, details rows, aggregate mark, and
removed-variant adoption match Serve. Removed variants attach only to a current
non-variant parent; otherwise each remains one flat fallback row, and every
removed entry appears exactly once. A shell-link activation while `view` is
`changes` proposes one atomic selection. An aggregate-only parent proposes its
first visible changed variant's `screenPath`. If the current selection is not
itself a changed entry, a changed destination also proposes the first changed
view's `viewport` and `colorScheme` from the public model's per-view comparison
states, ordered mobile/light, mobile/dark, desktop/light, desktop/dark, unless
the link contains at least one valid explicit axis. The shared parser accepts
an axis only when its query has exactly one supported value; it ignores invalid
or repeated values and parses the other axis independently. Valid axes apply in
the same complete selection proposal, omitted axes retain their sticky values,
and an axis-only link to the current destination still proposes the change.
Only a valid explicit axis suppresses first-changed-view landing. Once a changed
entry is selected, later shell-link
activations preserve the sticky axes while aggregate-parent redirection remains
active. An imperative `select` call and supplied `defaultSelection` or
`selection` props also keep their axes. Controlled mode emits the complete
proposal and waits for the host to supply it back.

Removed-entry `/view/<path>/` URLs carry at most one validated
`snapshot=<64-hex>` query. Direct URLs, SSR/hydration and Back/Forward restore
the exact record. The query stays through viewport, scheme and filter changes
and is removed by navigation to current content. A path/snapshot mismatch is
unavailable. Titles, breadcrumbs, Details, status, active rows, preview lookup,
and navigation events always use the resolved removed record. Removed screens
expose only their read-only previous version, with no component picking,
inspection, or comparison action.

Free text and tags follow the single [search rule](./mokly-folders.md#titles).
Public selection carries the normalized phrase as `search` and the deduplicated
list as `tags`; the visible input still displays those tags
as today's `tag:` terms. Navigation proposes any filter clearing needed to
reveal its destination as one atomic selection update. Light-only views retain
the existing fallback labels when Dark is selected; no fake dark view is made.
The shared workspace resolver uses that effective Light view for the title
status, hidden-change marks, and comparison presentation in both SSR and the
hydrated Viewer. When ready evidence does not cover every effective shown view,
the Viewer preserves the public entry's status and comparison eligibility
independently instead of deriving eligibility from the fallback status.

Per-view resolution returns the shown status, comparison eligibility, and
whether matching evidence produced them. Ready evidence applies only when its
entry path matches the selected preview. Missing, pending, or nonmatching
evidence may retain the entry-level displayed status, but it must preserve the
entry's existing comparison eligibility rather than deriving new eligibility
from that fallback status. Server rendering,
controlled selection, comparison deep links, and background evidence updates
use the same decision. A deep link is honored only after that decision confirms
eligibility, and every matching evidence update recomputes it in place.
When Both is displayed, matching evidence must cover both effective rendered
views. Partial evidence uses the fallback status and existing eligibility
together until a complete matching update arrives.

`onSelectionChange` reports requested state changes. `onScreenNavigate` fires
once after a committed entry, snapshot or fragment transition, including accepted
frame links and Back/Forward; it is observational, not a second router.
Unknown frame-link behavior for standalone, uncontrolled, and controlled hosts
is owned by the [navigation contract](./mokly-navigation.md#enhanced-navigation-and-safe-degradation).
Instance hover/click reports scoped keys and current frame-relative boxes;
hover exit uses null and empty boxes, clicks always have an instance. Flow
events identify the owning use case and step without changing the screen's key.
Titles/props come from the read model, never from cross-origin DOM messages.
Automatic inspection requires a frame's own ready, bounded usage; unavailable
siblings remain navigable but emit no pointer inspection events. Every current,
visible frame with ready usage can emit authenticated hover/click events,
independent of an explicit highlight's mask and label scope. Such a click leaves
an idle highlight intact and ends inspection only while a pick is active.
Evidence updates refresh built-in adapters without reloading unchanged documents.
Inspection ownership, evidence invalidation, exact multi-frame highlighting,
marker positioning and the shared geometry scheduler are defined by
[Viewer Markers And Multi-Instance Highlights](./mokly-viewer-markers.md).

`highlightInstance`, `highlightInstances` and `scrollToInstance` operate on
exact current views and reject missing/unavailable instances without navigation
or replacement guessing. Empty multi-highlight and null single-highlight clear.
Multi-highlight validation is atomic and leaves the prior presentation intact
on failure. `startPick` starts only on an inspectable Current view, emits
`onPickStart` after activation, and reuses the existing inspection visuals.
The first accepted instance click emits `onInstanceClick`, ends pick, then emits
`onPickEnd({ reason: "selected", instance })`. Cancel, Escape, navigation,
source replacement, evidence invalidation and errors end an active pick exactly once with their reason.
`cancelPick` is idempotent. Pick emits no selection callback unless selection
actually changes. No pick button is added to the default local shell.
Concurrent `startPick` calls share one activation and one start event. Cancelling
a pending activation rejects its promise; only an activated pick emits an end
event. Starting pick focuses the viewer so keyboard cancellation stays scoped.
Any actual frame replacement, including viewport, effective scheme, entry or
fragment changes, ends active picking exactly once with `navigation`, cancels
pending activation and clears inspection masks, labels and selection. A pending
pick emits neither start nor end; a subsequent start activates the replacement
frames. Changes that preserve the mounted views do not end picking.
Public operations retain complete `InstanceRef` scope, including the exact
entry, viewport, effective scheme and flow step. Package labels and markers refresh
after inner geometry, outer viewer scrolling, viewer/frame resizing, expansion,
replacement and evidence adoption. Late asynchronous work is fenced by request
and frame generation; obsolete promises reject with `disposed` and cannot affect
replacement presentation or events.
Current async failures reject the handle promise and emit one `onError`; error messages
are product-safe and contain no private paths. Unmount cancels without later
callbacks. User callback exceptions are not reclassified as viewer errors.
A mount failure and a pending pick awaiting that mount share one error report;
cancelling that activation preserves the originating failure.
During teardown every frame and runtime cleanup runs even when a host callback
throws. Subscriptions, pending mounts, observers, resize/slot resources and scoped
listeners are released, then the original exception is rethrown unchanged.

## Rendered Features And Slots

The viewer renders the existing [Browse shell](./mokly-runtime.md#browse-shell),
[component explorer](./mokly-component-explorer.md) and
[navigation](./mokly-navigation.md): catalogue trees and filters, route chrome,
responsive frames and controls, comparisons, inspection and ordered flows. It
retains existing accessibility, responsive and unavailable/loading/empty states;
this API introduces no redesigned screen. Documents render in the
complete-document frame, one document per scheme and no viewport axis
([documents](./mokly-documents.md)); a moved entry reads `Moved` with its
previous path in details ([moves](./mokly-moves.md)). Removed entries load their
[previous version](./mokly-removed-previews.md) only from advertised catalogue
paths.

The embedded viewer's public catalogue has no branch-point usage data. Its
Details show no input changes (Before and Current props), whether an entry
moved or stayed at the same path. Serve and export shells include that data
and show input changes.

Slots are optional React-owned content containers. `topBarStart`/`topBarEnd`
adjoin the existing top bar; `railStart`/`railEnd` adjoin the navigation rail.
`sidePanel` adds a host-owned panel beside the stage with host-specified width;
the host owns its responsive content and accessible controls. `stageOverlay`
covers only the stage; the host explicitly chooses pointer events, using `none`
for passive annotations. It cannot silently intercept shell navigation.
`emptyState` replaces only the no-selection/home body, not loading, fetch errors,
missing current screens or unavailable evidence. Omitted slots add no visible
space or controls. Slot children are ordinary React children of the shell
tree and may rerender without resetting viewer state; the shell never reaches
into their DOM or event handlers.
The separate marker layer positions host React content on exact instances; it is
not a general stage overlay and exposes no raw geometry.

The embedded top-bar host remains one 48px row even when both top-bar slots are
present. At a container width of 560px or less, the package-owned search field
becomes a 30px square search control. Activating it opens a full-width search
surface over the same row, focuses an input at least 160px wide down to a 320px
viewer, and leaves both host slot subtrees mounted. Close or Escape restores the
search control and its focus. This behavior follows the viewer container rather
than the browser viewport, so a narrow viewer embedded in a wide page still
uses compact search.

## Theming And Ownership

`theme` selects an embedded root's interface appearance as `"auto"`, `"light"`
or `"dark"`; omission means Auto. `selection.colorScheme` independently selects
preview documents, so either preview scheme can sit inside either interface
appearance. Changing `theme` updates only the root and preserves frame sessions,
selection, temporary props, inspection and host slots. Standalone Browse instead
renders one Appearance selector that controls both values. Its preference,
first-paint and URL-pin behavior is the
[appearance contract](./mokly-viewer-appearance.md).

Import `@mokly/viewer/styles.css` once. Its public accent surface and internal
ownership follow the [shell design](./mokly-shell-design.md) and
[brand contract](./mokly-shell-brand.md). Scoped styles exclude the host page
and slot content; do not inject host CSS into frames.
The host must give the viewer's containing element a definite height. The viewer
fills that height, clips its outer shell and owns scrolling within the stage and
other bounded shell regions; the embedding document must not be the stage scroll
container. `height: 100vh` is appropriate for a full-page host, while panels can
use any definite application-owned height.

## Shell Tree And State

The shell is one React component tree under `packages/viewer/src/shell`. It is
rendered on the server for first paint and hydrated in the browser by every
delivery mode: `MoklyViewer` in React hosts, and the standalone hydration entry
in Serve and export. There are no runtime-owned islands, no string-rendered
markup injected into the tree, and no second implementation of any shell
interaction. Route content renders from the validated catalogue read model;
navigation never fetches and swaps shell HTML. Controlled props and handle
methods update shell state. The only pre-hydration ownership handoffs are the
document Appearance mark/control and early disclosure/width values: classic
startup assets establish them before paint, and the shell adopts them before
hydration. React owns the resulting shell state and render thereafter, while
the appearance controller retains preference and system-theme listening.
Frames remain static documents in sandboxed iframes. Hydration reaches inside
only viewer-owned removed-preview and [comparison-pane](./mokly-comparison-panes.md)
`srcdoc`, installing their guard and scrolling controller.
Current documents retain their existing adapter and sandbox boundaries.

Shell state is one store scoped to a mounted viewer:

- **Route** is derived from the URL and is the only source of route truth:
  the entry, comparison selection and the validated `fragment` query. The
  shared parser turns `/view/<path>/`, `/view/<path>`, or
  `/view/<path>/index.html` into a path; the entry and its kind resolve through
  the read model, and standalone modes normalise history to the canonical form.
  Standalone modes own the document URL and history; React hosts receive route
  changes through `onScreenNavigate` and own their own URL.
- **Selection** is the public `ViewerSelection`: entry path, All/Changes view,
  viewport, colour scheme, search phrase and tags. Standalone modes keep
  viewport, scheme and filters in memory across in-shell navigation.
- **Disclosure** covers navigation groups, the details inspector, navigation
  split width and responsive drawer. Group storage and recovery follow the
  [disclosure persistence contract](./mokly-disclosure-persistence.md). Details
  and split-width choices persist per served origin; the drawer and tag picker
  panel reset on reload.
- **Scroll** is tracked per shell `data-mokly-scroll` region for history;
  comparison-document regions and the persisted or mount-scoped Scroll together
  choice follow their [scrolling contracts](./mokly-comparison-scrolling.md).
- **Workspace** state (props under edit, inspector tab and pane size, active
  pick, highlight scope) lives with the mounted view and is discarded on route
  change or source replacement.

A watched reload restores the one-shot shell snapshot defined by the
[watch contract](./mokly-watch.md), including the disclosure and pre-filter
baseline values governed by the [persistence contract](./mokly-disclosure-persistence.md).
Native disclosure choices made before hydration complete are captured by the
pre-hydration script and take precedence over
older preferences and the snapshot; capture state is removed after hydration or
exit. Static export may resolve its shared catalogue after the document `load`
event, so capture remains authoritative through the actual hydration boundary.
The ordering is strict: the pre-hydration entry first reflects stored
disclosure and split-width preferences into the server DOM, native disclosure
activations may then update that DOM, the browser entry passes the resulting
values to React as initial store state and persists the adopted disclosure
state, and only then is temporary capture discarded. React does not replay or
overwrite those values after mounting. Hydration must produce no mismatches:
the server tree and the initial client tree are the same function of the same
read model, route, selection and delivery descriptor. Serve embeds its scoped
model and paired private workspace directly. Static pages embed a compact
identity/revision reference and hydrate only after the shared complete catalogue
has been fetched and matched; failure leaves SSR intact. Canonical embedded
state is serialized once and its exact text survives later React renders.

A source change (object/fetcher identity, URL value, object base origin), or
adapter change, remounts the shell tree, cancelling stale loads, pick and frame
sessions. Selection changes do not remount it. Cleanup tolerates React effect
setup/cleanup replay with no duplicate listeners or requests. Within an
unchanged source, first-party Serve supplies its private capabilities (update
stream, reload recovery, evidence revisions, temporary control previews and
on-demand rendering) through a typed React context that the CLI provides and
export leaves unset. Evidence revisions apply in place; content changes use the
reload lifecycle. Private tokens/evidence never enter catalogue JSON, and hosts
do not need undocumented manifest access. The
[live capability contract](./mokly-live-capabilities.md) defines descriptor
privacy, route and revision fencing, cancellation, recovery and export
omission.

## SSR, Hydration And Host Independence

Server rendering, `viewerId`, hydration in every delivery mode, the React-free
inspector exception, and the viewer's host-independence and network boundary
are defined by [viewer SSR and hydration](./mokly-viewer-ssr.md).

Acceptance includes all props, slots, events, handle methods, controlled-state
round trips, multiple independent mounts, SSR/client lifecycle cleanup,
hydration without mismatches on every fixture route, source replacement,
same/cross-origin frames and the existing local browser tests passing against
the hydrated shell. Standalone coverage enforces the scoped-bootstrap contract.
Behavioural parity under `tests/browser` is the bar; shell module bytes and the
derived export deployment identity may change with viewer source.
