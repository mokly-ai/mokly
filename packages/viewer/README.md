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
  <a href="./docs/concepts/README.md">Core concepts</a> ·
  <a href="./docs/api/README.md">API</a> ·
  <a href="./docs/deployment/README.md">Deployment</a> ·
  <a href="#development">Development</a>
</p>

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
Read [Deployment and security](./docs/deployment/README.md) before you ship this
configuration.

## Guides

- [Core concepts](./docs/concepts/README.md): catalogue sources, selection,
  host integration, component instance references, and live controls.
- [API reference](./docs/api/README.md): the `MoklyViewer` props, the
  `MoklyViewerHandle` methods, and the package entry points.
- [Theming](./docs/theming/README.md): the interface appearance, the accent
  properties, and the standalone reader preferences.
- [Deployment and security](./docs/deployment/README.md): static hosting,
  same-origin and cross-origin delivery, caching, and Content Security Policy.

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
- [`src/data.ts`](./src/data.ts) — the `./data` entry: path functions,
  directory names, the path and link grammar, and the prop schema validators
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
  [`src/viewer/public_workspace.ts`](./src/viewer/public_workspace.ts) — the
  routed workspace data and its projection from the index and entry detail
- [`src/review/result_validation.ts`](./src/review/result_validation.ts) and
  [`src/review/result_order.ts`](./src/review/result_order.ts) — the strict
  review result v8 reader and the canonical record order it requires
- [`src/catalogue/detail_reasons.ts`](./src/catalogue/detail_reasons.ts) and
  [`src/catalogue/reason_order.ts`](./src/catalogue/reason_order.ts) — the
  entry detail's `reasons` and the reason order it shares with review v8
- [`src/viewer/public_reasons.ts`](./src/viewer/public_reasons.ts) — the
  detail reasons that Details shows: listed records only, without the reasons
  that contradict the record
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
