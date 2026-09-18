# Embeddable Mokly Viewer

## Delivery Status

The package, React API, static server entry and first-party hosts were
implemented by the [viewer library plan](../../plans/mokly-viewer-library.md),
and [coordinated release preparation](./npm-release.md) by its Milestone 6.
This document now defines the hydrated shell contract delivered by the
[React Browse shell plan](../../plans/react-browse-shell.md): one React
component tree rendered on the server and hydrated in every delivery mode.
Until that plan's flip milestone lands, the shipped shell still renders the
same markup as strings and enhances it with the vanilla runtime under
`packages/viewer/src/client`; the contract below is the target, and the plan
records which milestones deliver each part. Local Serve/export presentation
is unchanged by the transition.

## Package And Props

`@mokly/viewer` is an MIT, ESM npm workspace package under `packages/viewer`,
with declarations and React/React DOM peers. `@mokly/mokly` depends on its
released version; the viewer never imports the CLI, Node, Git or consumer code.
The public React entry exports `MoklyViewer`, its types, the adapters and
`readCatalogue` and `resolveInstance` from the public data contracts.
The documented `./runtime` integration entry supplies recovery and validated
catalogue revision adoption today, and after the flip also standalone
hydration and the capability context Serve provides. Its lazy
revision-adopter loader keeps validation off Serve's startup path.
`./data` owns shared pure value/validation contracts used by CLI producers.
These are package entry points, not aliases for CLI modules. `./server` also
exports typed standalone context and `viewerAssetUrl` for package assets.

