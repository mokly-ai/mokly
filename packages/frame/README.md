# @mokly/frame

`@mokly/frame` holds Mokly's frame adapter interface, the built-in adapters,
the frame probe that runs inside published pages, and the start page and the
access worker of the frame access route. The Browse shell uses
these adapters to read and inspect catalogue previews. A host that embeds a
catalogue imports the public adapters and frame types from `@mokly/viewer`.

## Responsibilities

- The frame adapter interface and the built-in same-origin and postMessage
  adapters.
- Both ends of the frame probe wire protocol: the host transport and the
  probe inside a published page.
- Both ends of the frame access route: the access phase and the token renewal
  of `postMessageAdapter`, and the start page, the access worker and the
  probe's relay on the frame origin.
- The shared event runtime and the geometry rules that both adapters use.
- The frame session state, the mount ownership, and the temporary preview
  adapter, which only the viewer uses, through the internal entry.

## What This Package Does

The root entry exports the public frame types, `sameOriginAdapter`, and
`postMessageAdapter`. The one internal entry, `@mokly/frame/internal`, holds
the frame operations that only `@mokly/viewer` uses. The package builds the
frame probe script, the start page and the access worker, which the viewer
copies into its browser outputs.

The package depends on the exact shared version of `@mokly/model`. It never
imports the viewer, the CLI, or consumer code. The viewer depends on this
package at the same exact version and re-exports its public interface. Hosts
use those viewer exports so that mounted frames share one installed copy's
session state.

The viewer's client-rendered React shell reaches the adapters, the geometry
helpers, and the usage adoption only through these two entries. Shell
navigation, selection, comparisons, and component inspection stay in the
viewer's `src/shell`. The shell's index, detail, and live transports stay in
its `src/shell/data_*` and `src/standalone`. This package holds no second
interaction runtime.

### Same-origin frames

`sameOriginAdapter` keeps script-disabled frames and reports their geometry.
It runs the shared event core of the frame probe with the viewer's callback
environment. Both adapters draw nothing. The shell draws the masks and labels
with `@mokly/ui` components from the reported instance boundaries. Its mounts
authenticate the current document and support scroll restoration and temporary
control previews. The viewer's workspace, Browse state, and controls never
read a frame document directly.

