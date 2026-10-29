# Embeddable Mokly Viewer

## Package And Props

`@mokly/viewer` is an MIT, ESM npm package with declarations and React and React DOM
`>=19.0.0` peers. `@mokly/mokly` depends on its exact released version. The
viewer never imports the CLI, Node built-ins, Git, or consumer code, and it
renders only in the browser. Its shared shapes are the
[generated types](../../packages/viewer/src/generated/catalogue/)
of the model.
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

The [viewer API declarations](./mokly-viewer-api.md) define the props, event
payloads, and imperative handle.

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
selection whose detail it does not hold. For a current component variant, the
viewer also calls `detail` with the parent's path and no `snapshotId` when it
does not hold that detail. Screen variants and removed variants need no parent
request. The stage, Props, and Usage wait for all route details under the
[route delivery rules](./mokly-shell-delivery.md#fetch-and-fences).
The result is a detail object, a URL on
the artifact origin root, or a promise of either. A URL is fetched under the
fetch rules of the shell delivery contract: same origin, `credentials: "omit"`,
no redirect outside the origin. A static viewer also reads
`mokly-viewer/deployment.json` at the catalogue origin root with each detail
request of an in-shell navigation and before a comparison or removed-entry
request when it fetched the index from a URL. An object index does not request
the file. It does not request the file on the first load. The standalone shell
keeps the same check for static catalogues.
The viewer accepts a current detail only when its `revision`, then its
`detailId`, then its identity and content fields match the installed index. It
accepts a removed detail only when its identity, path record, `snapshotId`, and
`detailId` match the index. On a revision mismatch, the embedded viewer
requests the index once. If the revision still disagrees after that request,
the entry is unavailable with retry. A deployment file with another
`deploymentId`, or a current detail whose `detailId` differs from the index at
the same revision, emits one `onError` and keeps the installed state and
loading stage. A detail whose identity or other content fields do not match
leaves the entry unavailable with retry. A missing or unreadable deployment file
changes nothing. Serve viewers do not request it. A detail that arrives after
the selection moved on, or that a newer selection does not need, is discarded.
Sources are host-supplied transports, not permission for viewer telemetry. A fetch failure
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
A current component variant shows Used by and Affected lists from its parent's
detail. A removed variant shows those lists from its own detail.

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
