# Interactive Browser Runtime

This directory prepares Live preview documents without changing Mokly's static
build artifacts. It owns the browser bundle and runtime plus Serve's isolated
Live listener. The shell control is a separate delivery milestone.

## Responsibilities

- Compile the consumer's ordinary entry graph plus Mokly's browser entry as an
  ESM bundle with the configured aliases, conditions, loaders, package roots,
  extensions, and consumer-owned React peers.
- Cache one in-flight or completed bundle per catalogue generation, retaining
  only the current and previous generations and allowing explicit invalidation.
- Turn a Browse-adapted static document into a Live document by adding only the
  canonical bootstrap and package scripts inside `head`.
- Rebuild the selected screen or saved component variant in the browser and
  synchronously mount a fresh root on `document.body` after static first paint.
- Preserve host-owned catalogue navigation through a validated Live identity
  event and the existing frame-adapter transport.
- Bind a second loopback listener, enforce its exact route and Host policies,
  and coordinate current/previous generation state with Serve.
- Validate bounded browser diagnostics and expose consumer-text-free readiness
  through the app origin's private capability channel.

## Boundaries

`bundle.ts` defines `InteractiveBundler` and its injected compiler boundary.
The esbuild implementation rejects Node built-ins with an
`interactive-bundle` error naming the importing module. Browser compilation is
never called by Build, Check, Export, or Publish. A rejected build remains
cached for its generation until explicit invalidation; a later generation gets
an independent attempt.

`document.ts` accepts only a document already processed by
`adaptBrowseDocument`. It validates without rewriting that adapter's inert map,
emits no props or source paths in the bootstrap, escapes canonical JSON for an
inline script, requires the metadata and sole inspector script to remain inside
the explicit head, and preserves every byte from the body start onward.
`InteractiveViewEligibilityError` exposes typed entry/kind/variant reasons for
the 404 boundary; malformed composition inputs are internal document errors,
not `interactive-bundle` failures. `server_static.ts` refuses ineligible views
before bundle preparation and composes only the current generation's ordinary
on-demand document.

`runtime/` strictly validates the bootstrap, configures the route table, finds
the bundled registry entry, and mounts with React's `createRoot` inside
`flushSync`. Component roots use their saved complete props; registered
components inside any Live tree use the non-recording component context. The
optional renderer `interactive` export wraps the node in consumer providers.

Render failures reach an injectable `InteractiveDiagnosticReporter`. The
default implementation logs locally and posts a bounded `render-error` payload
to the generation-scoped diagnostics path. Pre-root validation failures leave
the static body untouched. An uncaught root error reports once, unmounts, and
restores the retained original child nodes without duplicating body styles or
scripts; caught errors leave the consumer boundary result in place. The endpoint
strictly validates 16 KiB of JSON and logs one line per view and generation.

## Serve Origin

`server.ts` defines `InteractiveServer` and its factory boundary. The watched
HTTP child owns this listener because it already owns the current catalogue,
document service, and runtime. `server_router.ts` admits only Live documents,
confined public files, retained generation bundles and diagnostics, and the
inspector. All responses are uncached and `nosniff`; documents also restrict
frame ancestors. No route sends CORS headers.

Local Hosts use the controls listener's exact loopback rule. An explicit
browser-facing origin adds only its exact authority. Forwarded headers grant
nothing. Default CSP names both loopback app spellings; explicit forwarding
uses the documented HTTP(S) ancestor policy because the forwarded shell origin
is unknown. Forwarded host names or port numbers therefore require an explicit
origin. The frame adapter's optional request parameter is separately validated
as a canonical origin distinct from the frame.

`bundle_state.ts` tracks `idle`, `building`, `ready`, or `failed`, coalesces one
timed build, and retains one predecessor. Typed `interactive-bundle` failures
become consumer-text-free 503 responses; internal faults remain 500. The app
origin owns the current-generation preparation POST and private descriptor/SSE
transport, so the future shell can wait for readiness without reading a
cross-origin response. That POST follows the component-control rule: its Origin
must be exactly `http://` plus the accepted loopback Host.

## Navigation

The bootstrap route table resolves every routable id from the accepted
generation's manifest and maps it to only its portable href, without the
inspector map's 1,024-link limit. Parity tests pin those manifest routes to the
authored-entry Build resolver. Native `MockLink`, `MockLink asChild`, and
resolved raw `mock:` anchors
prevent unmodified primary activation and emit `mokly:interactive-navigation`
with `{ id, fragment?, target }`. The inspector strictly validates that logical
identity and sends the unchanged frame navigation protocol; the host remains
the authority for catalogue destinations. Modified and middle activation keeps
native behavior on the resolved href.

## Development

```sh
npm run build
node --import tsx --test tests/interactive_*.test.ts tests/client_interactive_capability.test.ts
npx playwright test tests/browser/interactive.spec.ts
npm run package:check
```

See the [Interactive Views contract](../../docs/protocol/mokly-interactive-views.md),
[rendering contract](../../docs/protocol/mokly-rendering.md), and
[frame adapter](../../docs/protocol/mokly-frame-adapter.md).
