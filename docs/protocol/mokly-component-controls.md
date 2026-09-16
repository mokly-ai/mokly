# Component Controls

## Delivery Status

Local Serve implements temporary prop editing through the registered consumer
renderer. Published catalogues keep saved variants and read-only controls. The
[controls mockups](./mokly-component-controls-design.md) and
[component explorer plan](../../plans/component-explorer.md) describe the same
shared icon inspector and lifecycle. Forwarded loopback ports follow the
admission rule below; verification is recorded in Milestone 4 of the
[dependency patch upstreaming plan](../../plans/mokabook-dependency-patch-upstreaming.md).

## Scope And User Behavior

Saved variants work locally and in published static catalogues. Local Serve
additionally supports temporary editing of declared component props through a
server render. Arbitrary interactive controls in published catalogues would
require a browser renderer or hosted rendering service and are outside this
change. No consumer JavaScript runtime is added to static preview frames.

The Props/Controls tab in the shared component inspector lists only explicitly declared editable
props. Data props without controls remain visible in the inspector and still
participate in change detection. A control starts from the selected saved
variant's actual value, updates the preview after validation, and has a label
derived from declared metadata or the prop name. No invented sample values
replace missing values; optional fields expose their unset state.

The normative declarations below reference the required
[prop schema](./mokly-component-props.md). Unknown fields, an undeclared data
prop, or a slot key fail registration. Optionality and data types come only from
that schema; controls cannot override them. Empty text remains a string, and
unset removes only an optional prop. React slots and arbitrary JSON editors are
not live controls; complex values use schema-defined consumer preset keys.

```ts
interface ComponentControlLabel {
  label?: string;
  description?: string;
}

type ComponentControl = ComponentControlLabel &
  (
    | { kind: "text"; maxLength?: number }
    | { kind: "boolean" }
    | { kind: "number"; minimum?: number; maximum?: number; step?: number }
    | {
        kind: "select";
        options: readonly { label: string; value: PropPrimitive }[];
      }
  );
```

Text length uses nonnegative safe integers and UTF-16 code units. Number bounds
are finite, ordered, and not negative zero; step is finite and positive with
base `minimum ?? 0`. Step is a UI increment, not floating-point divisibility
validation. Select options are nonempty, have nonempty labels, and unique
primitive values accepted by the field schema; numeric options reject negative
zero for lossless schema JSON. Every saved value must satisfy its prop schema
and control limits/options. A number control still sends negative-zero inputs
losslessly through the tagged wire codec.

Reset restores the selected saved variant's complete props. Changing the saved
variant discards temporary edits. Viewport/theme changes preserve validated edits
and render them in the new context. Route navigation or reload discards edits.
Temporary state is neither written to source/generated files nor encoded as
arbitrary prop data in URLs, local storage, comparisons, or Changes counts.

Temporary edits operate in Current. Selecting a comparison restores the saved
variant and compares its committed baseline/current output; controls become
unavailable while comparing. The product explains that the comparison shows
the saved variant. Controls render responses cannot overwrite a comparison,
another variant, a new viewport/theme, or a different route.

Published pages show the same saved variants and props with controls read-only
and a secondary message, "Open this catalogue locally to edit props."
Capability comes from delivery configuration rather than an environment badge.
Users can browse, inspect, and compare the saved variants normally.

## Rendering Boundary

Serve exposes a private POST endpoint at `/__mokly/components/render`.
The request carries a component id, variant id, viewport, color scheme,
catalogue generation, page id, and a data object containing only declared control
overrides. It does not accept a module path, source code, arbitrary component
name, callback, resource path, or renderer selection.

The exact request and success-response shapes are below. The response's `view`
uses [manifest usage records](./mokly-component-manifest.md). Errors retain
the HTTP/code contract below. The token is a separate
`X-Mokly-Render-Token` header and is never stored in generated metadata.

```ts
interface ComponentRenderRequest {
  componentId: string;
  variantId: string;
  viewport: Viewport;
  colorScheme: ColorScheme;
  generation: string;
  pageId: string;
  overrides: Readonly<
    Record<
      string,
      { kind: "set"; value: ComponentWirePrimitive } | { kind: "unset" }
    >
  >;
}

interface ComponentRenderSuccess {
  renderId: string;
  generation: string;
  previewUrl: string;
  props: ComponentWireProps;
  view: ComponentViewRecord;
}
```

The parent creates one random 32-hex `pageId` per mounted component page and
retains it until navigation/reload. It is a queue-coalescing key, not authority.
The opaque generation must match the active catalogue. Decode overrides through
the shared primitive codec; validate the complete merged props against the
registration schema and control constraints, including uneditable props.

The server resolves the request against the current validated registry,
merges overrides into that variant's props, validates types/constraints, then
calls the same consumer render adapter, theme, stylesheet selection, marker,
link, resource, and ownership validation as Build. Server-supplied context and
uneditable props cannot be overridden. Optional values use an explicit unset
operation; the tagged null value remains an actual value, not an unset sentinel.

A successful response returns a typed result with an opaque render id, the
matching catalogue generation, a sandboxed preview URL, and validated usage
records. Preview URLs are confined beneath
`/__mokly/components/renders/<render-id>/`; render resources retain valid
public relative resolution through the same adapter as normal Browse. Reject
malformed or expired ids. This response never updates the committed manifest or
publishes watched changes.

Preview documents stay script-disabled. The parent shell swaps only the matching
preview frame and uses its returned usage records for inspection/highlighting.
No client-side prop interpolation or arbitrary HTML execution substitutes for
the consumer renderer. Failed validation/rendering preserves the last valid
preview, shows an actionable error, and offers retry/reset.

## Request And Lifecycle Rules

