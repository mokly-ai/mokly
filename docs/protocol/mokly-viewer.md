# Embeddable Mokly Viewer

## Delivery Status

The baseline API, static server entry and first-party hosts are implemented by
the [viewer library plan](../../plans/mokly-viewer-library.md). Saved-variant
selection, multi-instance highlights and markers are implemented by the
[comment anchoring plan](../../plans/viewer-comment-anchoring.md). Local
Serve/export presentation remains unchanged.

The [viewer appearance contract](./mokly-viewer-appearance.md) defines planned
Auto/Light/Dark interface support, separate from preview color schemes.

## Package And Props

`@mokly/viewer` is an MIT ESM package with React peers. Its public entry exports
`MoklyViewer`, types, adapters, `readCatalogue` and `resolveInstance`.
`./runtime` integrates standalone hosts, `./data` owns pure shared contracts and
`./server` provides Node-only SSR. The viewer never imports the CLI, Git or
consumer code.

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

`screenId` addresses any routed catalogue entry, including pages, components
and use cases; null selects home. Unknown ids show the existing not-found view
with usable navigation. `variantId` is valid only for a component or removed
component that declares that saved variant; omission selects its default.
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

Free text and tags follow [Browse search](./mokly-runtime.md#browse-shell):
parse case-insensitive `tag:` terms out of search into a deduplicated tag list,
retain the remaining phrase as `search`, and require every tag plus that phrase.
Normalization is deterministic; the visible input still displays those tags
as today's `tag:` terms. Navigation proposes any filter clearing needed to
reveal its destination as one atomic selection update. Light-only views retain
the existing fallback labels when Dark is selected; no fake dark view is made.

`onSelectionChange` reports requested state changes. `onScreenNavigate` fires
once after a committed route/variant/fragment transition, including accepted
frame links and Back/Forward; it is observational, not a second router.
Instance hover/click reports scoped keys and current frame-relative boxes;
hover exit uses null and empty boxes, clicks always have an instance. Flow
events identify the owning use case and step without changing the screen's key.
Titles/props come from the read model, never from cross-origin DOM messages.
Automatic inspection requires a frame's own ready, bounded usage; unavailable
siblings remain navigable but emit no pointer inspection events. Evidence
updates refresh built-in adapters without reloading unchanged documents.
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
this API introduces no redesigned screen.

Slots are optional React-owned content containers. `topBarStart`/`topBarEnd`
adjoin the existing top bar; `railStart`/`railEnd` adjoin the navigation rail.
`sidePanel` adds a host-owned panel beside the stage with host-specified width;
the host owns its responsive content and accessible controls. `stageOverlay`
covers only the stage; the host explicitly chooses pointer events, using `none`
for passive annotations. It cannot silently intercept shell navigation.
`emptyState` replaces only the no-selection/home body, not loading, fetch errors,
missing current screens or unavailable evidence. Omitted slots add no visible
space or controls. Slot children may rerender without resetting viewer state;
the enhancement runtime never changes their DOM or React event handlers.
The separate marker layer positions host React content on exact instances; it is
not a general stage overlay and exposes no raw geometry.

## Theming And Ownership

The interface currently uses Light styling; `selection.colorScheme` selects
the preview documents. Independent interface appearance is a
[planned extension](./mokly-viewer-appearance.md), not an implemented prop.

Import `@mokly/viewer/styles.css` once. The supported overrides are
`--mokly-accent`, `--mokly-accent-contrast` and `--mokly-accent-soft`, subject to
the [shell contrast contract](./mokly-shell-design.md). Internal selectors,
geometry, structure and `--chrome-*` tokens are not APIs. Scoped styles exclude
the host page and slot content; do not inject host CSS into frames.

React owns the stable shell and slots; an effect boots the framework-neutral
runtime into route/frame islands that React does not reconcile. Props and handle
methods call runtime operations. Cleanup tolerates effect replay without duplicate
listeners or requests.

A source identity, base origin or adapter change disposes and remounts the
runtime; selection changes do not. Serve may adopt validated evidence in place
through its private host bridge. Export has no live bridge, and private evidence
never enters the public catalogue.

## SSR And Host Independence

The Node-only `@mokly/viewer/server` entry synchronously renders validated object
sources, base URL and initial selection/slots. It rejects URL/fetcher sources and
browser handles. The browser graph never imports it; exports use the same CSS and
vanilla runtime with **no React or hydration**.

The viewer knows no cloud tenant, auth, comment model, deployment provider or
host route layout. Marker content is host-owned; hosts own surrounding product
UI and data. Viewer network
activity is limited to its configured source and validated public resources or
pinned comparisons from it; no analytics, discovery, remote fonts or background
comparison requests are added. Existing authored external fragment resources
retain export's resource policy. Serve owns its existing private update/control
transport outside this public fetch boundary. No cookies or ambient credentials
are read/written, and no `window.top` access occurs. Embedding never commandeers
an ancestor router; standalone Serve/export retain their current URL lifecycle.

Acceptance covers every API, controlled round trips, independent mounts,
SSR/client cleanup, source replacement, both adapters and unchanged standalone
shell presentation.
