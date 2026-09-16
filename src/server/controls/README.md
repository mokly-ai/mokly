# Local Component Rendering

Serve enables this private service with the runtime retained by validated catalogue
index preparation; it does not wait for exhaustive Build. Static export never
supplies a capability, token, or rendering endpoint.
The public authoring API and ordinary renderer remain the integration boundary.

When controls are active, every Serve request requires Host to be exactly
`localhost:<port>` or `127.0.0.1:<port>`, with a decimal port from 1 to 65535
and no leading zero. A non-loopback Host returns 403 for the whole catalogue,
including ordinary pages and static assets. Forwarded local ports may differ
from the listening socket port. The parent shell sends controlled overrides to
`POST /__mokly/components/render`, which requires
Origin to equal `http://` plus Host exactly, the shell token, current generation,
saved variant and view. Preview GET/HEAD validates Host and its authenticated
render id without requiring Origin or the POST token. `x-forwarded-*` headers
never grant authority. The body
is strict JSON capped at 64 KiB. Shared schema/codec validation checks every
merged prop, including fields that cannot be edited.

`RenderQueue` admits one active job and eight queued pages, coalesces requests
per mounted page, cancels superseded work, and replaces a worker after failure
or a ten-second timeout. The worker evaluates the retained in-memory consumer
bundle; no independently configured renderer or React graph is loaded. A
renderer cannot occupy the server's HTTP thread or delay its shutdown.
Worker failures retain their diagnostic as a server-only detail, logged to stderr
by the HTTP boundary. Responses keep the generic preview failure message and
never include resource paths, exclusion globs, or other diagnostic details.

`transient.ts` uses Build's stylesheet selection, renderer, compatibility/link
transformation, ownership, range, prop, per-view metadata and resource checks.
It retains one `DocumentCompiler` per generation instead of cloning and validating
the full catalogue for each keystroke. Existing
public resources are copied into the edited document's immutable memory bundle.
Generated inline styles remain part of its HTML. No generated file, manifest,
watch event, Review artifact, or export inventory is written by this service.

`RenderStore` bounds bundles to sixteen entries and 32 MiB including usage/props
metadata. Five-minute expiration and eviction return 410 for authenticated old
ids; malformed or foreign ids return 404. Every response is `no-store` and
`nosniff`; documents also carry script-disabled sandbox policy.

Watched Serve transfers the accepted configuration, live catalogue index and bundle
over private IPC before readiness. No rendered HTML or full manifest file is sent.
The child validates metadata and source freshness and binds with controls enabled.
It requires the already-resolved `publicExclude` array and uses the shared
config validator to adopt a frozen copy without prepending defaults again.
Missing, non-array or unsafe values reject the startup message.
The controls worker evaluates a compact retained runtime once, without unrelated
HTML or usage. A successful source update with an unchanged index applies its
runtime to the live child before publishing the reload event. A changed index or
reconfiguration stages the runtime for
the next child; the old child keeps its matching catalogue and controls until
shutdown. Each spawned child captures both startup IPC responses. Failed
candidates retain the old graph. Recovery receives the accepted rendering graph;
its independent source-inventory validation can still reject broken or stale inputs.

Props and saved-preview requests share an activity tracker so background rendering
pauses between documents while either is busy. Relative navigation in an edited
preview falls back to `/static/` routes; only embedded resources are copied into
its immutable bundle, not every linked page.

## Development

```sh
npm run build
node --import tsx --test tests/component_render*.test.ts tests/component_controls_*.test.ts
npx playwright test tests/browser/component_controls_runtime.spec.ts tests/browser/component_controls_forwarding.spec.ts
```

The test suite covers validation, authority, chunked size limits, immutable
resources, queue pressure/coalescing, timeouts, worker recovery, failed watched
builds, generation replacement and unchanged filesystem output. Browser checks
cover local editing, last-valid previews, optional/unset values, negative zero,
presets, variant/context changes, comparisons, expiration and navigation.

Watched no-publication tests take their version baseline only after controls and
Usage are available and Changes has reached `ready` or `unavailable`. Usage
completion precedes final Changes publication and is not a settled watch state;
`tests/helpers/component_controls_state.ts` captures the authority and version
from one terminal shell before exact no-update assertions begin.

See the [controls contract](../../../docs/protocol/mokly-component-controls.md),
[component authoring guide](../../components/README.md), and
[build architecture](../../../docs/architecture/build-pipeline.md).
