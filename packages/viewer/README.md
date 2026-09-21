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
- Delivers a small classic appearance startup before standalone styles so a
  stored, pinned or automatic Dark appearance is present for first paint; the
  hydrated shell adopts that state without adding a second shell runtime.

## Quick Start

```sh
npm install @mokly/viewer react react-dom
```

```tsx
import { useMemo, useRef } from "react";
import { MoklyViewer, postMessageAdapter } from "@mokly/viewer";
import type { MoklyViewerHandle, ViewerMarker } from "@mokly/viewer";
import "@mokly/viewer/styles.css";

export function Catalogue({
  artifactOrigin,
  commentMarker,
}: {
  artifactOrigin: string;
  commentMarker?: ViewerMarker;
}) {
  const viewer = useRef<MoklyViewerHandle>(null);
  const adapter = useMemo(
    () => postMessageAdapter({ frameOrigin: artifactOrigin }),
    [artifactOrigin],
  );
  return (
    <div style={{ height: "100vh" }}>
      <MoklyViewer
        ref={viewer}
        viewerId="catalogue"
        catalogue={`${artifactOrigin}/__mokly/catalogue.json`}
        frameAdapter={adapter}
        markers={commentMarker ? [commentMarker] : []}
        theme="auto"
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

The host creates each `ViewerMarker` from a saved `InstanceRef` and supplies any
React content, for example a comment-count button with
`style={{ pointerEvents: "auto" }}`. The viewer positions it on that instance;
the host owns the comment data and interaction.

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
Every viewer requires a stable `viewerId`: 1–64 ASCII letters, digits, hyphens
or underscores, starting with a letter or digit. Keep it unique within the host
document. When hydrating `renderViewer()` output, pass the identical `viewerId`
to both server and client renders so package-owned IDs and accessibility
references remain root-local. The package preserves the viewer/local-ID
boundary even when a valid viewer ID resembles an internal control ID; generated
DOM ID bytes are not an extension API. Host slot descendants are never
namespaced.

`defaultSelection` initializes uncontrolled state. Controlled `selection` requires
`onSelectionChange` and forbids `defaultSelection`. Selection comprises `screenId`
(null means home), optional saved `variantId`, `view` (All/Changes filter),
`viewport`, `colorScheme`, `search` and `tags`. Partial handle updates merge,
validate and normalize `tag:` terms;
controlled changes remain proposals until supplied back. Incoming props do not
echo callbacks. Remount to change control mode.

`theme` sets the interface around embedded previews to `"auto"`, `"light"` or
`"dark"`; Auto is the default and follows the reader's system preference. It is
independent of `selection.colorScheme`, so hosts can combine either interface
appearance with either preview scheme. Updating `theme` preserves frames,
selection, temporary props, picking, highlights and markers, and it never
mutates the host document or sibling roots. Standalone Serve/export instead
render one Appearance selector that sets interface and previews together; see
the [appearance contract](../../docs/protocol/mokly-viewer-appearance.md).

`markers` supplies unique host marker ids, exact instance references and React
content. `onMarkerChange` reports each marker as visible, hidden or unavailable
without exposing geometry. Marker content is pointer-inert unless it opts in.
Duplicate ids render no markers and emit a `markers` error. See the
[marker and multi-highlight contract](../../docs/protocol/mokly-viewer-markers.md).

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
Imperative highlighting applies masks and labels only to that reference's
viewport, scheme, variant and step; workspace selection can still span Both.
Scoped inspection waits for and measures only its target sessions, so pending or
unavailable sibling views do not block it. Unrelated masks are cleared without
inspecting their usage. A failed current highlight removes its masks and labels.
Automatic hover/click inspection requires each frame's own ready usage and
remains available from every current visible ready frame, independent of an
explicit highlight's mask and label scope. An idle explicit highlight survives
those pointer events; an accepted click ends an active pick. Pending or
unavailable siblings keep working links without emitting instance events or
pointer-driven inspection errors. Built-in adapters implement optional
`MountedFrame.updateUsage` so the frame update path can adopt validated evidence
and enable inspection on the same document without remounting it. Custom adapters
without this method retain replacement mounts for changed usage. Changing the
React catalogue source still replaces the runtime as documented above.
The shell also supplies `FrameMount.onEvent` before an adapter starts loading.
Before a replacement, the same-origin adapter transfers that receiver only to
the exact currently visible `Document` that an earlier same-origin mount
authenticated for the frame. It then independently authenticates and adopts the
exact assigned replacement document as soon as it is accessible rather than
waiting for slower subresources and the iframe `load` event. Valid logical links
in an authenticated document therefore remain parent-owned throughout source
handoffs; a document reached through unowned frame navigation keeps portable
native-link behavior until the assigned replacement authenticates. The first
same-origin mount may authenticate a matching server-rendered starting document
for hydration. Later mounts exclude their exact unrecorded starting document
from URL-based authentication, even when its URL already matches the new
assignment; only a different loaded document can authenticate. The first
matching `MountedFrame.subscribe` adopts the receiver without duplicating
events. Custom adapters should honor the same authenticated mount-time receiver
contract. Unsubscribing or disposing restores portable native-link behavior.

Evidence refreshes restore valid inspection masks, outlines and labels without
ending an active pick. Explicit highlights retain their exact frame scope;
unrelated or pending siblings do not disturb them. If ready evidence or any
referenced instance disappears, the viewer clears the presentation and ends an
active pick once with `onPickEnd({ reason: "evidence" })`. An idle explicit
highlight clears without a pick event. Updating a pending activation's scope
cancels it with `disposed` and no start/end events. A new `startPick` waits for
the refreshed evidence and works once its views are inspectable. Superseded
updates cannot overwrite current inspection or report obsolete errors.

The ref exposes `select`, `highlightInstance` (null clears), atomic
`highlightInstances` (empty clears), `scrollToInstance`, `startPick`, and
idempotent `cancelPick`. Async operations reject unavailable
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
maintaining readable contrast in both appearances. Unset overrides receive the
current semantic palette default. Scoped styles exclude host slots and the
surrounding page; fonts are packaged locally. Internal selectors and geometry are
not extension APIs.

For synchronous server rendering:

```tsx
import { readCatalogue } from "@mokly/viewer";
import { renderViewer } from "@mokly/viewer/server";

