# Interactive Views: Serve Delivery

## Delivery Status

Implemented as part of the
[interactive views plan](../../plans/interactive-views.md). This contract owns
the isolated interactive origin, browser bundle, diagnostics, and private
readiness transport. The [overview](./mokly-interactive-views.md) owns
configuration and eligibility; the
[Live runtime contract](./mokly-interactive-views-runtime.md) owns document
composition, mounting, renderer participation, recovery, and navigation.

## Interactive Origin

Serve opens a second HTTP listener bound to loopback only. Its default port is
the resolved Serve port plus one, advancing past occupied ports unless
`--strict-port` is set, and `--interactive-port` overrides the start. Port `0`
delegates to the operating system. A bind failure fails Serve startup and
names the attempted port. In watched Serve the HTTP child owns both listeners
because it also owns the current document service and catalogue snapshot. The
supervisor retains both resolved ports across child restarts; one shutdown
closes both listeners and their connections.

The Live generation is exactly `ComponentRuntime.generation`: 32 lowercase
hexadecimal characters. Every accepted source rebuild, reload/restart watch
action, or configuration replacement gets a new value; background completion
and recovery restart within one accepted source generation do not. A Live
document, its JSON bootstrap, and its bundle URL always use the same value.
Live document routes always select the current context; current and previous
bundle/diagnostic contexts remain while old frames unload.

The interactive origin serves exactly:

- `/static/**.html` as Live documents for eligible current-generation views;
- `/static/**` public files through the confined public reader;
- `/__mokly/interactive/<generation>/bundle.js`;
- `/__mokly/interactive/<generation>/diagnostics` (POST only);
- `/__mokly/client/inspector.js`.

Every other path, including the shell, catalogue JSON, controls, review and
comparison/upload routes, is 404. Eligible document routes accept only the
static route's redundant `variant`, `viewport`, and `scheme` selection axes,
plus zero or one `mokly-host` parameter used by the frame adapter. Unknown or
duplicate parameters, malformed axes, and a noncanonical or same-frame
`mokly-host` are 400; valid axes that identify another view are 404. Public
files accept no query. A local `mokly-host`, when supplied, must be the
canonical `http://localhost:<app-port>` or `http://127.0.0.1:<app-port>`
origin. The adapter always supplies it; omission exists for direct diagnostics
and manual requests, in which case the inspector remains inert.

Every request requires Host to be `localhost:<port>` or
`127.0.0.1:<port>` under the controls rule. If `--interactive-origin` is set,
exactly that configured authority is also accepted. This explicit authority is
the only forwarded-host grant; `x-forwarded-*` headers grant nothing. Without
an override, document `frame-ancestors` names both app spellings at the
resolved app port, so a shell opened under either name can frame Live. With an
override, Serve cannot know the forwarded shell authority, so it accepts any
canonical HTTP(S) `mokly-host` distinct from the frame and uses
`frame-ancestors http: https:`. This broader policy is enabled only by explicit
configuration; the frame adapter still pins its nonce handshake to that exact
`mokly-host`.

When a forwarding layer changes either browser-facing host names or port
numbers, callers must set `--interactive-origin`; the derived local origin,
local `mokly-host` admission, and local CSP intentionally use Serve's resolved
socket ports. Every response carries `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff`; Live documents also carry the applicable
`Content-Security-Policy`. No CORS headers are sent. The shell derives a local
frame origin from its own scheme and host name plus the descriptor port, while
an explicit descriptor origin replaces that derivation. Serve prints the
browser-facing Live origin beside its app URL.

## Diagnostics

The diagnostics POST accepts only `application/json`, at most 16,384 body
bytes, and the runtime's exact `render-error` shape. Messages are bounded to
2,048 characters and 8,192 UTF-8 bytes. Unknown view identities and extra
fields are rejected. One bounded line is written to stderr for each view and
generation, duplicates still receive 204, and the response never contains the
consumer message.

## Browser Bundle

The bundle is the same consumer graph the build loads, with the same module
resolution, React peer resolution and loaders, compiled by esbuild with
`platform: "browser"` and `format: "esm"` together with one package-owned
browser entry. It is built lazily on the first Live request per catalogue
generation, cached in memory, retained for the previous generation while
frames unload, and invalidated by every watched rebuild and configuration
change. Concurrent requests coalesce. The state is `idle`, `building`,
`ready`, or `failed`; a rejected generation is not retried, while a later
generation gets an independent attempt. Node built-ins and Node-only consumer
modules fail with one typed `interactive-bundle` diagnostic naming the
importing module; Static remains available. Builds appear as
`interactive.bundle` spans in `--debug-timings`. Bundle bytes remain in memory
and never enter the source inventory, generated output, `check`, export, or
publication.

The browser projection of the automatic development JSX runtime preserves
esbuild's `isStaticChildren` signal: its `jsxDEV` shim delegates static sibling
arrays to the consumer's `jsxs` and dynamic children to `jsx`. Ordinary static
JSX therefore does not produce missing-key diagnostics, while genuinely
unkeyed dynamic lists retain React's warning.

## Availability And Readiness

A direct Live document or bundle request returns status 503 and exactly
`{ "generation": <generation>, "state": "building" | "failed" }` while the
bundle is unavailable. Eligibility is checked first. Bundle-input failures map
to typed `failed`; internal faults return 500 and are never recategorized by
message text.

Because the app cannot read cross-origin 503 bodies, its private capability
descriptor optionally carries exactly `{ generation, port, origin?, state }`.
It is absent when `interactive` is off and never enters catalogue JSON or
export. `POST /__mokly/interactive/<generation>/prepare` exists only on the app
origin: for the current generation it starts or awaits the coalesced build and
returns the same consumer-text-free shape as 200 `ready`, 503 `failed` for an
`interactive-bundle` failure, or 500 `failed` for an internal fault; stale
generations are 404. Like component-control POSTs, it requires `Origin` to
equal `http://` plus the accepted loopback Host exactly and otherwise returns 403.

The app event stream emits private `interactive` events with the complete
descriptor on `building`, `ready`, and `failed` transitions, and includes the
current descriptor when a stream opens. The shell consumes this transport and
mounts a frame only after `ready`. For one generation, `ready` and `failed`
are final: a late `building` event cannot return a prepared generation to
preparing.

## Verification

Serve tests cover binding and shutdown, adjacent and explicit port policy,
local and forwarded Host admission, the exact route set and headers, private
descriptor transport, watched generation rollover, diagnostics, timings,
typed 503 states, 404 for ineligible entries, and bundle invalidation. Bundle
tests cover the real example graph, consumer React resolution, concurrent
coalescing, automatic JSX semantics, and typed Node-only import failures.

## Related Docs

- [Interactive views overview](./mokly-interactive-views.md)
- [Live document and browser runtime](./mokly-interactive-views-runtime.md)
- [Interactive views shell](./mokly-interactive-views-shell.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Watched development](./mokly-watch.md)
- [Diagnostic timings](./mokly-timings.md)
- [Viewer frame adapter](./mokly-frame-adapter.md)
