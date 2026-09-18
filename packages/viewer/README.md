# Mokly Viewer

`@mokly/viewer` embeds an existing Mokly catalogue in a React application. Use it
when your application owns navigation, branding or discussion UI around published
screens. Use `@mokly/mokly` to author, build, serve, compare, export or upload a
catalogue. The viewer consumes public catalogue data and never runs consumer code,
Git commands or the CLI.

## Responsibilities

The package owns Browse presentation, navigation and inspection, the validated
catalogue reader, instance resolution and frame adapters. Hosts own their source
transport, surrounding product UI, authentication and selection routing.

## What This Package Does

- Renders pages, component variants, screen previews and ordered user flows with
  the existing Browse search, Changes filter, inspector and comparisons.
- Supports controlled selection, React slots, selection and inspection events,
  and an imperative handle for choosing, highlighting, scrolling and picking.
- Provides same-origin and explicitly configured cross-origin frame adapters.
- Renders the shell tree to HTML through the Node-only `@mokly/viewer/server`
  entry, then hydrates it in the browser. Standalone Serve and export load the
  package's hydration bundle, which includes React; React hosts hydrate with
  their own.

## Quick Start

```sh
npm install @mokly/viewer react react-dom
```

```tsx
import { useMemo, useRef } from "react";
import { MoklyViewer, postMessageAdapter } from "@mokly/viewer";
import type { MoklyViewerHandle } from "@mokly/viewer";
import "@mokly/viewer/styles.css";

export function Catalogue({ artifactOrigin }: { artifactOrigin: string }) {
  const viewer = useRef<MoklyViewerHandle>(null);
  const adapter = useMemo(
    () => postMessageAdapter({ frameOrigin: artifactOrigin }),
    [artifactOrigin],
  );
  return (
    <div style={{ height: "100vh" }}>
      <MoklyViewer
        ref={viewer}
        catalogue={`${artifactOrigin}/__mokly/catalogue.json`}
        frameAdapter={adapter}
        slots={{
          topBarEnd: (
            <button onClick={() => viewer.current?.select({ screenId: null })}>
              Catalogue home
            </button>
          ),
        }}
      />
    </div>
  );
}
```

The example requires a separate, nonopaque HTTP(S) artifact origin with the
[documented CORS headers](../../docs/protocol/mokly-export-delivery.md).
For same-origin artifacts, omit `frameAdapter`. Adapters and object/fetcher source
identities should remain stable between host renders; changing one remounts the
runtime and cancels its pending work.

## Public API

`MoklyViewer` accepts one source form:

- A validated catalogue object and required HTTP(S) `baseUrl`.
- An absolute catalogue URL (`string` or `URL`), without `baseUrl`.
- A fetcher receiving `{ signal: AbortSignal }` and returning
  `{ catalogue, url: URL }`, without `baseUrl`.

All sources pass through `readCatalogue`. Paths resolve from the artifact origin,
not the embedding page. Failed loads show a retry action and emit `onError`.

`defaultSelection` initializes uncontrolled state. Controlled `selection` requires
`onSelectionChange` and forbids `defaultSelection`. Selection comprises `screenId`
(null means home), `view` (All/Changes filter), `viewport`, `colorScheme`, `search`
and `tags`. Partial handle updates merge, validate and normalize `tag:` terms;
controlled changes remain proposals until supplied back. Incoming props do not
echo callbacks. Remount to change control mode.

Slots are `topBarStart`, `topBarEnd`, `railStart`, `railEnd`, `sidePanel` (content
and width), `stageOverlay` (content and explicit pointer events), and `emptyState`
(home only). Slot updates retain selection and frame sessions. The overlay covers
the preview stage; it does not cover navigation or the inspector.

Events are `onSelectionChange`, `onScreenNavigate`, `onInstanceHover`,
`onInstanceClick`, `onPickStart`, `onPickEnd`, and `onError`. Instance references
include screen, variant when applicable, viewport, scheme and key. Flow events
also identify their owning entry and step. `resolveInstance` compares saved
records without fetching evidence.
Flow `InstanceRef` values include `stepIndex` to address an exact occurrence.
Imperative highlighting applies masks, labels and events only to that reference's
viewport, scheme, variant and step; workspace selection can still span Both.
Scoped inspection waits for and measures only its target sessions, so pending or
unavailable sibling views do not block it. Unrelated masks are cleared without
inspecting their usage. A failed current highlight removes its masks and labels.
Automatic hover/click inspection also requires each frame's own ready usage.
Pending or unavailable siblings keep working links without emitting instance
events or pointer-driven inspection errors. Built-in adapters implement optional
`MountedFrame.updateUsage` so the frame update path can adopt validated evidence
and enable inspection on the same document without remounting it. Custom adapters
without this method retain replacement mounts for changed usage. Changing the
React catalogue source still replaces the runtime as documented above.

