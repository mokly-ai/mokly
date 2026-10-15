# Embeddable Mokly Viewer

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Package And Props

`@mokly/viewer` is an MIT, ESM npm package with declarations and React and React DOM
`>=19.0.0` peers. `@mokly/mokly` depends on its exact released version. The
viewer never imports the CLI, Node built-ins, Git, or consumer code, and it
renders only in the browser. Its shared shapes are the generated types of the
Rust model crate. The package has four entry points:

- The root React entry exports `MoklyViewer`, its types, the frame adapters,
  `resolveInstance`, and the readers of the catalogue index and the entry
  detail. A React host renders the viewer in the browser with its own React.
- The `./browser` entry mounts the standalone Browse shell into the
  `data-mokly-shell` element of the stub that the
  [shell delivery contract](./mokly-shell-delivery.md) defines. Serve and
  `build` deliver it as `/mokly-viewer/client/shell.js`.
- `./data` exports, with no React dependency, the pure path functions and directory names of the [artifact path contract](./mokly-artifact-paths.md), the path grammar of the [path contract](./mokly-paths.md), and the prop schema validators of the [entry props contract](./mokly-entry-props.md#prop-schema-profile); `./styles.css` is the scoped stylesheet of an embedded root.

Every delivery renders the shell from data in the browser.

```ts
import type { CSSProperties, ReactNode, Ref } from "react";
import type { CatalogueReadModel, EntryDetailV1 } from "@mokly/viewer";
import type { FrameAdapter, Box, FrameNavigation } from "@mokly/viewer";
import type { InstanceRef, ViewerMarker, MarkerState } from "@mokly/viewer";

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
/** The catalogue index v7 as an object, or its absolute HTTP(S) URL. */
type IndexSource = CatalogueReadModel | string | URL;
type DetailResult = EntryDetailV1 | string | URL;
/** One entry detail v1, or its URL; a removed entry names its snapshot. */
type DetailSource = (
  entryPath: string,
  snapshotId?: string,
) => DetailResult | Promise<DetailResult>;
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
type ViewerError = import("@mokly/viewer").ViewerError;
type ViewerTheme = "auto" | "light" | "dark";
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
  index: IndexSource;
  detail: DetailSource;
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

`InstanceRef` is the [instance contract](./mokly-instances.md); `ViewerMarker`
and `MarkerState` are the [marker contract](./mokly-viewer-markers.md).
`ScreenNavigateEvent` names the destination by `screenPath`. Its `snapshotId`
is present when the committed historical record has an opaque identity that
the index publishes, and absent otherwise. The event has no `route`,
`variantId`, or `kind`: hosts resolve the entry through the index and use
`viewHref(path)` of the [artifact path contract](./mokly-artifact-paths.md)
for its shell URL.

`index` is the catalogue index v7. For an object source, `baseUrl` is
required and supplies the HTTP(S) artifact origin root. A URL or string source
must be an absolute HTTP(S) URL; its validated final response URL establishes
that root, and `baseUrl` is invalid for it. Do not resolve artifact paths
relative to the embedding application. The viewer validates every index as
[read model v7](./mokly-catalogue.md) before it renders.

`detail` supplies the entry detail v1 of one entry. The viewer calls it with
the entry path, plus the `snapshotId` of a removed record, when it commits a
selection whose detail it does not hold. The result is a detail object, a URL
on the artifact origin root, or a promise of either. A URL is fetched under the
fetch rules of the shell delivery contract: same origin, `credentials: "omit"`,
no redirect outside the origin. A detail is accepted only under the fences of
that contract: `identity`, `deploymentId`, and `revision` equal to the
installed index for a current entry, and `generation` and `snapshotId` equal
to the index's record for a removed entry. On a revision mismatch the viewer
requests the index again once; a detail that still disagrees leaves the entry
unavailable with a retry control, and a different `deploymentId` emits one
`onError` and leaves the installed state in place. A detail that arrives after
the selection moved on is discarded. Sources are host-supplied transports, not
permission for viewer telemetry. A fetch failure renders an explicit error and
retry state and emits `onError`. A version failure shows the headline of the
[version contract](./mokly-viewer-namespace.md) without an action and emits
`onError` with `code: "version"`, the headline, and the details. Missing data
is never replaced by examples or invented counts.

Omitted `frameAdapter` uses `sameOriginAdapter()`. Cross-origin hosts
explicitly provide `postMessageAdapter({ frameOrigin })` under the
[adapter protocol](./mokly-frame-adapter.md). One adapter can mount several
independent frames; it owns no global document state.

## Selection, Events And Imperative Use

`screenPath` names one catalogue entry path: a screen, page, document, use
case, component, or a screen or component [variant](./mokly-variants.md); null
selects home. A path with no current or removed entry shows the not-found view
with usable navigation. A variant of either kind is selected by its own path;
selecting a component parent shows the parent's own view, rendered from its
own props, and there is no separate variant selection field. `view` selects
the All/Changes **catalogue filter**, not a comparison mode. Logical fragments
and comparison mode keep their route and runtime state.

`snapshotId` is the optional opaque identity published beside a removed entry
of any kind. With it, the pair must resolve exactly one removed record; an
unknown, stale, or cross-catalogue identity is unavailable. A path-only
selection of a removed record normalizes to its published identity when
present. Readers reject an index where a current and a removed record share a
path. When a newer index arrives, the selected removed record is matched by
its identity; a replaced or missing record becomes unavailable without
retargeting. The `snapshot` query of the removed entry's `/view/<path>/` URL,
its survival across axis and filter changes, and its removal by navigation to
current content follow the
[shell destination contract](./mokly-shell-destinations.md). Direct URLs and
Back/Forward restore the exact record, and titles, breadcrumbs, Details,
status, active rows, preview lookup, and navigation events always use it.
Removed screens expose only their read-only previous version, with no
component picking, inspection, or comparison action.

Defaults are home, All, Both, Light, empty search and no tags, overridden once
by `defaultSelection`. `selection` supplies the complete controlled state;
when present, require `onSelectionChange` and do not also accept
`defaultSelection`. A user action or imperative `select` merges a partial
update into current state, validates it and emits a complete next state only
if changed. Controlled changes stay proposals until the host supplies them
back; incoming props do not echo an event. Uncontrolled mode commits the next
state itself. Invalid selection props, including invalid snapshots, render an
unavailable state and emit one selection error; invalid imperative selections
reject without committing. A partial selection that explicitly supplies
`screenPath` without `snapshotId` returns to current content and clears a
historical selection; viewport, scheme, filter, search and tag changes keep
it. Shell links and pending route intents propose `{ screenPath, snapshotId }`
atomically. The component page's variant bar links to the parent's own entry
and its variant entries, proposing `select({ screenPath })` for the chosen
entry; comparison mode across siblings follows
[variant navigation](./mokly-variant-navigation.md). A committed selection
replaces frames and announces `onScreenNavigate` once. Switching control mode
requires remounting. Never mutate supplied objects or arrays.

The viewer rebuilds `variantOf` for current and removed entries of both kinds
from the index, so its hierarchy, breadcrumbs, details rows, aggregate mark,
and removed-variant adoption match Serve; removed variants attach only to a
current non-variant parent, otherwise each stays one flat fallback row, and
every removed entry appears exactly once. A shell-link activation while `view`
is `changes` proposes one atomic selection: an aggregate-only parent proposes
its first visible changed variant, and a changed destination opened from an
entry that is not itself changed also proposes its first changed view's axes
under the [Changes screen controls](./mokly-changes-controls.md#screen-controls),
unless the link carries a valid explicit axis under the shell destination
contract. Sticky axes otherwise survive shell links, imperative `select`
calls and supplied selection props.

Free text and tags follow the single [search rule](./mokly-folders.md#titles).
Public selection carries the normalized phrase as `search` and the deduplicated
list as `tags`; the visible input displays those tags as `tag:` terms.
Navigation proposes any filter clearing needed to reveal its destination as one
atomic selection update. Light-only views keep the fallback labels when Dark is
selected; no fake dark view is made. The shown status, the hidden-change marks
and the comparison eligibility of the effective views follow the Changes
screen controls in every delivery, with ready evidence applied only when its
entry path matches the selected preview. Controlled selection, comparison deep
links, and detail updates use that one decision; a deep link is honoured only
after it confirms eligibility, and every matching update recomputes it in
place.

`onSelectionChange` reports requested state changes. `onScreenNavigate` fires
once after a committed entry, snapshot or fragment transition, including
accepted frame links and Back/Forward; it is observational, not a second
router. Unknown frame-link behaviour for standalone, uncontrolled, and
controlled hosts is owned by the
[navigation contract](./mokly-navigation.md#enhanced-navigation-and-safe-degradation).
Instance hover and click report scoped keys and current frame-relative boxes;
hover exit uses null and empty boxes, clicks always have an instance. Flow
events identify the owning use case and step without changing the screen's
key. Titles and props come from the index and the detail, never from
cross-origin DOM messages. Automatic inspection requires a frame's own ready,
bounded usage from the detail; unavailable siblings stay navigable but emit no
pointer inspection events. Every current, visible frame with ready usage can
emit authenticated hover and click events, independent of an explicit
highlight's mask and label scope; such a click leaves an idle highlight intact
and ends inspection only while a pick is active. A detail update refreshes the
usage of mounted frames without reloading a frame whose `documentKey` is
unchanged. Inspection ownership, evidence invalidation, multi-frame
highlighting, marker positioning and the shared geometry scheduler are the
marker contract.

`highlightInstance`, `highlightInstances` and `scrollToInstance` operate on
exact current views and reject missing or unavailable instances without
navigation or replacement guessing; null and empty arguments clear.
`startPick` starts only on an inspectable Current view, emits `onPickStart`
after activation, and reuses the inspection visuals. The first accepted
instance click emits `onInstanceClick`, ends pick, then emits
`onPickEnd({ reason: "selected", instance })`. Cancel, Escape, navigation,
source replacement, evidence invalidation and errors end an active pick
exactly once with their reason; `cancelPick` is idempotent, and pick emits no
selection callback unless selection actually changes. No pick button exists
in the standalone shell. Concurrent `startPick` calls share one activation
and one start event; cancelling a pending activation rejects its promise, and
only an activated pick emits an end event. Starting pick focuses the viewer so
keyboard cancellation stays scoped. Any actual frame replacement, including
viewport, effective scheme, entry or fragment changes, ends active picking
exactly once with `navigation`, cancels pending activation and clears
inspection masks, labels and selection; changes that preserve the mounted
views do not end picking. Public operations keep the complete `InstanceRef`
scope. Late asynchronous work is fenced by request and frame generation;
obsolete promises reject with `disposed` and cannot affect replacement
presentation or events. Async failures reject the handle promise and emit one
product-safe `onError` without private paths. Unmount cancels without later
callbacks, user callback exceptions are not reclassified as viewer errors, and
during teardown every frame and runtime cleanup runs even when a host callback
throws, after which the original exception is rethrown unchanged.

## Rendered Features And Slots

The viewer renders the [Browse shell](./mokly-runtime.md),
[component pages](./mokly-component-explorer.md) and
[navigation](./mokly-navigation.md): catalogue trees and filters, route chrome,
responsive frames and controls, comparisons, inspection and ordered flows,
with their accessibility, responsive, unavailable, loading and empty states.
Documents render in the complete-document frame, one document per scheme and
no viewport axis ([documents](./mokly-documents.md)); a moved entry reads
`Moved` with its previous path in details ([moves](./mokly-moves.md)). Removed
entries load their [previous version](./mokly-removed-previews.md) only from
the advertised comparison generation. Details show the workspace of the entry
detail in every delivery: Used by, Affected screens, related changed
components, and input changes with Before and Current props.

Slots are optional React-owned content containers. `topBarStart` and
`topBarEnd` adjoin the top bar; `railStart` and `railEnd` adjoin the
navigation rail. `sidePanel` adds a host-owned panel beside the stage with
host-specified width; the host owns its responsive content and accessible
controls. `stageOverlay` covers only the stage; the host explicitly chooses
pointer events, using `none` for passive annotations, and it cannot silently
intercept shell navigation. `emptyState` replaces only the no-selection home
body, not loading, fetch errors, missing current screens or unavailable
evidence. Omitted slots add no visible space or controls. Slot children are
ordinary React children of the shell tree and may rerender without resetting
viewer state; the shell never reaches into their DOM or event handlers. The
separate marker layer positions host React content on exact instances; it is
not a general stage overlay and exposes no raw geometry.

The embedded top-bar host is one 48px row even when both top-bar slots are
present. At a container width of 560px or less, the package-owned search field
becomes a 30px square search control. Activating it opens a full-width search
surface over the same row, focuses an input at least 160px wide down to a
320px viewer, and leaves both host slot subtrees mounted. Close or Escape
restores the search control and its focus. This behaviour follows the viewer
container, not the browser viewport.

## Theming And Ownership

`theme` selects an embedded root's interface appearance as `"auto"`, `"light"`
or `"dark"`; omission means Auto. `selection.colorScheme` independently
selects preview documents, so either preview scheme can sit inside either
interface appearance. Changing `theme` updates only the root and preserves
frame sessions, selection, temporary props, inspection and host slots.
Standalone Browse instead renders one Appearance selector that controls both
values under the [appearance contract](./mokly-viewer-appearance.md).

Import `@mokly/viewer/styles.css` once. Its public accent surface and internal
ownership follow the [shell design](./mokly-shell-design.md) and
[brand contract](./mokly-shell-brand.md). Scoped styles exclude the host page
and slot content; do not inject host CSS into frames. The host must give the
viewer's containing element a definite height. The viewer fills that height,
clips its outer shell and owns scrolling within the stage and other bounded
shell regions; the embedding document must not be the stage scroll container.

## Shell Tree And State

The shell is one React component tree that renders only in the browser:
`MoklyViewer` in React hosts, and the `./browser` entry in the stub that Serve
and `build` deliver. There are no runtime-owned islands, no string-rendered
markup injected into the tree, and no second implementation of any shell
interaction. Route content renders from the validated index and the current
entry's detail; navigation never fetches shell HTML. Controlled props and
handle methods update shell state. The bundle reads the stored appearance,
disclosure and navigation-width preferences before its first render, so no
pre-render script and no ownership handoff exists. Frames are static
documents in sandboxed iframes; the shell reaches inside only viewer-owned
removed-preview and [comparison-pane](./mokly-comparison-panes.md) `srcdoc`
documents, to install their guard and scrolling controller.

Shell state is one store scoped to a mounted viewer:

- **Route** is derived from the URL and is the only source of route truth:
  the entry, comparison selection and the validated `fragment` query. The
  shared parser turns `/view/<path>/`, `/view/<path>`, or
  `/view/<path>/index.html` into a path; the entry and its kind resolve
  through the index. The standalone shell owns the document URL and history
  and normalises it to the canonical form; React hosts receive route changes
  through `onScreenNavigate` and own their own URL.
- **Selection** is the public `ViewerSelection`. The standalone shell keeps
  viewport, scheme and filters in memory across in-shell navigation.
- **Disclosure** covers navigation groups, the details inspector, navigation
  split width and responsive drawer. Group storage and reconciliation follow
  the [disclosure persistence contract](./mokly-disclosure-persistence.md).
  Details and split-width choices persist per origin; the drawer and tag
  picker panel reset on a full page load.
- **Scroll** is tracked per shell `data-mokly-scroll` region for history;
  comparison-document regions and the Scroll together choice follow their
  [scrolling contracts](./mokly-comparison-scrolling.md).
- **Workspace** state (props under edit, inspector tab and pane size, active
  pick, highlight scope) lives with the mounted view and is discarded on
  route change or source replacement.
- **Data** is the installed index and the details the shell holds for the
  page's lifetime. In Serve the standalone shell follows the event stream of
  the shell delivery contract: a publication raises `revision`, the shell
  fetches the index and the current route's details, adopts them in one store
  commit, updates the navigation, Changes marks, Usage and Details in place,
  and reloads only the mounted frames whose `documentKey` changed; only a
  message from another server process reloads the page. A React host supplies newer data by replacing `index`.

A source change (index object identity, URL value, object base origin, or
`detail` function identity) or an adapter change remounts the shell tree,
cancelling stale loads, pick and frame sessions. Selection changes do not
remount it. Cleanup tolerates React effect setup and cleanup replay with no
duplicate listeners or requests. The standalone shell in Serve reads the
temporary-render capability from the live descriptor under the
[component controls contract](./mokly-component-controls.md#rendering-boundary); a static build has
no descriptor, and a React host has no live capability, so its controls are
read-only under the [controls contract](./mokly-component-controls.md).
Private tokens never enter the index or a detail.

## Host Independence

The viewer fetches only the index, the details, documents, removed previews,
and comparison generation files of its artifact origin root, under the fetch
rules of the [shell delivery contract](./mokly-shell-delivery.md#fetch-and-fences)
contracts. It sends no telemetry and reads no cookies. Consumer code never
enters the browser through the viewer. The in-frame inspector script of the
frame adapter contract is the one React-free part of the package. Several
viewers can mount in one document with independent state, and each cleans up
on unmount. Acceptance covers all props, slots, events, handle methods,
controlled-state round trips, multiple independent mounts, source replacement,
same-origin and cross-origin frames, a Serve publication that reloads only
changed frames, and the browser suite against the standalone and embedded
shells.