```ts
import type { CSSProperties, ReactNode, Ref } from "react";
import type { CatalogueReadModel } from "@mokly/viewer";
import type { FrameAdapter, Box, FrameNavigation } from "@mokly/viewer";

interface ViewerSelection {
  screenId: string | null;
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
  code: "catalogue" | "selection" | "frame" | "comparison";
  message: string;
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
with usable navigation. `view` selects the All/Changes **catalogue filter**,
not Current/Side by side/Overlay/Difference comparison modes. Saved variants,
logical fragments and comparison mode retain their existing route/runtime state;
selecting a component id starts at its default variant.

Defaults are home, All, Both, Light, empty search and no tags, overridden once
by `defaultSelection`. `selection` supplies the complete controlled state;
when present, require `onSelectionChange` and do not also accept
`defaultSelection`. A user action or imperative `select` merges a partial update
into current state, validates it and emits a complete next state only if changed.
Controlled changes remain proposals until the host supplies them back; incoming
props do not echo an event. Uncontrolled mode commits the next state itself.
Invalid selection props render an unavailable state and emit one selection error;
invalid imperative selections reject without committing. Switching control mode requires remounting. Never mutate supplied objects/arrays.

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
Automatic hover/click inspection and its geometry measurement require the frame's
own `usage.status === "ready"` and valid bounded usage. Pending/unavailable
siblings emit no instance events or inspection errors merely from pointer input;
their in-frame navigation remains subscribed. Evidence updates for unchanged
documents refresh the built-in adapters in place, enabling inspection when usage
becomes ready without reloading the iframe or remounting the viewer. This does
not change source-replacement semantics.

Evidence adoption is an inspection lifecycle event. The inspection owner fences
old work before the adapter refresh and reapplies the current mask, outlines and
catalogue labels when every referenced instance still exists in ready usage.
An active pick retains its state without another start/end event. Explicit
highlights keep their exact frame scope; an unrelated frame's update neither
waits for nor redraws that presentation. Loss of ready evidence or a referenced
instance clears the entire current presentation and ends an active pick once
with `evidence`. This host-only reason distinguishes evidence invalidation from
navigation and errors; it introduces no wire message. An explicit highlight
without an active pick clears without emitting a pick end. Evidence changing a
pending activation's scope cancels that activation with `disposed`, clears its
partial presentation and emits neither start nor end. A new `startPick` waits for
the refreshed evidence and activates normally when the views are inspectable.
Superseded update completions and failures cannot affect current inspection.
Geometry notifications received while masks and labels are still activating
join that presentation instead of starting a competing boundary read. They
cannot make a pending pick active before an evidence update cancels its scope.

`highlightInstance` and `scrollToInstance` operate on the referenced current
view and reject missing/unavailable instances; neither guesses a replacement nor
silently navigates. Null clears highlighting. `startPick` starts only on an
inspectable Current view, emits `onPickStart` after activation, and reuses the
Highlight components mask, outlines, labels and accessible instance list.
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
Public highlights retain the complete `InstanceRef` through masks, labels and
events. Both displays only the requested viewport's highlight. Flow references
include `stepIndex` to select one occurrence, even when a screen appears more
than once; omitting it never guesses a flow step. Workspace key selection remains
intentionally shared across its visible viewports. Scheme or variant mismatches
reject. A null reference clears every frame's highlight.
Select the request's sessions before waiting for mount readiness or measuring
geometry. Masks, labels, scrolls and geometry refreshes share that scope: pending
or unavailable sibling views cannot block a ready public target. Clear unrelated
masks without waiting for their mounts or reading their usage. A failed current
highlight clears its masks and labels, including any partially applied mask.
Every asynchronous inspection success and failure belongs to its request and
frame generation. Replacement or cancellation invalidates that ownership;
obsolete caller promises reject with the adapter's existing `disposed` code.
Obsolete internal work never clears replacement labels, changes current picking,
or emits `onPickEnd`/`onError`. This includes work that fails after replacement,
not just successful late replies.
Current async failures reject the handle promise and emit one `onError`; error messages
are product-safe and contain no private paths. Unmount cancels without later
callbacks. User callback exceptions are not reclassified as viewer errors.
A mount failure and a pending pick awaiting that mount share one error report;
cancelling that activation preserves the originating failure.
During teardown every frame and runtime cleanup runs even when a host callback
throws. Subscriptions, pending mounts, observers, resize/slot resources and scoped
listeners are released, then the original exception is rethrown unchanged.

## Rendered Features And Slots

The owning visual/interaction specification remains
[Runtime: Browse Shell](./mokly-runtime.md#browse-shell), with the
[component explorer](./mokly-component-explorer.md) and
[navigation contract](./mokly-navigation.md). The viewer renders:

- Pages and Components trees, authored collection hierarchy, disclosures,
  All/Changes with real status/counts, search/tag picker, and navigation resizing.
- Breadcrumbs and copyable id chips, canonical id redirects/aliases, route
  errors, active-row visibility, focus, history and scroll restoration.
- Phone/browser chrome, viewport and scheme controls, frame expansion, saved
  variants, and existing eligible comparison modes loaded only on request.
- The responsive details/Props/Usage inspector, actual component inspection,
  and ordered use-case flows reusing standalone screens and their backlinks.
- Existing keyboard, reduced-motion, contrast, mobile drawer/bottom-sheet and
  unavailable/loading/empty behavior. No redesigned screen is introduced.

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

## Theming And Ownership

Import `@mokly/viewer/styles.css` once. Set documented `--mokly-*` variables on
the viewer's containing element; the supported v1 overrides are
`--mokly-accent`, `--mokly-accent-contrast`, and `--mokly-accent-soft`, with
defaults and contrast requirements from the [shell design](./mokly-shell-design.md).
These tune shell color only, not consumer fragments. Internal classes, DOM
selectors, `--chrome-*` tokens, breakpoints, geometry and structural styles are
not an override API. Do not replace shell CSS or inject host CSS into frames.
Slot sizing/pointer controls are the explicit layout extension boundary. The
embedded stylesheet uses CSS `@scope` to exclude the host page and slot content,
with a relative packaged font URL. Hosts need browsers with CSS scope support.
Standalone CSS and font URLs remain unchanged.

## Shell Tree And State

The shell is one React component tree under `packages/viewer/src/shell`. It is
rendered on the server for first paint and hydrated in the browser by every
delivery mode: `MoklyViewer` in React hosts, and the standalone hydration entry
in Serve and export. There are no runtime-owned islands, no string-rendered
markup injected into the tree, and no second implementation of any shell
interaction. Route content renders from the validated catalogue read model;
navigation never fetches and swaps shell HTML. Controlled props and handle
methods update shell state, and every rendered attribute is owned by React.
Frames remain static documents in script-disabled sandboxed iframes; hydration
never reaches inside a frame.

Shell state is one store scoped to a mounted viewer:

- **Route** is derived from the URL and is the only source of route truth:
  screen, saved variant, comparison selection and the validated `fragment`
  query. Standalone modes own the document URL and history; React hosts
  receive route changes through `onScreenNavigate` and own their own URL.
- **Selection** is the public `ViewerSelection`: screen, All/Changes view,
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
older preferences and the snapshot; capture state is removed after load or
exit. Hydration must produce
no mismatches: the server tree and the initial client tree are the same
function of the same read model, route, selection and delivery descriptor.

A source change (object/fetcher identity, URL value, object base origin), or
adapter change, remounts the shell tree, cancelling stale loads, pick and frame
sessions. Selection changes do not remount it. Cleanup tolerates React effect
setup/cleanup replay with no duplicate listeners or requests. Within an
unchanged source, first-party Serve supplies its private capabilities (update
stream, reload recovery, evidence revisions, temporary control previews and
on-demand rendering) through a typed React context that the CLI provides and
export leaves unset. Evidence revisions apply in place; content changes use the
reload lifecycle. Private tokens/evidence never enter catalogue JSON, and hosts
do not need undocumented manifest access.

## SSR, Hydration And Host Independence

The Node-only `@mokly/viewer/server` entry exports `renderViewer` for Serve and
export. It synchronously accepts a validated object source, its base URL and
initial selection/slots, and returns the server-rendered shell tree as HTML;
URL/fetcher sources and browser handles/effects are not accepted during SSR.
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
host route layout. Hosts own surrounding product UI and data. Viewer network
activity is limited to its configured source and validated public resources or
pinned comparisons from it; no analytics, discovery, remote fonts or background
comparison requests are added. Existing authored external fragment resources
retain export's resource policy. Serve owns its existing private update/control
transport outside this public fetch boundary. No cookies or ambient credentials
are read/written, and no `window.top` access occurs. Embedding never commandeers
an ancestor router; standalone Serve/export retain their current URL lifecycle.

Acceptance includes all props, slots, events, handle methods, controlled-state
round trips, multiple independent mounts, SSR/client lifecycle cleanup,
hydration without mismatches on every fixture route, source replacement,
same/cross-origin frames and the existing local browser tests passing against
the hydrated shell. Behavioural parity under `tests/browser` is the bar; shell
module bytes and export deployment identity are expected to change.