`normalizedHtmlPath` in `same_origin_identity.ts` treats a page's `index.html`
and its directory, with or without a trailing slash, as one resource. It also
accepts the extensionless form of a `.html` file. Origins and queries must
match exactly. Readiness checks and document authentication use this same
normalization. `same_origin_identity.ts` keeps authenticated documents and the
last assigned resource of each frame in weak collections, so this provenance
never extends the lifetime of a document or a frame. The Same-Origin Documents
section of the
[frame adapter contract](../../docs/protocol/mokly-frame-adapter.md#same-origin-documents)
defines which document a mount adopts, waits for, or replaces.

### Cross-origin frames

Serve and the static build use the same-origin adapter. Only an embedding host
selects `postMessageAdapter`. The
[frame probe handshake and wire protocol](../../docs/protocol/mokly-frame-probe-wire.md)
define the cross-origin session, and the
[frame link navigation contract](../../docs/protocol/mokly-frame-link-navigation.md)
defines the navigation events that the host resolves.

When the server of the frame origin needs a credential on every file except the
start page and the access worker, the host
passes `postMessageAdapter` an `access` callback, which answers with an access
token of that server, and `onAccessFailure`. A frame without a credential then loads
the start page, which asks the adapter for a token and registers the access
worker. The worker adds the token to the requests of the frame. The
[frame access contract](../../docs/protocol/mokly-frame-access.md) defines the
start page, the worker, the access channel, the loop guard and the renewal.

### Usage updates

The viewer's [`stage_sources.ts`](../viewer/src/shell/stage_sources.ts)
normalizes the omitted usage of a view whose entry detail is not held yet to
the same pending frame state as a view awaiting evidence before it reaches an
adapter, so it shows the existing waiting copy rather than empty or
unavailable inspection. The
[frame adapter usage contract](../../docs/protocol/mokly-frame-adapter-usage.md)
defines `updateUsage`, the usage rules, and the inspection ownership.

### Canvas input

A mount with `canvasInput: true` forwards modified wheel input, WebKit
pinches, canvas keys and document focus while it has a listener. Both
adapters do this while instance usage is pending or unavailable. The canvas
keys are the zoom keys of the canvas, and Escape and the search keys of the
shell. The
[canvas input contract](../../docs/protocol/mokly-frame-canvas-input.md)
defines the reports and the keys that qualify.

### Frames without an adapter

Frames that hold a previous version and comparison pane frames do not use a
frame adapter. The viewer's
[preview controller](../viewer/src/previews/README.md) and the comparison pane
modules in [the shell](../viewer/src/shell/README.md) own them, under the
[removed previews](../../docs/protocol/mokly-removed-previews.md),
[comparison panes](../../docs/protocol/mokly-comparison-panes.md), and
[comparison scrolling](../../docs/protocol/mokly-comparison-scrolling.md)
contracts.

### Frame probe

The frame probe is the dependency-free browser IIFE of the cross-origin
adapter. Serve and the static build deliver it at
`/mokly-viewer/client/frame-probe.js`, the script of the
[frame probe contract](../../docs/protocol/mokly-frame-probe.md), and the
static build injects it into the current documents that it writes. The
[frame probe README](./src/probe/README.md) describes its bundle, its
validation, the published map and markers, and its geometry. After its
handshake, the probe also relays renewed access tokens to the access worker
that controls its document.

## Quick Start

Build the package from the repository root:

```bash
npm run build --workspace @mokly/frame
```

Use the [viewer package](../viewer/README.md#quick-start) to embed a catalogue
and select a frame adapter.

## Development

```bash
npm run build
cargo xtask check --suite viewer
```

`npm run build` builds this package after `@mokly/model` and before
`@mokly/viewer`. The package build compiles `src` into `dist`, then bundles
the frame probe, `access-start.html`, and `access-worker.js` into
`dist/browser/`. The viewer build copies those files into
`packages/viewer/dist/browser` and lists them in the viewer's browser module
inventory.

`npm run typecheck` includes its source and tests. The root
test runner discovers package tests under `tests/`. Run one with
`npm test -- packages/frame/tests/{file}`. `npm test --workspace @mokly/frame`
runs the package tests and accepts an empty test directory. The browser specs
of both adapters stay in `tests/browser`, because they need the whole viewer.

File names are snake_case, as `AGENTS.md` says for every package except
`@mokly/ui`. The build sets `rootDir` to `src`, so it rejects relative imports
from outside the package. Import directory names from `@mokly/model` instead
of spelling them in source.

### Key Code

- [`src/index.ts`](./src/index.ts) — the public package entry, which exports
  the frame adapter types, `sameOriginAdapter`, and `postMessageAdapter`
- [`src/internal.ts`](./src/internal.ts) — the entry for the frame operations
  that only the viewer uses: the frame session registry, `FrameError`,
  `frameUsage`, `cancelFrameMount`, `localFramePath`,
  `temporaryPreviewAdapter`, `clipNode`, the rectangle helpers, and the
  `LinkActivation` type. `measureContentBox` measures a document without a
  frame adapter.
- `canvasKey` in [`src/internal.ts`](./src/internal.ts) maps a keydown in a
  frame's document to its `canvas-key` value: a zoom key, or, with its
  `shell` argument, Escape or a search key. Only `probeRuntime` calls it.
- `listenForCanvasInput` in [`src/internal.ts`](./src/internal.ts) runs the
  shared runtime on a same-origin document without an adapter. It takes a
  document, a canvas event listener and an optional callback environment.
  Call its cleanup to remove the listeners and cancel pending work.
- [`src/frame_adapter.ts`](./src/frame_adapter.ts) — the public
  `FrameAdapter`, `FrameMount`, `MountedFrame`, and `FrameEvent` types, which
  the built-in adapters implement and `@mokly/viewer` re-exports
- [`src/adapters/same_origin_adapter.ts`](./src/adapters/same_origin_adapter.ts)
  — `sameOriginAdapter`, the default adapter for script-disabled frames,
  `temporaryPreviewAdapter` for control previews, and `localFramePath` for
  preview expiration checks. Both adapters measure instance box models and
  document content boxes.
- [`src/adapters/same_origin_mount.ts`](./src/adapters/same_origin_mount.ts) —
  `mountLocalDocument`, which owns the load and the session of one same-origin
  mount
- [`src/adapters/same_origin_identity.ts`](./src/adapters/same_origin_identity.ts)
  — `createMountAuthentication`, the single document-authentication boundary
  for same-origin mounts
- [`src/adapters/same_origin_load.ts`](./src/adapters/same_origin_load.ts) —
  `initialFrameLoad`, which decides whether a mount adopts, waits for, or
  replaces the visible document
- [`src/adapters/same_origin_access.ts`](./src/adapters/same_origin_access.ts)
  — `localFrameAccess`, the only same-origin adapter code that reads a frame's
  document or window
- [`src/adapters/same_origin_navigation.ts`](./src/adapters/same_origin_navigation.ts)
  — classifies served logical links and owns their activation until the
  shared core starts
- [`src/adapters/post_message_adapter.ts`](./src/adapters/post_message_adapter.ts)
  — `postMessageAdapter`, the opt-in adapter for documents on a separate
  origin. It requests instance box models and document content boxes from
  the probe.
- [`src/adapters/access_phase.ts`](./src/adapters/access_phase.ts) runs the
  start page and probe handshakes of one mount.
- [`src/adapters/access_renewal.ts`](./src/adapters/access_renewal.ts) schedules
  token renewal and delivers the answer to ready frames of the adapter.
- [`src/access/channel.ts`](./src/access/channel.ts) validates and encodes
  access messages.
- [`src/access/start.ts`](./src/access/start.ts) runs the cookie check and the
  worker hand-off before the start page reloads.
- [`src/access/worker.ts`](./src/access/worker.ts) authenticates requests to its
  own origin and uses [`token_store.ts`](./src/access/token_store.ts) to keep
  the latest token in IndexedDB.
- [`src/adapters/message_transport.ts`](./src/adapters/message_transport.ts)
  — `messageTransport`, the bounded request and reply state of one
  cross-origin session
- [`src/adapters/frame_usage.ts`](./src/adapters/frame_usage.ts) —
  `frameUsage` and `frameEvents`, which turn validated usage into frame probe
  metadata and the allowed events
- [`src/adapters/frame_mount.ts`](./src/adapters/frame_mount.ts) — `ownFrame`,
  which keeps one owner for each frame across adapter kinds, and
  `cancelFrameMount`
- [`src/adapters/frame_session.ts`](./src/adapters/frame_session.ts) — the
  frame session registry, which shares private shell metadata with the
  same-origin adapter outside the public adapter contract
- [`src/probe`](./src/probe/README.md) — the frame probe IIFE and
  `probeRuntime`, the shared core for geometry, instance box models, document
  content boxes, hover, click, picks, Escape, navigation and canvas input
- [`src/navigation`](./src/navigation) — the link rules that only the frame
  code uses: `frameLinkActivation` in `activation.ts`, `parseLogicalMarker`
  and `logicalMarker` in `logical.ts`, and `parseBrowsingTarget` in
  `target.ts`
- [`scripts/build.mjs`](./scripts/build.mjs) — removes `dist`, compiles the
  package with `tsconfig.build.json`, and builds the three browser assets
- [`scripts/probe-bundle.mjs`](./scripts/probe-bundle.mjs) — `bundleProbe`,
  which runs esbuild, the string pool of `probe-pool.mjs`, and Terser

### Related Docs

- [Frame package contract](../../docs/protocol/mokly-frame-package.md)
- [Frame adapter contract](../../docs/protocol/mokly-frame-adapter.md)
- [Frame adapter usage contract](../../docs/protocol/mokly-frame-adapter-usage.md)
- [Frame access contract](../../docs/protocol/mokly-frame-access.md)
- [Frame content box contract](../../docs/protocol/mokly-frame-content-box.md)
- [Frame canvas input contract](../../docs/protocol/mokly-frame-canvas-input.md)
- [Frame probe contract](../../docs/protocol/mokly-frame-probe.md)
- [Frame probe wire protocol](../../docs/protocol/mokly-frame-probe-wire.md)
- [Frame link navigation](../../docs/protocol/mokly-frame-link-navigation.md)
- [Logical navigation](../../docs/protocol/mokly-navigation.md)
- [Selection and events](../../docs/protocol/mokly-viewer-selection.md#selection-events-and-imperative-use)
- [Static delivery](../../docs/protocol/mokly-export-delivery.md)
- [Shell delivery contract](../../docs/protocol/mokly-shell-delivery.md)
- [Model package](../model/README.md)
- [Viewer package](../viewer/README.md)
- [Package and consumer boundary](../../docs/architecture/package-boundary.md)
