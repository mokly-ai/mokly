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

`@mokly/viewer` owns the shell state, the readers of the catalogue index and the
entry detail, the selection model, navigation, the comparison and inspection
logic, instance resolution, the preview frames with the frame adapters and the
in-frame inspector, and the browser entry. `@mokly/ui` owns every element and
every style rule of the Browse shell. The viewer's containers read the shell
state and render the package components with props and callbacks, so the
viewer renders no element of its own. The viewer makes no analytics or
discovery request, reads no cookie, and uses no ambient credential. Consumer
code never enters the browser through the viewer.

The embedding application owns catalogue delivery, authentication, its URL and
route mapping, the surrounding product UI, slot content, markers, and
collaboration data. Use `@mokly/mokly` to author, serve, build, compare, and
publish the catalogue itself. `@mokly/mokly` depends on the exact released
version of this package and ships its browser bundle in every served and built
catalogue.

## Development

The repository is an npm workspace. The Rust core is a Cargo workspace under
`crates/`. `packages/mokly` holds the `@mokly/mokly` shim, the render sidecar,
and the authoring API. `packages/ui` holds `@mokly/ui`, every element and
every stylesheet of the shell. `packages/viewer` holds this package; its
shared shapes are the generated TypeScript types of the Rust model crate. From
the repository root:

```bash
npm ci
npm run build
npm test
npm run test:browser
cargo xtask check
```

`npm run build` builds the host native target, the shim, the sidecar, the UI
package, and the viewer. The viewer build writes `shell.css` and `styles.css`
from the `@font-face` rule of the shell font and the UI package's `styles.css`,
whose rules keep the cascade order that `packages/ui/src/styles.css` lists.
The embedded `styles.css` needs no `@scope` rule, because no package rule
reaches the host page or host slot content. The build records every browser
output in the browser module inventory; `mokly build` copies exactly those
files, and Serve serves exactly them.
`npm test -- packages/viewer/tests/<file> --test-name-pattern=<regex>`
runs one viewer test. `cargo xtask check` is the complete repository gate; it
runs the viewer typecheck, the viewer's Node tests, and the Playwright Browse
and Review regressions against `mokly serve` of the example catalogue.

### Key Code

- [`../ui/src`](../ui/src) — the `@mokly/ui` presentational components the
  shell composes, one directory per component with its CSS beside it
- [`src/viewer`](./src/viewer) — the embedded `MoklyViewer`: React lifecycle,
  source loading, host integration, and instance operations; it imports the
  shared shell, which has no dependency on this directory
- [`src/host/types.ts`](./src/host/types.ts) — the public viewer contract,
  shared by the shell and the embedded host
- [`src/viewer/host_bridge.tsx`](./src/viewer/host_bridge.tsx) and
  [`src/viewer/host_bridge_highlight.ts`](./src/viewer/host_bridge_highlight.ts) —
  the public handle and its highlight requests, geometry, and cancellation
- [`src/shell`](./src/shell) — the Browse shell tree, shared by the embedded
  viewer and the browser entry; it holds no style rule
- [`src/shell/top_bar.tsx`](./src/shell/top_bar.tsx),
  [`src/shell/nav.tsx`](./src/shell/nav.tsx), and
  [`src/shell/head.tsx`](./src/shell/head.tsx) — the containers of the top
  bar, the catalogue navigation, and the screen header; `nav_rows.ts` and
  `nav_leaf_rows.ts` build the navigation's records from the shell state
- [`src/shell/tags.tsx`](./src/shell/tags.tsx) and
  [`src/shell/workspace_controls.tsx`](./src/shell/workspace_controls.tsx) —
  the containers of the tag picker, the tag chips of the details, and the
  view controls; `tag_selection.ts` returns focus to the picker's button
  after a tag of the details, and `view_marks.ts` decides the change marks
- [`src/shell/inspector.tsx`](./src/shell/inspector.tsx) and
  [`src/shell/details.tsx`](./src/shell/details.tsx) — the containers of the
  inspector and the Details: the tabs, Escape anywhere in the shell root, and
  the metadata rows, whose catalogue lookups live in `details_rows.tsx`;
  `inspector_resize.ts` sizes the inspector and its mobile sheet
- [`src/shell/component_controls_panel.tsx`](./src/shell/component_controls_panel.tsx),
  [`src/shell/workspace_props.tsx`](./src/shell/workspace_props.tsx),
  [`src/shell/workspace_usage.tsx`](./src/shell/workspace_usage.tsx),
  [`src/shell/workspace_instances.tsx`](./src/shell/workspace_instances.tsx),
  and [`src/shell/workspace_evidence.tsx`](./src/shell/workspace_evidence.tsx)
  — the containers of the inspector's panels, which turn the controls state,
  the usage links, the instance records, and the comparison evidence into the
  records and the wording of the package components
