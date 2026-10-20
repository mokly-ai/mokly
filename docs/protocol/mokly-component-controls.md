# Component Controls

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Scope And User Behaviour

Saved variants work in every catalogue. Serve temporarily edits screen and
component props through the catalogue render path: HTML in Rust, JavaScript
through the [sidecar](./mokly-sidecar.md). Static `build` output shows saved
props with read-only controls and `Open this catalogue locally to edit props.`
as secondary text. Static frames add no interactive control or consumer
JavaScript runtime. The [live descriptor](./mokly-shell-delivery.md#live-descriptor)
grants this capability; an environment badge does not.

The inspector's Props tab lists controls derived from the
[entry prop schema](./mokly-entry-props.md#one-model): text for `string`, a toggle for
`boolean`, a number control for `number` and `integer` whose step is
`multipleOf` counted from zero, else 1 for `integer`, else none, and a select
for `enum` and `oneOf` of constants whose options are labelled by `title`,
else the string itself, else the JSON text of the value. A Storybook stories
file's `argTypes` enrich the derived controls as the sidecar contract states.
`defineScreen` and `defineComponent` may declare `controls` to replace the
derived ones; a declared control must name a declared prop, and optionality
and types come only from the schema. A prop whose shape has no control is
shown but not editable. The read model carries the result as `controls`.

The [generated control type](../../packages/viewer/src/generated/catalogue/ComponentControl.ts)
defines its data shape.

Controls keep their explicit declaration order. Derived controls follow schema
property order. Inferred schemas use first-seen prop order: own props first,
then variant props in variant order. Uneditable properties are omitted.
Each visual entry's detail carries that order in `controlOrder`. Saved variants
inherit it. The viewer follows the detail's order instead of sorting prop names.

Text length is a non-negative integer of Unicode code points, as the schema's
`maxLength` counts; the shell checks it itself and never uses the input's
native `maxlength`, which counts UTF-16 code units, as the limit. Number bounds
are finite, ordered, and never negative zero; `step` is finite and positive
and counts from zero, with the first offered value the smallest multiple at
or above `minimum`. A number control offers only values the schema accepts.
Select options are non-empty, have non-empty labels, and unique values the
schema accepts. A declared `step` must be a multiple of schema `multipleOf`.
It must also be integral for an `integer` prop. An incompatible step fails the
build with `component-controls`, because it would offer invalid values.
The read model stores effective number limits for declared controls. Each
bound uses the control's own value, else the schema's `minimum` or `maximum`.
Step uses the control's own value, else the schema's `multipleOf`, else 1 for
an integer, else no step. Parents and saved variants carry the same limits.
Saved props or story args outside their controls produce `props-control-bounds`
build warnings. This includes complete merged variants and Storybook hints.
The viewer accepts these saved values when they satisfy the prop schema.
The values still render. `--strict` makes the warnings fatal. Live validation
keeps the complete merged-props check so every accepted preview meets its bounds.

A control starts from the shown entry's props, that is the entry's own props or
a variant's merged props, updates the preview after validation, and has a label
from the control's `label`, else the schema `title`, else the prop name. No
invented sample value replaces a missing value; an optional prop exposes its
unset state, and `unset` removes only an optional prop. Empty text stays a
string. Reset restores the shown entry's complete props. Navigating to another
entry discards temporary edits, as does a reload. Viewport and scheme changes
keep validated edits and render them in the new context. Temporary state is
never written to a source, never encoded in a URL, local storage, a comparison,
or a Changes count, and never enters the catalogue model.

Temporary edits operate in Current. Selecting a comparison restores the saved
props and compares the base render with the current render of the saved props;
the controls are unavailable while comparing, and the product explains that the
comparison shows the saved props. A render response cannot overwrite a
comparison, another entry, another viewport or scheme, or a different page.

## Rendering Boundary

Serve exposes the private route `POST /mokly-viewer/components/render`. The
request names the entry by path and carries the view axes, the installed
revision, a page id, and the overrides. It accepts no module path, source,
callback, resource path, or renderer selection.

```ts
interface RenderRequest {
  entryPath: string; // a screen, a component, or a variant of either
  viewport: Viewport;
  colorScheme: ColorScheme;
  revision: number; // the index revision the shell installed
  pageId: string;
  overrides: Readonly<
    Record<string, { kind: "set"; value: unknown } | { kind: "unset" }>
  >;
}

interface RenderSuccess {
  renderId: string;
  revision: number;
  previewUrl: string;
  props: ComponentWireProps; // the complete validated props
  usage: CatalogueUsage; // the rendered view's usage, status "ready"
}
```

The server resolves `entryPath` against the current catalogue model, takes
the entry's schema, controls, and props, merges the overrides into those
props, and validates the complete merged props against the schema with the
profile validator, including uneditable props and control bounds; a `set`
value is JSON under the schema, and the JSON `null` value is a value, not an
unset sentinel. It then renders the entry's view through the render graph
with the merged props: the same composition, collected styles, markers, link
rewriting, document safety, and resource validation as a catalogue render,
memoized by the same fragment key, so a repeat render of saved props costs a
cache hit. Server-supplied context cannot be overridden, and no second
renderer or React resolution exists.

A successful response returns an opaque render id, the revision, a sandboxed
preview URL beneath `/mokly-viewer/components/renders/<render-id>/`, the
validated props, and the view's usage from the composed tree; render
resources resolve beneath that prefix through the same adapter as Browse.
Malformed or expired ids are rejected. The response never enters the
catalogue model, the index, a detail, or a publication.

Preview documents stay script-disabled. The shell swaps only the matching
preview frame and uses the returned usage for inspection and highlighting. No
client-side prop interpolation or arbitrary HTML execution substitutes for
the server render. A failed validation or render keeps the last valid
preview, shows an actionable error, and offers retry and reset.

Only the standalone shell that Serve delivers builds this capability; a
React host that embeds `MoklyViewer` and the static output have none, their
controls are read-only, and they open no event stream. The shell holds the
capability in one closure that performs the render request and exposes
`temporaryPreviews.render` and `temporaryPreviews.expired` through one React
context; `useViewerCapabilities()` returns them in Serve and `undefined`
elsewhere, so the token never enters the index, a detail, a URL, local
storage, or the shell store. Every call carries the current route and the
installed `deploymentId` and `revision`; a result whose values differ from
the installed ones is discarded, and navigation, a sibling-variant change, a
revision adoption, and unmount abort work in flight. A response is accepted
only when its revision equals the installed one and its view matches the
request; expiry checks cover only preview URLs the shell received. When the
index's `live.generation` changes, the shell refetches the live descriptor,
replaces the capability, and rerenders the current validated props. No
client module, host marker, or host loader is live-only: the client bundle
is the same in Serve and in the static output, and a capability is behaviour
the shell builds in the browser from Serve JSON, never catalogue data.

## Request And Lifecycle Rules

The route exists only in local Serve; the static output has no route and
makes no background request. Serve accepts JSON POST only, caps request
bodies at 64 KiB, rejects unknown fields and an invalid entry, view, or
override combination, and validates `unset` against optional controlled props.
Structured error codes for invalid input, an unknown entry, a stale revision,
a render failure, and a temporary capacity limit map to 400, 404, 409, 422,
and 429; oversized bodies return 413, unsupported methods 405, and an expired
render id 410. A render failure's typed diagnostic is written to stderr through
the reporter; the response carries a generic failure message without resource
paths or other internal detail.

When controls are active, every Serve request requires `Host` to be exactly
`localhost:<port>` or `127.0.0.1:<port>`, where `<port>` contains only decimal
digits, has no leading zero, and is between 1 and 65535 inclusive. An explicit
port is required; other hostnames, IP spellings, IPv6, whitespace, suffixes,
and userinfo are rejected. A non-loopback `Host` returns 403 for the whole
catalogue, including ordinary pages and static assets. The `Host` port need
not equal the listening port, so forwarded local ports work. Serve binds only
`127.0.0.1`; IPv6 is out of scope. Forwarded headers (`x-forwarded-*`) grant
nothing and never repair `Host`, `Origin`, or authorization.

On a render POST, `Origin` must equal `http://` plus the accepted `Host`
exactly, including its explicit port, and `X-Mokly-Render-Token` must equal the
render token. No case folding, default-port removal, trailing slash, or scheme
substitution is allowed. Preview GET and HEAD require `Host` validation and the
authenticated render id, without `Origin` or the token. The token is a random
value chosen once per server process, delivered only in the render capability of
the live descriptor v3 as `render: { url: "/mokly-viewer/components/render",
token }`, and never present in the index, a detail, a document, or consumer
frames; a new server process means a new token. There is no permissive
cross-origin access: Serve sends no CORS header on any route, so a foreign page
cannot read the descriptor or call the route, and missing or invalid
authorization returns 403. Loading a foreign web page cannot cause consumer
render code to execute through this route.

Text and number edits are debounced by 150 ms; boolean and select edits
submit immediately. The shell creates one random 32-hex `pageId` per mounted
edit owner and viewport and scheme context and keeps it until navigation or
reload, so repeated edits for one visible context coalesce while
simultaneous contexts cannot supersede each other; it is a queue key, not
authority. Each edit owner has one active request and at most one latest
queued replacement; sequence and revision checks discard stale responses.
Obsolete requests are cancelled on a newer edit, navigation, reset, entry or
context change, or disconnect, and cancellation never leaves a loading state.

Rendering runs through the render graph's scheduler outside the HTTP event
loop, with one active job per page and at most eight queued jobs server-wide;
superseded jobs from one page are coalesced. A job that passes ten seconds
fails with a render failure; a sidecar render that passes its own deadline
follows the [sidecar contract](./mokly-sidecar.md#cancellation-and-timeouts),
so a hanging consumer render cannot hang Browse or shutdown.

Preview document bundles, with usage, props, and resource bytes, live in a
process-local memory store behind opaque render ids; nothing is spilled to disk,
not to the cache directory, the OS temporary directory, or any root. Temporary
documents never enter the saved document cache, saved comparison inputs,
the watch set, or a publication. Content-addressed fragments may use the bounded
fragment cache. Reading public assets is allowed; generated asset bytes stay in
the same memory bundle as their document and are served through its render id.
At most sixteen bundles and 32 MiB of encoded document, metadata, and resource
bytes are kept; a result over the budget is rejected, and a bundle expires after
five minutes. A valid but expired id returns 410 without an unbounded expired-id
table; a malformed or foreign id returns 404. Eviction never reuses an id, and a
page may re-render its current validated props after expiry. Every memory
response uses `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and
a fixed validated MIME type.

A publication with a new revision invalidates the old revision's requests: a
request that carries an older revision returns 409, and queued work of the old
state is discarded. On a 409 the shell keeps the preview pending, refreshes the
index once unless a refresh is loading, and retries with the installed revision
after it adopts the new state, also while the event stream is down; it shows the
failure only when that retry fails. The shell checks each field and the props as
a whole before it renders, so a 400 after those checks pass shows `These values
are not valid together.` Shutdown stops admission, rejects queued work, cancels
active renders, and releases the memory store. Controls cannot delay a watched
rebuild, a publication, or a comparison generation.

## Verification

Contract tests cover every control type, derived steps and labels, optional
and unset values, unknown props, type and bound errors, malformed bodies,
request size, `Origin`, `Host`, and token validation, stale revisions, render
failure and timeout, and queue bounds. They cover both loopback names through
a different forwarded port for POST and preview reads, missing, zero,
oversized, and leading-zero ports, a non-loopback `Host` with loopback
forwarded headers, and a mismatched `Origin` or token, plus ordinary routes
with rejected non-loopback and accepted forwarded Hosts. They prove that a
repeat render uses the same renderer and React resolution as the saved props,
and that control requests create no file, Git status change, watch event, or
publication entry, including when a consumer watches its repository root.
They test bundle byte accounting, expiry and eviction, MIME types and
headers, and memory release on shutdown.

Browser tests cover prop changes, reset, variant switching, viewport and
scheme retention, rapid edits, stale responses, navigation, comparison
selection, render errors, retry, sidecar replacement, and shutdown. Static
smoke tests prove the saved props are usable and issue no render request.
The [controls mockups](./mokly-component-controls-design.md) show the states.