export function catalogueHtml(json: unknown, artifactOrigin: string) {
  return renderViewer({
    viewerId: "catalogue",
    catalogue: readCatalogue(json),
    baseUrl: artifactOrigin,
    defaultSelection: { screenId: null },
    theme: "light",
  });
}
```

`./server` additionally provides typed first-party document context and package
asset resolution. `./runtime` exposes browser-safe live-capability, recovery,
catalogue-revision, standalone-bootstrap, inspector metadata and local-frame
helpers used by the CLI host and repository publication adapter. `./data`
exposes shared pure build/comparison value contracts, including the strict
`parseRemovedPagePreview` reader for advertised page-preview payloads; it
contains no CLI execution or filesystem access. Public catalogue removed-entry
types retain optional screen/page preview descriptors, validated against the
catalogue's comparison generation. Selecting a removed entry renders its
read-only previous version from those advertised addresses alone; a catalogue
without them, or without a comparison, shows the unavailable state without any
request. Hosts embedding React normally use only the root entry and stylesheet.

`@mokly/viewer/browser` is the standalone browser entry paired with full
documents rendered by `@mokly/viewer/server`. Serve and export bundle that entry
with React as `react-shell.js`; application-owned React hosts continue to use
the root `MoklyViewer` entry instead. Importing the browser entry automatically
hydrates a matching document, so the published manifest marks its JavaScript
output as side-effectful and bundlers must retain a side-effect-only import.
Serve hydrates from its validated inline read model. Exported pages retain full
server-rendered content and a compact bootstrap; the browser fetches the shared
finalized `__mokly/catalogue.json`, validates its deployment and revisions, and
hydrates only after it matches. A failed static catalogue read leaves ordinary
server-rendered links usable.
Standalone documents also load `appearance-startup.js` before the shell
stylesheet. It restores the origin-local Appearance preference, applies a valid
`scheme` URL pin without saving it, follows system changes under Auto, and
hands the effective preview scheme to the hydrated store before hydration.
Local Serve supplies updates, recovery, private workspace evidence, temporary
previews and on-demand Usage through the separate
[live capability contract](../../docs/protocol/mokly-live-capabilities.md).
Those capabilities are not part of the public `MoklyViewer` host API or static
export. A static shell can read inert route-scoped workspace evidence from the
destination page in the same finalized deployment, preserving the full Details
and Usage data during React-owned navigation without enabling live host
behavior.

## Releases

Viewer 0.1.0 and CLI 0.10.0 were published together. Release Please maintains
their independent versions, both changelogs and the CLI's exact viewer
dependency. Viewer tags are `viewer-vX.Y.Z`; CLI tags remain `vX.Y.Z`. The
workflow verifies both tags at one commit, checks and smokes both tarballs, then
publishes and verifies the viewer before the CLI. See the
[release contract](../../docs/protocol/npm-release.md).

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
  adoption consumed by the shell through hooks.
- `src/catalogue` and `src/components`: public readers and instance contracts.
- `src/inspector` and `scripts`: bounded in-frame inspector and asset builds.
- `tests` and root `tests/browser/viewer*.spec.ts`: package conformance tests.

### Related Docs

[Viewer API](../../docs/protocol/mokly-viewer.md),
[markers and multi-instance highlights](../../docs/protocol/mokly-viewer-markers.md),
[catalogue format](../../docs/protocol/mokly-catalogue.md),
[frame adapters](../../docs/protocol/mokly-frame-adapter.md),
[instances](../../docs/protocol/mokly-instances.md),
[package boundary](../../docs/architecture/package-boundary.md),
[plans](../../plans/README.md).