- [`src/shell/stage_frame.tsx`](./src/shell/stage_frame.tsx),
  [`src/shell/document_stage_frame.tsx`](./src/shell/document_stage_frame.tsx),
  [`src/shell/public_stage.tsx`](./src/shell/public_stage.tsx), and
  [`src/shell/previews.tsx`](./src/shell/previews.tsx) — the containers of the
  preview frames, the stages, a user flow's steps, and a removed entry's
  previous version: they mount each frame, derive its sources, and pass its
  `ref` and attributes to the package's `<iframe>`; `frames.tsx` holds the
  expanded browser frame in the store
- [`src/shell/views.tsx`](./src/shell/views.tsx),
  [`src/shell/workspace.tsx`](./src/shell/workspace.tsx),
  [`src/shell/embedded_viewer.tsx`](./src/shell/embedded_viewer.tsx), and
  [`src/standalone/shell.tsx`](./src/standalone/shell.tsx) — the containers of
  the shell layout: the main region, the workspace, an embedded root with its
  host slots, and the standalone root, which carries the appearance, the
  preview scheme, and the expanded window's mark; `src/viewer/component.tsx`
  shows an
  embedded root's loading and failure states, and
  `src/shell/marker_layer.tsx` and `src/viewer/inspection_layer.tsx` place
  the host's markers and inspection labels
- [`src/shell/comparison_views.tsx`](./src/shell/comparison_views.tsx) and
  [`src/shell/comparison_viewport.tsx`](./src/shell/comparison_viewport.tsx) —
  the containers of the comparison sections and panes, which own each
  section's scroll controller and attach the viewport, its spacer, and each
  surface to it through refs
- [`scripts/styles.mjs`](./scripts/styles.mjs) — writes the standalone
  `shell.css` and the embedded `styles.css` from the `@font-face` rule of
  [`src/shell/assets/fonts/inter.css`](./src/shell/assets/fonts/inter.css) and
  the UI package's `styles.css`: the font's address in each delivery, the
  embedded font family, and the fallbacks that let a host's accent overrides
  inherit
- [`src/catalogue`](./src/catalogue) — the readers of the catalogue index and
  the entry detail, and the public catalogue types
- [`src/catalogue/sources.ts`](./src/catalogue/sources.ts) — the shared object
  and URL source validation and the index, detail, and deployment transports
- [`src/data.ts`](./src/data.ts) — the `./data` entry: path functions,
  directory names, the path and link grammar, and the prop schema validators
- [`src/navigation/routes.ts`](./src/navigation/routes.ts) — entry, view,
  snapshot, preview, and shell URL derivation
- [`src/shell/catalogue.ts`](./src/shell/catalogue.ts) — the shell's lookups of
  generated current and removed records, tags, schemes, and accepted moves
- [`src/registry/catalogue_hierarchy.ts`](./src/registry/catalogue_hierarchy.ts)
  and [`src/registry/hierarchy.ts`](./src/registry/hierarchy.ts) — the index
  tree's navigation records and the Specs and Components sections
- [`src/registry/nav_paths.ts`](./src/registry/nav_paths.ts) — the shared
  comparator for each section's sibling order
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
- [`src/shell/store_routes.ts`](./src/shell/store_routes.ts) and
  [`src/shell/store_interactions.ts`](./src/shell/store_interactions.ts) — the
  shared route installation, Escape priority, outside-click dismissal, and
  input listeners of both roots
- [`src/shell/selection.ts`](./src/shell/selection.ts) and
  [`src/shell/projection.ts`](./src/shell/projection.ts) — selection changes,
  query equality, and the catalogue context; root options alone set `embedded`
- [`src/shell/workspace_data.ts`](./src/shell/workspace_data.ts) and
  [`src/shell/public_workspace.ts`](./src/shell/public_workspace.ts) — the
  routed workspace data and its projection from the index, entry detail, and
  parent detail for current component variant lists
- [`src/shell/comparison_request.ts`](./src/shell/comparison_request.ts) — the
  generation root of a comparison: the pinned root a static catalogue names,
  or the root that Serve's selection redirects to and its renewal
- [`src/catalogue/detail_comparison.ts`](./src/catalogue/detail_comparison.ts)
  and [`src/shell/public_compared.ts`](./src/shell/public_compared.ts) — the
  detail's view states, ignore ids, and base side, and the routed entry's
  comparison facts that the panes and Details read from them
- [`src/catalogue/detail_reasons.ts`](./src/catalogue/detail_reasons.ts) and
  [`src/catalogue/reason_order.ts`](./src/catalogue/reason_order.ts) — the
  entry detail's `reasons` and the reason order it shares with review v8
- [`src/shell/public_reasons.ts`](./src/shell/public_reasons.ts) — the
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
