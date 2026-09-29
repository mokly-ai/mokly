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

The bundle is the browser projection of the same accepted consumer graph, with
the same configured aliases, conditions, loaders, package roots, extensions,
React peer resolution, and one package-owned browser entry. Esbuild uses
`platform: "browser"` and `format: "esm"`. It is built lazily on the first Live
request per catalogue generation, cached in memory, and retained with one
predecessor while frames unload. Concurrent requests coalesce. The state is
`idle`, `building`, `ready`, or `failed`; a rejected generation is not retried,
while a later generation gets an independent attempt. Node built-ins and
Node-only consumer modules fail with one typed `interactive-bundle` diagnostic
naming the importing module; Static remains available. Builds appear as
`interactive.bundle` spans in `--debug-timings`. Bundle bytes remain in memory
and never enter the source inventory, generated output, `check`, export, or
publication.

### Generation-pinned repository sources

When Serve resolves `interactive: "serve"`, the Node consumer-graph build
captures the exact bytes returned for every repository-owned file input before
tree shaking. The capture uses the source-inventory ownership rule: entry,
renderer, transformer, local helper, JSON, and configured-loader inputs are
included; Mokly runtime files and installed-package files are not. Logical and
physical in-repository aliases address the same immutable blob. Capture occurs
in the same load that produces the accepted graph, never in a second disk pass,
and is sealed only after graph evaluation and registry/index validation
succeed. A capture failure rejects that candidate generation.

`ComponentRuntime.interactiveSources` carries the decoded capture. The existing
runtime IPC message carries its exact wire projection:

```ts
interface InteractiveSourceCaptureMessage {
  files: readonly {
    bytes: string; // canonical padded RFC 4648 base64
    paths: readonly string[];
  }[];
}
```

Every path is a safe repository-relative POSIX path. Paths within a blob and
blobs by their first path are strictly sorted; both are nonempty; no path
occurs twice. The child validates the exact shape, canonical base64, and paths
before exposing the runtime. With `interactive: "serve"` the field is required;
with `interactive: "off"` it is absent. Build, Check, export, publication, and
an off Serve neither install the capture hook nor retain or transfer source
bytes.

The browser compiler uses the accepted `config.entryModules`; it never runs
entry discovery again. Relative, absolute, or aliased resolution that lands in
the repository can read only the capture, including extension and index-file
selection. It never probes repository-owned module or loader-input files to
fill a miss, so creating, editing, deleting, renaming, or breaking one after
acceptance cannot change or fail that generation's Live bundle. Bare
installed-package imports, their package-relative files, Mokly's runtime, and
consumer React peers continue to resolve normally from the configured package
roots and are deliberately not pinned. Resolution-only repository inputs that
esbuild reads outside module loading—such as `tsconfig.json` path, base URL, or
JSX settings and repository-package `package.json` imports, exports, or browser
fields—are not captured and are reread from disk by the lazy browser build, so
an edit after acceptance can make Live resolve differently or fail until the
next accepted generation; module and loader-input bytes remain pinned.

If browser-specific resolution requests a repository-owned module absent from
the accepted capture, compilation fails with typed code `interactive-bundle`,
typed reason `source-not-captured`, and repository-relative `module` and
optional `importer` fields. Its terminal message is
`accepted Live sources do not contain <module>` followed by
` (imported by <importer>)` when known. Classification uses the typed reason,
never message matching. The generation enters the ordinary cached `failed`
Live state and returns its existing consumer-text-free 503; its Static
documents and the watched rebuild status remain successful.

The interactive child retains captures for exactly its current and immediately
previous generations and evicts a capture with that generation's bundle state
when a third arrives. Reload/restart generations reuse the same capture object;
distinct generation records do not copy it. Eviction aborts an obsolete
in-flight compiler and releases its capture after the request settles. The
supervisor retains only the current capture needed to recover a child. If `Sg`
is the sum of distinct decoded blobs for generation `g`, steady retained raw
bytes are bounded by `Scurrent + Sprevious` in the child and `Scurrent` in the
parent; candidate preparation adds only its candidate capture. IPC adds one
transient base64 projection totaling `sum(4 * ceil(Sfile / 3))` bytes plus path
and JSON metadata linear in the captured inputs, discarded after decoding.
There is no lower arbitrary byte ceiling: the accepted consumer input itself
defines `Sg`, while generation count and copies remain bounded as above.

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
Pinned-source tests accept generation G, then edit, delete, and syntactically
break a source before G's first Live request and require byte-identical bundle
output from G; a later accepted generation must see the edit. Tests also cover
entry-discovery pinning, symlink retargeting, installed-package resolution, a
typed missing-capture failure that leaves Static available, strict IPC
validation, reuse and eviction, complete absence when interactive is off, and
the documented resolution-metadata limitation.

## Related Docs

- [Interactive views overview](./mokly-interactive-views.md)
- [Live document and browser runtime](./mokly-interactive-views-runtime.md)
- [Interactive views shell](./mokly-interactive-views-shell.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Watched development](./mokly-watch.md)
- [Diagnostic timings](./mokly-timings.md)
- [Viewer frame adapter](./mokly-frame-adapter.md)