Evidence refreshes restore valid inspection masks, outlines and labels without
ending an active pick. Explicit highlights retain their exact frame scope;
unrelated or pending siblings do not disturb them. If ready evidence or any
referenced instance disappears, the viewer clears the presentation and ends an
active pick once with `onPickEnd({ reason: "evidence" })`. An idle explicit
highlight clears without a pick event. Updating a pending activation's scope
cancels it with `disposed` and no start/end events. A new `startPick` waits for
the refreshed evidence and works once its views are inspectable. Superseded
updates cannot overwrite current inspection or report obsolete errors.

The ref exposes `select`, `highlightInstance` (null clears), `scrollToInstance`,
`startPick`, and idempotent `cancelPick`. Async operations reject unavailable
instances/views and report one safe error. Picking uses existing inspection
visuals; the default shell has no pick control. Unmount cancels pending work
without later callbacks. The [viewer contract](../../docs/protocol/mokly-viewer.md)
defines exact events, rejection and cancellation semantics.
Replacing frames for viewport, scheme, variant or fragment changes ends an
active pick with `navigation` and rejects pending activation without start/end
events. Inspection is reset before new frames mount. Source/adapter teardown
releases all frame/runtime resources even if a host callback throws, preserving
the original exception. Flow fragments address only their first step.
Late inspection successes and failures are fenced by their request and frame
generation. Superseded handle promises reject with `disposed`, while obsolete
work cannot clear replacement labels, cancel a fresh pick or emit errors against
it. The rule covers highlights, label refreshes, scrolls and geometry events.

Import the stylesheet once. Override `--mokly-accent`,
`--mokly-accent-contrast`, and `--mokly-accent-soft` on a containing element,
maintaining readable contrast. Scoped styles exclude host slots and the
surrounding page; fonts are packaged locally. Internal selectors and geometry are
not extension APIs.

For synchronous server rendering:

```tsx
import { readCatalogue } from "@mokly/viewer";
import { renderViewer } from "@mokly/viewer/server";

export function catalogueHtml(json: unknown, artifactOrigin: string) {
  return renderViewer({
    catalogue: readCatalogue(json),
    baseUrl: artifactOrigin,
    defaultSelection: { screenId: null },
  });
}
```

`./server` additionally provides typed first-party document context and package
asset resolution. `./runtime` exposes the standalone runtime, private-service
injection and validated revision adoption used by the CLI host. `./data` exposes
shared pure build/comparison value contracts; it contains no CLI execution or
filesystem access. Hosts embedding React normally use only the root entry and
stylesheet.

`@mokly/viewer/browser` is the standalone browser entry paired with full
documents rendered by `@mokly/viewer/server`. Serve and export bundle that entry
with React as `react-shell.js`; application-owned React hosts continue to use
the root `MoklyViewer` entry instead. Importing the browser entry automatically
hydrates a matching document, so the published manifest marks its JavaScript
output as side-effectful and bundlers must retain a side-effect-only import.

## Releases

The first viewer release is 0.1.0, paired with CLI 0.10.0 (CLI 0.9.0 is already
published). One release-please PR updates independent versions, both changelogs
and the CLI's exact viewer dependency. Viewer tags are `viewer-vX.Y.Z`; CLI tags
remain `vX.Y.Z`. The release workflow verifies both tags at one commit, checks
and smokes both tarballs, then publishes and verifies the viewer before the CLI.
Unchanged packages receive a patch when their paired package releases.
Release Please explicitly pins the viewer's initial version to 0.1.0; its 0.0.0
manifest entry means that no viewer release has been created yet.
See the [release contract](../../docs/protocol/npm-release.md) and the
[one-time viewer registration](../../docs/protocol/npm-bootstrap.md#viewer-first-publication).
Preparation does not publish packages; first registration requires a maintainer
after the release PR merges.

## Development

From the repository root:

```sh
npm ci
npm run build
npm run test --workspace @mokly/viewer
npx playwright test tests/browser/viewer*.spec.ts
npm run package:smoke
cargo xtask check
```

The root build compiles this workspace first, then the CLI. Package smoke tests
pack the viewer before the CLI and install both archives with the CLI's exact
version dependency. Every public entry and server rendering of the published
catalogue fixture are exercised from clean installs; production dependency
auditing includes both packages.

### Key Code

- `src/viewer`: React lifecycle, selection, slots and adapter sessions.
- `src/shell`: the shell component tree, scoped state/history store, pure
  route/filter helpers and standalone CSS.
- `src/browser.tsx` and `src/standalone`: standalone bootstrap validation,
  full-document hydration, and its browser entry.
- `src/client`: frame adapters, message transport, geometry and revision
  adoption consumed by the shell through hooks (the vanilla enhancement
  modules there are retired by the React Browse shell plan).
- `src/catalogue` and `src/components`: public readers and instance contracts.
- `src/inspector` and `scripts`: bounded in-frame inspector and asset builds.
- `tests` and root `tests/browser/viewer*.spec.ts`: package conformance tests.

### Related Docs

[Viewer API](../../docs/protocol/mokly-viewer.md),
[catalogue format](../../docs/protocol/mokly-catalogue.md),
[frame adapters](../../docs/protocol/mokly-frame-adapter.md),
[instances](../../docs/protocol/mokly-instances.md),
[package boundary](../../docs/architecture/package-boundary.md),
[plans](../../plans/README.md).
