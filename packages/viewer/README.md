<p align="center">
  <img src="https://mokly.ai/brand/mokly-logo.svg" alt="Mokly" width="360">
</p>

<p align="center">
  <strong>Embed a complete Mokly catalogue in any React application.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mokly/viewer"><img src="https://img.shields.io/npm/v/%40mokly%2Fviewer?color=4f7864&amp;label=npm" alt="npm version"></a>
  <a href="https://github.com/mokly-ai/mokly/actions/workflows/ci.yml"><img src="https://github.com/mokly-ai/mokly/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-4f7864" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#core-concepts">Core concepts</a> ·
  <a href="#api-reference">API</a> ·
  <a href="#deployment-and-security">Deployment</a> ·
  <a href="#development">Development</a>
</p>

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`@mokly/viewer` is an open-source React library that renders a Mokly catalogue
inside another product. It reads the catalogue that `mokly serve` serves or
`mokly build` writes, and it renders the same Browse shell as the standalone
catalogue: browsing, comparison, and inspection. Your application keeps control
of its navigation, branding, authentication, and collaboration UI.

> Need to create a catalogue? Use
> [`@mokly/mokly`](https://www.npmjs.com/package/@mokly/mokly). The viewer is a
> delivery-only package. It reads public catalogue data, and it runs no
> application source, no Git command, and no Mokly CLI.

## Why Mokly Viewer

- **A complete catalogue experience.** Browse Markdown documents, pages,
  screens, components and their variants, and use-case flows. Search, filter by
  tag, switch viewports and colour schemes, filter to Changes, inspect
  component instances, and compare versions in Overlay, Difference, and Side by
  side with a Scroll together switch.
- **Designed to be embedded.** Connect the viewer to application state through
  controlled selection, typed events, host-owned slots, and an imperative ref.
- **Component-aware collaboration.** Resolve saved component references,
  highlight exact instances, start an instance picker, and anchor host-owned
  markers such as comment controls.
- **Same-origin or isolated delivery.** Use the built-in same-origin adapter, or
  an explicit origin-pinned `postMessage` adapter when the catalogue files live
  on another origin.
- **One shell for every delivery.** The same React tree renders in your
  application, in `mokly serve`, and in the static output of `mokly build`. It
  renders only in the browser, from two JSON shapes: the catalogue index and
  one entry detail per entry.
- **Typed and validated.** The package ships TypeScript declarations generated
  from Mokly's Rust model, and it validates every index and detail at its
  public boundary.

## Requirements

- React and React DOM 19 or newer
- An ESM-compatible application build
- A catalogue that `@mokly/mokly` serves or builds, reachable over HTTP(S)

Mokly Viewer is pre-1.0. A minor release can change the API. Read the
[changelog](./CHANGELOG.md) before you upgrade.

## Quick Start

### Install

```bash
npm install @mokly/viewer react react-dom
```

### Render a same-origin catalogue

Import the stylesheet once. Place the viewer in a container with a definite
height. Give it the URL of the catalogue index and a `detail` function that
names the detail of one entry:

```tsx
import { useMemo } from "react";
import { MoklyViewer } from "@mokly/viewer";
import "@mokly/viewer/styles.css";

/** Names the detail of one entry on the catalogue origin. */
export function catalogueDetail(origin: string) {
  return async (entryPath: string, snapshotId?: string) => {
    if (!snapshotId) return `${origin}/mokly-viewer/entries/${entryPath}.json`;
    // A removed entry's detail lives in the comparison generation that the
    // index's comparisonUrl names.
    const response = await fetch(`${origin}/mokly-viewer/index.json`, {
      credentials: "omit",
    });
    const { comparisonUrl } = await response.json();
    return new URL(`entries/${entryPath}.json`, `${origin}/${comparisonUrl}`);
  };
}

export function CataloguePage({ origin }: { origin: string }) {
  const detail = useMemo(() => catalogueDetail(origin), [origin]);
  return (
    <main className="catalogue-page">
      <MoklyViewer
        index={`${origin}/mokly-viewer/index.json`}
        detail={detail}
      />
    </main>
  );
}
```

```css
.catalogue-page {
  height: 100vh;
}
```

`index` is an absolute HTTP(S) URL such as
`https://app.example.com/mokly-viewer/index.json`, or the index object with a
`baseUrl`. The viewer validates the index, then calls `detail` for each entry
it needs. A current entry's detail is `mokly-viewer/entries/<path>.json`. A
removed entry's detail lives in the comparison generation that the index's
`comparisonUrl` names. Every path resolves from the catalogue's origin root,
never from the embedding page. When the catalogue files share the application's
origin, the default frame adapter is all you need.

The viewer fills its container and owns scrolling within the preview stage. It
does not grow the embedding document to match the rendered screen.

### Render a cross-origin catalogue

Use `postMessageAdapter` when the catalogue files live on a separate origin.
Memoize the adapter and the `detail` function so their identities stay stable
between renders:

```tsx
import { useMemo } from "react";
import { MoklyViewer, postMessageAdapter } from "@mokly/viewer";
import "@mokly/viewer/styles.css";

import { catalogueDetail } from "./catalogue-page";

export function IsolatedCataloguePage({ origin }: { origin: string }) {
  const detail = useMemo(() => catalogueDetail(origin), [origin]);
  const frameAdapter = useMemo(
    () => postMessageAdapter({ frameOrigin: origin }),
    [origin],
  );
  return (
    <div style={{ height: "100vh" }}>
      <MoklyViewer
        index={`${origin}/mokly-viewer/index.json`}
        detail={detail}
        frameAdapter={frameAdapter}
      />
    </div>
  );
}
```

The catalogue host must allow the embedding application's exact origin and
serve the shell bundle and the inspector that Mokly writes beside the catalogue.
Read [Deployment and security](#deployment-and-security) before you ship this
configuration.

## Core Concepts

### Catalogue sources

`MoklyViewer` reads two shapes of the
[shell delivery contract](../../docs/protocol/mokly-shell-delivery.md): the
catalogue index, read model v7, and one entry detail v1 per entry.

| Prop     | Accepts                                                 | Rule                                                                                |
| -------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `index`  | An absolute HTTP(S) `string` or `URL`                   | The viewer fetches the index; the final response URL sets the catalogue origin root |
| `index`  | A `CatalogueReadModel` object                           | Requires `baseUrl`, the origin root of the catalogue files                          |
| `detail` | `(entryPath, snapshotId?) => detail, URL, or a promise` | Called once per entry the viewer does not hold; a URL must be on the origin root    |

The viewer validates the index and each detail before it reads a field. It
fetches a URL with a plain GET, `credentials: "omit"`, and no custom header, and
it rejects a redirect outside the origin. A current entry's detail must carry
the index's `identity`, `deploymentId`, and `revision`. A removed entry's detail
must carry the generation that `comparisonUrl` names and the removed record's
`snapshotId`. On a revision mismatch the viewer fetches the index once more; a
detail that disagrees after that leaves the entry unavailable with a retry
control. A different `deploymentId` means another deployment replaced the
files: the viewer emits one `onError` and keeps its state. A React host
supplies newer data by replacing `index`.

Keep the `index` object, the URL value, the `detail` function, and the frame
adapter identities stable while the viewer is mounted. Replacing one remounts
the viewer and cancels pending work.

### Selection

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

### Host integration

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

### Component instance references

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
[viewer contract](../../docs/protocol/mokly-viewer.md#package-and-props).

A marker takes a unique `id`, an exact `instance`, and React `content`. The
marker container is pointer-inert; opt an interactive child in with its own
`pointer-events` style. Geometry stays viewer-owned and is not a host API.

Served and built documents keep the `mokly-instance` and `mokly-slot` comment
markers of every region the core composed. The published inspector resolves
instance regions in the live page from them.

### Live controls

Every screen and component is a render over props, and the Props tab of the
inspector derives its controls from the entry's prop schema. In `mokly serve`,
the standalone shell edits props temporarily through the render capability of
the live descriptor, and it follows the event stream of publications. An
embedded `MoklyViewer` and the static output of `mokly build` have no live
capability: their controls are read-only, they show the saved props, and they
open no event stream. A temporary edit never enters the index, a detail, a URL,
or browser storage. The
[controls contract](../../docs/protocol/mokly-component-controls.md#rendering-boundary)
owns the boundary.

## API Reference

### `<MoklyViewer>`

| Prop                                 | Purpose                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `index`                              | The catalogue index v7 as an object, or its absolute HTTP(S) URL                                                   |
| `detail`                             | Function from an entry path and an optional snapshot id to one entry detail v1, its URL, or a promise of either    |
| `baseUrl`                            | Required origin root for an object `index`; invalid for a URL `index`                                              |
| `frameAdapter`                       | Preview transport; defaults to `sameOriginAdapter()`                                                               |
| `theme`                              | Interface appearance, independent of preview selection; defaults to `"auto"`                                       |
| `defaultSelection`                   | Partial initial selection for uncontrolled mode                                                                    |
| `selection`                          | Complete host-owned `ViewerSelection`                                                                              |
| `onSelectionChange`                  | Receives viewer selection proposals                                                                                |
| `slots`                              | Host content for `topBarStart`, `topBarEnd`, `railStart`, `railEnd`, `sidePanel`, `stageOverlay`, and `emptyState` |
| `markers`                            | Host-owned content anchored to component instances                                                                 |
| `onMarkerChange`                     | Reports each marker as visible, hidden, or unavailable                                                             |
| `onScreenNavigate`                   | Reports committed navigation for host routing                                                                      |
| `onInstanceHover`, `onInstanceClick` | Reports interaction with inspectable component instances                                                           |
| `onPickStart`, `onPickEnd`           | Reports the instance-picking lifecycle                                                                             |
| `onError`                            | Reports safe errors with code `catalogue`, `version`, `selection`, `frame`, `comparison`, or `markers`             |
| `ref`                                | Exposes the `MoklyViewerHandle` methods below                                                                      |

`sidePanel` takes `{ content, width }`, and `stageOverlay` takes
`{ content, pointerEvents }`, where the host chooses `"none"` or `"auto"`.
`emptyState` replaces only the home body when no entry is selected.

### `MoklyViewerHandle`

| Method                          | Purpose                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `select(partial)`               | Merge a partial selection into the current state                     |
| `highlightInstance(instance)`   | Highlight one exact instance; pass `null` to clear                   |
| `highlightInstances(instances)` | Atomically highlight several instances; pass an empty array to clear |
| `scrollToInstance(instance)`    | Bring an exact instance into view                                    |
| `startPick()`                   | Start component picking after the current view is inspectable        |
| `cancelPick()`                  | Idempotently cancel active or pending picking                        |

Highlighting, scrolling, and picking are asynchronous because preview frames
can be loading. Await their promises and handle rejection. The
[viewer contract](../../docs/protocol/mokly-viewer.md) defines the exact event
order, cancellation, and evidence refresh.

### Package entry points

| Import                     | Purpose                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@mokly/viewer`            | `MoklyViewer`, its types, the frame adapters, `resolveInstance`, and the readers of the catalogue index and the entry detail |
| `@mokly/viewer/styles.css` | The scoped stylesheet of an embedded root; import it once                                                                    |
| `@mokly/viewer/browser`    | Mounts the standalone Browse shell into the stub that `mokly serve` and `mokly build` deliver                                |
| `@mokly/viewer/data`       | Pure path functions and the generated directory names, with no React dependency                                              |

React applications need only the root entry and the stylesheet. Do not import
`@mokly/viewer/browser` in an application-owned React root: it mounts the
standalone shell into the stub's `data-mokly-shell` element, and Serve and
`build` deliver it as `/mokly-viewer/client/shell.js` with React bundled in.

The readers validate an index or a detail that a host reads itself. Each reader
accepts exactly one format number and rejects every other with a typed
`MoklyVersionError` whose diagnostic reads
`Unsupported Mokly <boundary> version <version>; this viewer supports version <supported>.`
The embedded viewer reports the same failure through `onError` with code
`version`. The
[version gates](../../docs/protocol/mokly-viewer-namespace.md#version-matrix)
list every boundary.

`@mokly/viewer/data` exports the path functions and `GENERATED_DIRECTORY` of
the [artifact path contract](../../docs/protocol/mokly-artifact-paths.md) and
the grammar functions `isPathSegment`, `isEntryPath`, and
`isWindowsDeviceName` of the
[path contract](../../docs/protocol/mokly-paths.md); it has no React
dependency.

## Theming

`theme` accepts `"auto"`, `"light"`, or `"dark"`. Auto is the default and
follows the system preference. It is independent of `selection.colorScheme`, so
a host can pair either interface appearance with either preview scheme. A theme
change preserves frame sessions, selection, temporary props, picking,
highlights, and markers, and it changes neither the host document nor sibling
viewers.

The standalone shell of `mokly serve` and `mokly build` instead renders one
Appearance selector for the interface and the previews together. See the
[appearance contract](../../docs/protocol/mokly-viewer-appearance.md) and the
[semantic palette](../../docs/protocol/mokly-viewer-palette.md).

Dark uses Mokly Cloud's warm Folio neutrals for backgrounds, panels, text, and
borders, with sage accents. The palette and the fonts are packaged locally, and
the colours authored inside each preview are preserved.

Import the packaged stylesheet once, then override the supported custom
properties on a containing element:

```css
.catalogue-page {
  --mokly-accent: #315c4a;
  --mokly-accent-contrast: #ffffff;
  --mokly-accent-soft: rgb(49 92 74 / 12%);
}
```

Keep readable contrast between `--mokly-accent` and `--mokly-accent-contrast` in
both appearances. Unset overrides use the current palette defaults. These
properties tune the accent only; the Mokly logo in the top bar keeps its brand
colours in each appearance. Viewer styles are scoped away from the surrounding
application and host slot content. Internal selectors, DOM structure, geometry,
and other custom properties are not extension APIs.

At a container width of 560px or less, the viewer switches to its compact
search control. This follows the viewer container, not the browser viewport.

### Standalone reader preferences

The standalone shell keeps these origin-local preferences in `localStorage` and
reads them before its first render:

| Key                                | Choice                                                  |
| ---------------------------------- | ------------------------------------------------------- |
| `mokly:theme`                      | Explicit Light or Dark appearance; Auto removes the key |
| `mokly:nav-disclosure:v4`          | Open navigation groups                                  |
| `mokly:comparison-scroll-together` | `on` or `off`; missing means on                         |

The Details disclosure and the navigation split width also persist per origin.
Scroll together appears after the comparison modes in Side by side, Overlay,
and Difference, and it updates the open comparison without reloading panes. An
embedded `MoklyViewer` reads no browser storage; it keeps these choices for the
lifetime of the mounted viewer.

## Deployment and Security

The catalogue is static files. `mokly build` writes the shell stub, the index,
one detail per entry, the documents, the comparison generation, the shell
bundle, styles, and fonts into one output directory. Deploy that directory at
the root of an HTTP(S) origin with correct MIME types, `index.html` directory
indexes, query-insensitive file lookup, and no SPA fallback; the host runs no
process. The viewer derives every file from an entry's path: shell pages at
`/view/<path>/`, rendered views and documents under
`/static/mokly-generated/`, the index at `/mokly-viewer/index.json`, and the
details under `/mokly-viewer/entries/`. The
[static delivery contract](../../docs/protocol/mokly-export-delivery.md) and the
[viewer namespace](../../docs/protocol/mokly-viewer-namespace.md#public-paths)
define the complete path, header, sandbox, and CSP requirements.

- **Same origin:** no CORS configuration is needed. Omit `frameAdapter` or pass
  `sameOriginAdapter()` explicitly. Frames keep the sandbox `allow-same-origin`,
  and consumer scripts stay disabled.
- **Cross origin:** configure `postMessageAdapter` with the catalogue's exact,
  real origin; an opaque `null` origin is rejected. Send
  `Access-Control-Allow-Origin: <exact app origin>` and
  `X-Content-Type-Options: nosniff` on GET, HEAD, and error responses for every
  public path: `mokly-viewer/index.json`, `mokly-viewer/entries/**`,
  `static/**`, `mokly-viewer/client/**`, `mokly-viewer/shell.css`,
  `mokly-viewer/fonts/**`, and `mokly-viewer/diffs/generations/**`. Use
  `Vary: Origin` when you select the allowed origin dynamically. The viewer uses
  no wildcard CORS and no credentials; it fetches with `credentials: "omit"`.
  Frames use `sandbox="allow-same-origin allow-scripts"`, so the published
  inspector at `mokly-viewer/client/inspector.js` runs inside current
  documents, and the host must ignore the `mokly-host` query parameter for file
  lookup.
- **Caching:** the index and the details of one deployment never change. Serve
  them with revalidation, `Cache-Control: no-cache` or an equivalent validator
  policy, so the next navigation sees a new deployment. A comparison generation
  is immutable at its content-addressed path. A detail from another deployment
  makes the embedded viewer emit one `onError` and the standalone shell reload
  the page.
- **Content Security Policy:** removed previews and comparison panes render in
  viewer-owned, script-disabled `srcdoc` frames. A restrictive policy must
  allow the catalogue origin for the documented resource types and the inline
  styles of those documents; this grants no script execution.
- **Serve:** `mokly serve` binds `127.0.0.1`, sends no
  `Access-Control-Allow-Origin` header on any route, and answers the live
  descriptor, the event stream, and the control routes to its same-origin shell
  only. The static output contains none of them.

## Responsibilities

`@mokly/viewer` owns the readers of the catalogue index and the entry detail,
the Browse presentation, the selection model, navigation, comparison
presentation, inspection, instance resolution, the frame adapters, the in-frame
inspector, and the browser entry. It makes no analytics or discovery request,
reads no cookie, and uses no ambient credential. Consumer code never enters the
browser through the viewer.

The embedding application owns catalogue delivery, authentication, its URL and
route mapping, the surrounding product UI, slot content, markers, and
collaboration data. Use `@mokly/mokly` to author, serve, build, compare, and
publish the catalogue itself. `@mokly/mokly` depends on the exact released
version of this package and ships its browser bundle in every served and built
catalogue.

## Development

The repository is an npm workspace. The Rust core is a Cargo workspace under
`crates/`. `packages/mokly` holds the `@mokly/mokly` shim, the render sidecar,
and the authoring API. `packages/viewer` holds this package; its shared shapes
are the generated TypeScript types of the Rust model crate. From the repository
root:

```bash
npm ci
npm run build
npm test
npm run test:browser
cargo xtask check
```

`npm run build` builds the host native target, the shim, the sidecar, and the
viewer. The viewer build records every browser output in the browser module
inventory; `mokly build` copies exactly those files, and Serve serves exactly
them. `npm test -- packages/viewer/tests/<file> --test-name-pattern=<regex>`
runs one viewer test. `cargo xtask check` is the complete repository gate; it
runs the viewer typecheck, the viewer's Node tests, and the Playwright Browse
and Review regressions against `mokly serve` of the example catalogue.

### Key Code

- [`src/viewer`](./src/viewer) — the embedded `MoklyViewer`: React lifecycle,
  selection, host integration, and instance operations
- [`src/viewer/host_bridge.tsx`](./src/viewer/host_bridge.tsx) and
  [`src/viewer/host_bridge_highlight.ts`](./src/viewer/host_bridge_highlight.ts) —
  the public handle and its highlight requests, geometry, and cancellation
- [`src/shell`](./src/shell) — the Browse shell tree and its scoped styles,
  shared by the embedded viewer and the browser entry
- [`src/catalogue`](./src/catalogue) — the readers of the catalogue index and
  the entry detail, and the public catalogue types
- [`src/data`](./src/data) — the `./data` entry: path functions and directory
  names
- [`src/navigation/routes.ts`](./src/navigation/routes.ts) — entry, view,
  snapshot, preview, and shell URL derivation
- [`src/registry/nav_paths.ts`](./src/registry/nav_paths.ts) and
  [`src/registry/hierarchy.ts`](./src/registry/hierarchy.ts) — folder keys,
  labels, sibling order, and the path tree of each section
- [`src/client`](./src/client) — the frame adapters, message transport, and
  geometry
- [`src/inspector`](./src/inspector) — the React-free in-frame inspector
- [`src/previews`](./src/previews) — the removed-entry previews
- [`src/shell/use_comparison.ts`](./src/shell/use_comparison.ts),
  [`src/shell/comparison_presentation.ts`](./src/shell/comparison_presentation.ts),
  and [`src/shell/diffs.tsx`](./src/shell/diffs.tsx) — the comparison-mode
  owner, request identity, and current and comparison presentation
- [`src/shell/frame_instances.ts`](./src/shell/frame_instances.ts) — exact
  `InstanceRef` matching against mounted preview frames
- [`src/shell/store_host.ts`](./src/shell/store_host.ts) and
  [`src/shell/store_host_routes.ts`](./src/shell/store_host_routes.ts) —
  controlled and uncontrolled selection commits, frame-link misses, and
  navigation events
- [`src/shell/workspace_data.ts`](./src/shell/workspace_data.ts) and
  [`src/shell/workspace_usage_data.ts`](./src/shell/workspace_usage_data.ts) —
  the routed workspace data and its usage and affected-consumer projection
- [`src/review/order.ts`](./src/review/order.ts) — the canonical
  affected-consumer order
- [`tests`](./tests) — package-level conformance tests

### Related Docs

- [Embeddable viewer contract](../../docs/protocol/mokly-viewer.md)
- [Shell delivery and read model routes](../../docs/protocol/mokly-shell-delivery.md)
- [Public catalogue read model](../../docs/protocol/mokly-catalogue.md)
- [Path-derived artifact paths](../../docs/protocol/mokly-artifact-paths.md)
- [Paths, roots, and identity](../../docs/protocol/mokly-paths.md)
- [Viewer namespace and version gates](../../docs/protocol/mokly-viewer-namespace.md)
- [Frame adapter protocol](../../docs/protocol/mokly-frame-adapter.md)
- [Markers and multi-instance highlights](../../docs/protocol/mokly-viewer-markers.md)
- [Component instance identity](../../docs/protocol/mokly-instances.md)
- [Component controls](../../docs/protocol/mokly-component-controls.md)
- [Static delivery](../../docs/protocol/mokly-export-delivery.md)
- [Viewer appearance](../../docs/protocol/mokly-viewer-appearance.md)
- [Package and consumer boundary](../../docs/architecture/package-boundary.md)
- [Rust core architecture](../../docs/architecture/rust-core.md)
- [Changelog](./CHANGELOG.md)

## License

Mokly Viewer is available under the [MIT License](./LICENSE).