The endpoint is available only in local Serve, with no published route or
background requests in static catalogues. Accept JSON POST only, cap request
bodies at 64 KiB, reject unknown fields and invalid component/variant/view
combinations, and validate unset operations against optional controlled props.
Use structured error codes for invalid input, unknown entry, stale generation,
render failure, and temporary capacity limits. Map them to 400, 404, 409, 422,
and 429 respectively; oversized bodies return 413 and unsupported methods 405.
Worker failures carry their caught message as server-only detail, written to
stderr at the HTTP boundary; the response retains the generic preview failure
message without resource paths, exclusion causes, or other internal details.

When controls are active, every Serve request requires Host to be exactly
`localhost:<port>` or `127.0.0.1:<port>`, where `<port>` contains only decimal
digits, has no leading zero, and is between 1 and 65535 inclusive. Require an
explicit port; reject other hostnames, IP spellings, IPv6, whitespace, suffixes,
and userinfo. A non-loopback Host returns 403 for the whole catalogue, including
ordinary pages and static assets. The Host port need not equal the listening
socket port: forwarded local ports are supported. Serve binds only to
`127.0.0.1`, so `[::1]` cannot reach the socket directly and accepting it would
widen the Host surface without a working path; IPv6 support is out of scope.
Forwarded headers (`x-forwarded-*`) grant nothing; never use those headers to
repair Host, Origin, or authorization.

On render POST, Origin must equal `http://` plus the accepted Host exactly,
including its explicit port, and `X-Mokly-Render-Token` must match the shell-issued
unpredictable token. No case folding, default-port removal, trailing slash, or
scheme substitution is allowed for this comparison. Preview GET/HEAD requires
Host validation and the authenticated render id, without requiring Origin or the
POST token. The token is scoped to the server instance and unavailable to consumer
frames. There is no permissive CORS; missing or invalid required authorization
returns 403. Loading a foreign web page must not cause consumer render code to
execute through this endpoint.

Text/number edits are debounced by 150 ms; boolean/select edits submit
immediately. Each page has one active request and at most one latest queued
replacement. Sequence/generation checks discard stale responses. Cancel
obsolete requests on navigation, reset, variant/context change, or disconnect;
cancellation must not leave an unresolved UI loading state.

Run bounded rendering outside the main HTTP event loop using the same compiled
consumer graph in a supervised worker. Allow one active job and at most eight
queued jobs server-wide; superseded jobs from the same page are coalesced.
Terminate a job after ten seconds and return render failure, replacing the
worker before accepting more work. This makes synchronous consumer render
failures unable to hang Browse or shutdown. No second independently configured
renderer or React resolution graph is permitted.

Keep transient HTML, usage/props metadata, and generated style/resource bytes
only in a process-local memory store behind opaque render ids. Mokly never
spills these artifacts to disk, including `.context`, the OS temporary directory,
or any source/output root. They never enter a manifest, Check/orphan transaction,
Git changed-path calculation, watch event stream, or publication inventory.
Reading existing validated public assets is allowed; generated asset bytes stay
in the same memory bundle as their document and are served through its render id.

Retain at most sixteen render bundles and 32 MiB total encoded document, metadata,
and resource bytes. Reject a result exceeding the budget and expire bundles after
five minutes. Ids are server-authenticated opaque tokens; a valid but no-longer
retained id returns 410 without an unbounded expired-id table. Malformed/foreign
ids return 404. Eviction never overwrites an id, and a page may rerender its
current validated props after expiration. Every memory response uses no-store
and nosniff headers and a fixed validated MIME type, preserving frame sandboxing.

Watched registry/config replacement invalidates the old generation, stops or
discards its queued work, and only swaps to a fully validated replacement graph.
When the catalogue index is unchanged, apply the new runtime to the live child before
publishing the update. A changed index or reconfiguration stages it for the
next child, leaving the old catalogue and its controls paired through shutdown.
Capture the startup runtime when spawning, so later staging cannot change either
IPC response. Before readiness, the child requests that runtime's accepted
serializable config, validated live index and retained renderer, constructs the
catalogue and binds with controls enabled. No generated HTML or full rendered
manifest is transferred. The worker evaluates the retained graph once, validates
only the requested edited view, and captures its resource closure; it never clones
the full rendered catalogue. Navigation-only destinations need no resource copy.
Props and document requests jointly pause background rendering between documents.
Failed index candidates retain the last-good registry/renderer and its controls.
Server shutdown stops admission, rejects queued work, terminates the worker,
and cleans transient artifacts. Controls cannot delay ordinary catalogue
watch/reload or comparison generation indefinitely.

## Verification

Add contract tests for every control type, optional/unset values, unknown props,
type/constraint errors, preset resolution, malformed bodies, request size,
origin/Host/token validation, old generations, worker failure/timeout, and queue
bounds. Cover both loopback names through a different forwarded port for POST
and preview reads, missing/zero/oversized/leading-zero ports, non-loopback Host
with loopback forwarded headers, and mismatched Origin or token. Cover ordinary
catalogue routes with rejected non-loopback and accepted forwarded Hosts.
Prove repeat renders use the same consumer providers and React runtime
resolution as saved variants and never mutate generated output. Assert that
control requests create no filesystem output, Git status change, watch event,
rebuild/reload notification, Check orphan, or publication entry, including when
a consumer explicitly watches its repository root. Test aggregate bundle byte
accounting, expiration/eviction, MIME/headers, and memory release on shutdown.

Browser tests cover actual prop changes, reset, variant switching, viewport/theme
retention, rapid edits, stale responses, navigation, comparison selection,
render errors, retry, worker replacement, and shutdown. Published smoke tests
prove saved variants remain usable and issue no local-render requests.
Update mobile and desktop controls mockups before implementing these controls.
