# Embeddable Mokly Viewer

Status: In progress under the [detail content ids plan](../../plans/detail-content-ids.md).

## Package And Props

`@mokly/viewer` is an MIT, ESM npm package with declarations and React and React DOM
`>=19.0.0` peers. `@mokly/mokly` depends on its exact released version. The
viewer never imports the CLI, Node built-ins, Git, or consumer code, and it
renders only in the browser. Its shared shapes are the
[generated types](../../packages/viewer/src/generated/catalogue/) of the model.
The package has four entry points:

- The root React entry exports `MoklyViewer`, its types, the frame adapters,
  `resolveInstance`, and the readers of the catalogue index and the entry
  detail. A React host renders the viewer in the browser with its own React.
- The `./browser` entry mounts the standalone Browse shell into the
  `data-mokly-shell` element of the stub that the
  [shell delivery contract](./mokly-shell-delivery.md) defines. Serve and
  `build` deliver it as `/mokly-viewer/client/shell.js`.
- `./data` exports, with no React dependency, the pure path functions and directory names of the [artifact path contract](./mokly-artifact-paths.md), the path grammar of the [path contract](./mokly-paths.md), the link grammar of the [authoring links contract](./mokly-authoring.md#links), and the prop schema validators of the [entry props contract](./mokly-entry-props.md#prop-schema-profile); `./styles.css` is the scoped stylesheet of an embedded root.

Every delivery renders the shell from data in the browser.

```ts
import type { CSSProperties, ReactNode, Ref } from "react";
import type { CatalogueReadModel, EntryDetailV3 } from "@mokly/viewer";
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
/** The catalogue index v8 as an object, or its absolute HTTP(S) URL. */
type IndexSource = CatalogueReadModel | string | URL;
type DetailResult = EntryDetailV3 | string | URL;
/** One entry detail v3, or its URL; a removed entry names its snapshot. */
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

`index` is the catalogue index v8. For an object source, `baseUrl` is
required and supplies the HTTP(S) artifact origin root. A URL or string source
must be an absolute HTTP(S) URL; its validated final response URL establishes
that root, and `baseUrl` is invalid for it. Do not resolve artifact paths
relative to the embedding application. The viewer validates every index as
[read model v8](./mokly-catalogue.md) before it renders.

`detail` supplies the entry detail v3 of one entry. The viewer calls it with the
entry path, plus the `snapshotId` of a removed record, when it commits a
selection whose detail it does not hold. The result is a detail object, a URL on
the artifact origin root, or a promise of either. A URL is fetched under the
fetch rules of the shell delivery contract: same origin, `credentials: "omit"`,
no redirect outside the origin. A static viewer also reads
`mokly-viewer/deployment.json` at the catalogue origin root with each detail
request for a page change and before a comparison or removed-entry request.
The viewer accepts a current detail only when its `revision`, then its
`detailId`, then its identity and content fields match the installed index. It
accepts a removed detail only when its identity, path record, `snapshotId`, and
`detailId` match the index. On a revision mismatch the viewer requests the
index again once; a detail that still disagrees leaves the entry unavailable
with a retry control. Another deployment id emits one `onError` and keeps the
installed state and loading stage until the host replaces `index`. A missing or
unreadable deployment file changes nothing. Serve viewers do not request it. A
detail that arrives after the selection moved on is discarded. Sources are
host-supplied transports, not permission for viewer telemetry. A fetch failure
renders an explicit error and retry state and emits `onError`. A version failure
shows the headline of the [version contract](./mokly-viewer-namespace.md)
without an action and emits `onError` with `code: "version"`, the headline, and
the details. Missing data is never replaced by examples or invented counts.

Omitted `frameAdapter` uses `sameOriginAdapter()`. Cross-origin hosts
explicitly provide `postMessageAdapter({ frameOrigin })` under the
[adapter protocol](./mokly-frame-adapter.md). One adapter can mount several
independent frames; it owns no global document state.

## Selection, Events And Imperative Use

The [viewer selection contract](./mokly-viewer-selection.md) defines
selection, events, and the imperative handle.

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

The [viewer selection contract](./mokly-viewer-selection.md#shell-tree-and-state)
defines the shell tree and its state.

## Host Independence

The viewer fetches only the index, the details, documents, removed previews,
and comparison generation files of its artifact origin root, under the fetch
rules of the [shell delivery contract](./mokly-shell-delivery.md#fetch-and-fences)
contracts. It sends no telemetry and reads no cookies. Consumer code never
enters the browser through the viewer. The in-frame inspector script of the
frame adapter contract is the one React-free part of the package. Several
viewers can mount in one document with independent state, and each cleans up
on unmount.
