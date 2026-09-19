# Live Viewer Capabilities

## Status

Implemented for the hydrated React shell served during local Serve. Static
export and application-owned `MoklyViewer` hosts do not receive these
capabilities. Serve uses the React host composition for every shell request.
Static export has a separate inert destination-page evidence reader so
same-shell navigation can retain the route-scoped data already present in each
exported page; it has no live behavior, update transport, or private token.

## Boundary

The public catalogue is the shell's portable read model. Local Serve adds a
private descriptor in a separate `application/json` script with
`data-mokly-host-capability-state`. Private workspace evidence and the
temporary-render token never enter the public catalogue or shell bootstrap.

The live document has `data-mokly-host-capabilities` and loads
`/__mokly/client/react-host.js`. That host imports the same
`react-shell.js` module used by export, creates CLI-owned capabilities, and
calls `hydrateMoklyShell(document, capabilities)`. Importing `react-shell.js`
while the host marker is present does not auto-hydrate. This ordering ensures
React receives its capability context before creating the root. Export has no
marker, descriptor, token, private host modules, or host loader; its direct
`react-shell.js` import auto-hydrates.

The descriptor contains:

- schema version `1`;
- the base ref, catalogue identity, content and evidence revisions, update
  version, optional on-demand preview generation, and optional temporary
  renderer generation;
- an optional temporary-render capability owned by the CLI host;
- optional route-scoped `WorkspaceData` for screen and component routes.

The workspace copy omits `renderCapability`. React invokes authenticated
temporary rendering through a closure, so the token cannot enter store state.
The descriptor is canonical JSON with inline-script escapes. Its workspace
shape, base and on-demand preview generation are validated before use. The
temporary-render capability is bound independently to the renderer generation.
When both generations exist they must agree, but a complete compiled catalogue
can expose temporary rendering without enabling on-demand Usage loading.

## React Context

`ViewerCapabilityBoundary` separates initial data from browser behavior:

- `useViewerInitialWorkspace()` returns the descriptor workspace during both
  server rendering and first client render. This makes private status,
  comparison eligibility, affected usage, input changes, related components
  and evidence identical across hydration.
- `useViewerLiveState()` returns the exact adopted request and its matching
  private workspace from the shell store. A workspace from an older route or
  revision is never exposed.
- `useViewerCapabilities()` returns browser behavior only after the live host
  supplies it. Export returns `undefined`.

The static evidence reader is a separate context value. It reads only the
requested same-origin exported shell, validates its route, catalogue and
deployment identity, and returns its inert workspace JSON. It never implements
`ViewerHostCapabilities` or enters `useViewerLiveState()`.

`ViewerHostCapabilities` contains:

- `source`, the installed source and revision identity;
- `evidence.initialWorkspace(request)`, for the exact hydration route and
  revision;
- `evidence.loadRouteEvidence(request, signal)`, for the paired public and
  private evidence read after same-shell navigation;
- `updates.consumeRecovery(request)` and
  `updates.subscribe(request, actions, signal)`;
- optional `temporaryPreviews.render` and `temporaryPreviews.expired`;
- optional `onDemand.loadWorkspace` for Usage records.

Every operation receives a `ViewerCapabilityRequest` containing the current
logical route and source. The shell creates a fresh request after adopting a
revision. It uses `ViewerCapabilityScope` to abort work when route, catalogue,
content, evidence, update version, preview generation or renderer generation
changes, and closes the scope on unmount.

## Initial And Routed Workspace Evidence

The server computes initial private `WorkspaceData` from the same accepted
catalogue snapshot and shell context used for SSR. Both SSR and hydration read
that data from the descriptor, independently of browser-only behavior.

React navigation does not replace the mounted shell with fetched HTML. When a
newly routed screen or component needs private data,
`evidence.loadRouteEvidence` fetches the current page as evidence only. The
page's public shell bootstrap and private capability descriptor form one
atomic candidate: the shell adopts the public catalogue, source and routed
workspace together, or retains its current evidence. It accepts the result
when all of these remain true:

- the response is successful and its final URL is the requested URL without a
  fragment;
- browser location is unchanged;
- the request signal remains active;
- catalogue identity, content revision, base ref and render capability still
  match the installed source;
- evidence and update revisions never move backwards, and the public
  catalogue exactly matches the descriptor revisions;
- the bootstrap context and route exactly match the descriptor and current
  logical route;
- the render generation and token still match the installed host;
- the returned workspace route equals the current logical route.

A route response may advance the evidence revision while retaining the update
version. On-demand rendering can publish newer evidence without a watch event,
so the fetched page is the authoritative atomic pair for that route. Mixed
public/private revisions, changed content or catalogue identity, and older
sources are rejected.

Pages, flows, home and missing routes have no workspace result. A route or
source replacement cancels the request and obsolete results are ignored.
The public read model commits navigation before this metadata request starts;
holding, failing or aborting the request cannot delay the URL and main-view
transition or replace their React-owned DOM. Same-document Back cancels an
obsolete request while retaining the mounted shell.

## Watched Updates

The CLI keeps the existing event protocol and `LiveUpdateController`. One
effect-scoped subscription owns one `EventSource`; abort, page exit or effect
replay closes it and any pending refresh. A newer update first fetches the
current page descriptor, then the public catalogue.

Evidence adoption is atomic. The page descriptor's source and private
workspace must describe the exact same evidence revision as the public
catalogue response. Catalogue identity, content revision, evidence revision,
update version, base ref, preview generation, route and render capability are
fenced before `adoptEvidence` runs. A mixed response from two server snapshots
is rejected and follows the existing reload recovery path. Successful adoption
returns a `ViewerEvidenceRevision` containing the public catalogue, private
workspace when the route owns one, and the source for the next request. Frames
and shell state are updated in place by the consumer; the capability does not
mutate DOM.

Content revision or render-generation changes are never adopted as evidence.
They retain the full reload lifecycle.

## Recovery And Optional Transports

Reload recovery uses the existing one-shot session-storage payload. The host
converts between the legacy `changedOnly` value and the shell's `view` value,
and accepts recovery only for the current URL and a version no newer than the
rendered page. Reading removes the payload.

`EventSource` and session storage are optional browser facilities. If either is
missing, denied or throws, the host still hydrates the shell. It reports the
transport failure as a browser warning and leaves only the affected update or
recovery feature unavailable. A malformed descriptor remains a hard error
because the marked document cannot be safely paired with a different source.

Temporary previews validate the request source, generation, response view and
render identity before returning. Expiry checks cover only known authenticated
preview URLs. On-demand Usage validates the request route and preview
generation, shares the existing loader, and stops on abort. Neither facility
exists when its server capability is absent.

## Delivery Checks

Serve exposes `react-host.js`, `react_capabilities.js`,
`react_capability_updates.js`, `react_transports.js`,
`react_update_controller.js`, `host_capabilities.js` and
`host_capability_descriptor.js`. The package graph requires every import to
resolve within the served inventory and permits React only in `react-shell.js`.
The CLI build rewrites the host's viewer-browser import to that relative bundle
so delivery contains one React and context instance.

Static export and generated preview catalogues exclude all five live-only
modules, `browser.js`, and `live_updates.js`. Export tests also reject the host
marker, private state script and host loader in every rendered document.
