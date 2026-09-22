# Embeddable Mokly Viewer

## Delivery Status

The package, React API, static server entry and first-party hosts were
implemented by the [viewer library plan](../../plans/mokly-viewer-library.md),
and [coordinated release preparation](./npm-release.md) by its Milestone 6.
Saved-variant selection, multi-instance highlights and markers are implemented
by the [comment anchoring plan](../../plans/viewer-comment-anchoring.md) and
remain part of the hydrated shell's public contract.
This document now defines the hydrated shell contract delivered by the
[React Browse shell plan](../../plans/react-browse-shell.md): one React
component tree rendered on the server and hydrated in every delivery mode.
Serve, export and application-owned hosts now use that tree directly. Local
Serve/export presentation remains unchanged.
Removed pages and screens load their advertised previous versions in local,
static, and embedded hosts through the same tree, as implemented by the
[removed content previews plan](../../plans/removed-content-previews.md).

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
  screenId: string | null;
  /** Saved variant of a selected component; absent means its default. */
  variantId?: string;
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
  screenId: string;
  variantId?: string;
  stepIndex?: number;
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
  key: string;
}
interface InstanceEvent {
  instance: InstanceRef | null;
  boxes: readonly Box[];
  frame: { entryId: string; stepIndex?: number };
}
interface ScreenNavigateEvent {
  screenId: string;
  route: string;
  variantId?: string;
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

For an object source, `baseUrl` is required and supplies its HTTP(S) artifact
origin root. A URL/string source must be an absolute HTTP(S) catalogue URL;
its validated final response URL establishes that root. A fetcher returns the
same pair explicitly and must honor cancellation; `baseUrl` is invalid for URL
or fetcher sources. Do not resolve artifact paths relative to the embedding app.
Validate every source as [catalogue v1](./mokly-catalogue.md) before rendering.
Fetchers are host-supplied source transports, not permission for viewer telemetry.
Fetch failure renders an explicit error/retry state and emits `onError`.
Missing data is never replaced by examples or invented counts.

Omitted `frameAdapter` uses `sameOriginAdapter()`. Cross-origin hosts explicitly
provide `postMessageAdapter({ frameOrigin })` under the
[adapter protocol](./mokly-frame-adapter.md). One adapter can mount several
independent frames; it owns no global document state.

## Selection, Events And Imperative Use

`screenId` addresses any routed catalogue entry, including pages, components,
use cases and [variant screens](./mokly-screen-variants.md); null selects
home. Unknown ids show the existing not-found view
with usable navigation. `variantId` is valid only for a component or removed
component that declares that saved variant; omission selects its default.
It never addresses a variant screen, which is selected by its own `screenId`.
Variants are invalid for home, pages and use cases. `view` selects the
All/Changes **catalogue filter**, not a comparison mode. Logical fragments and
comparison mode retain their existing route/runtime state.

Defaults are home, All, Both, Light, empty search and no tags, overridden once
by `defaultSelection`. `selection` supplies the complete controlled state;
when present, require `onSelectionChange` and do not also accept
`defaultSelection`. A user action or imperative `select` merges a partial update
into current state, validates it and emits a complete next state only if changed.
Controlled changes remain proposals until the host supplies them back; incoming
props do not echo an event. Uncontrolled mode commits the next state itself.
Invalid selection props, including invalid variants, render an unavailable state
and emit one selection error; invalid imperative selections reject without
committing. A partial selection that changes `screenId` without naming
`variantId` drops the prior variant. Shell links and pending route intents
propose `{ screenId, variantId }` atomically. The workspace variant control
proposes `select({ variantId })`; in controlled mode it changes only after the
host supplies that selection back. A committed variant replaces frames and
announces `onScreenNavigate` once. Switching control mode requires remounting.
Never mutate supplied objects/arrays.

The Viewer rebuilds `variantOf` for current and removed screens from the public
model, so its hierarchy, breadcrumbs, details rows, aggregate mark, and
removed-variant adoption match Serve. A shell-link activation while `view` is
`changes` proposes one atomic selection. An aggregate-only parent proposes its
first visible changed variant's `screenId`. If the current selection is not
itself a changed route, a changed destination also proposes the first changed
view's `viewport` and `colorScheme` from the public model's per-view comparison
states, ordered mobile/light, mobile/dark, desktop/light, desktop/dark, unless
the link names either axis. Once a changed route is selected, later shell-link
activations preserve the sticky axes while aggregate-parent redirection remains
active. An imperative `select` call and supplied `defaultSelection` or
`selection` props also keep their axes. Controlled mode emits the complete
proposal and waits for the host to supply it back.

Free text and tags follow [Browse search](./mokly-runtime.md#browse-shell):
parse case-insensitive `tag:` terms out of search into a deduplicated tag list,
retain the remaining phrase as `search`, and require every tag plus that phrase.
Normalization is deterministic; the visible input still displays those tags
as today's `tag:` terms. Navigation proposes any filter clearing needed to
reveal its destination as one atomic selection update. Light-only views retain
the existing fallback labels when Dark is selected; no fake dark view is made.
The shared workspace resolver uses that effective Light view for the title
status, hidden-change marks, and comparison presentation in both SSR and the
hydrated Viewer. When ready evidence does not cover every effective shown view,
the Viewer preserves the public entry or saved variant's status and comparison
eligibility independently instead of deriving eligibility from the fallback
status.

`onSelectionChange` reports requested state changes. `onScreenNavigate` fires
once after a committed route/variant/fragment transition, including accepted
frame links and Back/Forward; it is observational, not a second router.
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
Any actual frame replacement, including viewport, effective scheme, saved variant
or fragment changes, ends active picking exactly once with `navigation`, cancels
pending activation and clears inspection masks, labels and selection. A pending
pick emits neither start nor end; a subsequent start activates the replacement
frames. Changes that preserve the mounted views do not end picking.
Public operations retain complete `InstanceRef` scope, including exact viewport,
effective scheme, saved variant and flow step. Package labels and markers refresh
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
this API introduces no redesigned screen. Removed entries load their
[previous version](./mokly-removed-previews.md) only from advertised catalogue
paths.

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

Import `@mokly/viewer/styles.css` once. The supported overrides are
`--mokly-accent`, `--mokly-accent-contrast` and `--mokly-accent-soft`, subject to
the [shell contrast contract](./mokly-shell-design.md). Internal selectors,
geometry, structure and `--chrome-*` tokens are not APIs. Scoped styles exclude
the host page and slot content; do not inject host CSS into frames.
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
methods update shell state, and every rendered attribute is owned by React.
Frames remain static documents in sandboxed iframes. Hydration reaches inside
only the viewer-owned, same-origin `srcdoc` used for a historical removed
preview, where it installs and restores the read-only guard. Current and
comparison documents retain their existing adapter and sandbox boundaries.

Shell state is one store scoped to a mounted viewer:

- **Route** is derived from the URL and is the only source of route truth:
  screen, saved variant, comparison selection and the validated `fragment`
  query. Standalone modes own the document URL and history; React hosts
  receive route changes through `onScreenNavigate` and own their own URL.
- **Selection** is the public `ViewerSelection`: screen, saved variant, All/Changes view,
  viewport, colour scheme, search phrase and tags. Standalone modes keep
  viewport, scheme and filters in memory across in-shell navigation.
- **Disclosure** covers navigation groups (`section:*` and `collection:*`
  identities), the details inspector, the navigation split width and the
  responsive drawer. Navigation, details and split-width choices persist per
  served origin in browser storage under the existing keys; the drawer and the
  tag picker panel do not persist and reset on reload.
- **Scroll** is tracked per `data-mokly-scroll` region and saved into the
  history entry for Back/Forward restoration; route-change focus never
  overrides a restored position.
- **Workspace** state (component variant, props under edit, inspector tab and
  pane size, active pick, highlight scope) lives with the mounted view and is
  discarded on route change or source replacement.

A watched reload captures search, view, viewport, scheme, disclosure
(including the pre-filter baseline), drawer, catalogue scroll, per-region
scroll and the optional validated Changes status into the one-shot recovery
snapshot defined by the [watch contract](./mokly-watch.md); the hydrated shell
restores it exactly as before. Native disclosure choices made before hydration
completes are captured by the pre-hydration script and take precedence over
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
read model, route, selection and delivery descriptor. Serve embeds that read
model directly. Static pages embed a compact identity/revision reference and
hydrate only after the one shared deployment catalogue has been fetched and
matched; resolution failure leaves SSR intact. Embedded hydration and workspace state uses canonical
object-key ordering, and validating then serializing hydration state must
reproduce the embedded bytes exactly.

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

The Node-only `@mokly/viewer/server` entry exports `renderViewer` for Serve and
export. It synchronously accepts a validated object source, its base URL and
initial selection/slots, plus a required stable `viewerId`, and returns the
server-rendered shell tree as HTML;
URL/fetcher sources and browser handles/effects are not accepted during SSR.
`viewerId` contains 1–64 ASCII letters, digits, hyphens or underscores, starts
with a letter or digit, and is unique among viewer roots in the host document.
The host passes the identical value to `renderViewer` and `MoklyViewer` when it
hydrates that output. Package-owned DOM IDs and fragment/ARIA references are
prefixed through a boundary-preserving encoding of this value: distinct valid
viewer IDs cannot collide even when one contains text used by a dynamic local
control ID. The exact generated DOM ID bytes are internal. Host slot descendants
remain untouched. Thus two independently rendered viewers can be safely
composed and hydrated in one document without relying on React's per-render
identifier sequence.
CLI-owned context supplies the existing route, live capabilities or static
delivery descriptor through its server integration. That context already
contains accepted data; it bypasses public-source decoding. Serve validates
each serialized public revision once and shares it across shell requests;
asset delivery never decodes the catalogue. The browser graph never imports
this entry.

First paint is real: the server output is the complete shell with real anchors
for every route, so direct URLs, refresh, alias pages and JavaScript-disabled
use show the correct screen before any script runs. Serve and export then load
the documented standalone hydration entry, which bundles React and hydrates
that tree in place. React hosts render `MoklyViewer` with their own React and
hydrate it the same way. **Exported catalogues ship React and hydrate**; the
former rule that exported browsers contain no React is withdrawn so that one
shell implementation serves every delivery mode. An SSR-only unhydrated export
remains possible because first paint does not depend on hydration, but it is
not a supported mode.

One exception stands: the in-frame inspector script defined by the
[frame adapter contract](./mokly-frame-adapter.md) stays a React-free IIFE
under its 9,216-byte budget. It runs inside consumer documents, not the shell,
and no shell dependency may enter it.

The viewer knows no cloud tenant, auth, comment model, deployment provider or
host route layout. Marker content is host-owned; hosts own surrounding product
UI and data. Viewer network
activity is limited to its configured source and validated public resources or
pinned comparisons from it. That set includes historical HTML documents beneath
the advertised generation's `snapshots/before/` directory when a removed entry
is selected; it adds no analytics, discovery, remote fonts, or background
comparison requests. Existing authored external fragment resources retain
export's resource policy. Serve owns its existing private update/control
transport outside this public fetch boundary. No cookies or ambient credentials
are read/written, and no `window.top` access occurs. Embedding never commandeers
an ancestor router; standalone Serve/export retain their current URL lifecycle.

Acceptance includes all props, slots, events, handle methods, controlled-state
round trips, multiple independent mounts, SSR/client lifecycle cleanup,
hydration without mismatches on every fixture route, source replacement,
same/cross-origin frames and the existing local browser tests passing against
the hydrated shell. Behavioural parity under `tests/browser` is the bar; shell
module bytes and export deployment identity are expected to change.
