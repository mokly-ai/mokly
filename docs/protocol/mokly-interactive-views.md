# Interactive Views

## Delivery Status

Tracked by the [interactive views plan](../../plans/interactive-views.md).
Milestones 1–4 implement the contract, browser runtime, isolated Serve origin,
lazy bundle state, and private shell transport. The Static/Live shell control
remains Milestone 5, so Serve still presents Static even when its Live backend
is enabled.

## Purpose

A Static view is today's script-free document in a sandboxed frame. A Live
view runs the same React tree in the browser so controls respond, menus open
and local state works. Live changes only what the user sees and touches in
local Serve. Comparisons, Changes, `check`, export and publication keep using
the static HTML bytes produced by the ordinary build path. The browser bundle,
its bootstrap and the interactive origin are never material: they do not enter
`mockupsDir`, the manifest, Changes, derived baselines, export or publication.

Product copy says Static and Live. Code, configuration and documents say
`interactive`, because `live` already names the last-good routing runtime and
live evidence.

## Configuration

```ts
interface MoklyConfig {
  interactive?: "off" | "serve"; // "off"
}
```

`off` is the default. No browser bundle is built, no interactive origin opens,
and the shell shows no Static/Live control. `serve` enables Live in local Serve
only. Export and publication never bundle consumer JavaScript; a later contract
may add an `export` value. Unknown strings are config errors. `check`, `build`,
export and publication ignore the option in every mode and emit identical bytes
whether it is `off` or `serve`.

Serve accepts `--interactive-port <port>` and `--interactive-origin <origin>`;
both are rejected on other commands, and both are rejected when the resolved
config is `off`. The port follows the same integer range and assignment rules
as `--port`. Without an override, Live starts at the resolved app port plus one;
when the app has port 65535, Live delegates to an OS-selected port instead.
That delegation also applies under `--strict-port` because no adjacent port can
be requested. The origin is a canonical serialized HTTP(S) origin with no path,
query, fragment or userinfo. `--strict-port` applies to both Serve listeners.

### Per-entry opt-out

`defineScreen`, `defineComponent`, and nested `screen` inputs accept
`interactive?: false`. Declaring `true` or any other value is rejected, so the
field can only remove Live from one entry. Screen variants inherit the parent's
value unless they declare their own. Collections, pages and use cases reject
the field. An opted-out entry shows no Static/Live control and refuses Live
document requests with 404 on the interactive origin. The catalogue index
carries the resolved value so the shell can hide the control without reading
source.

## Views That Offer Live

- Screen fragments: each mobile or desktop fragment in every configured scheme.
- Component saved variants: each variant view in every viewport and scheme.

These never offer Live: pages, use-case steps, comparison panes, removed
previous versions, and transient control previews. Each is either a complete
consumer document, a baseline-pinned document, or already a server render.

## Live Document Composition

A Live document starts from the exact static document the ordinary build path
compiles for that view. The interactive origin first applies the Browse adapter,
then composition leaves every byte from `<body` onward unchanged. The complete
Live head contains these three scripts:

1. one `<script type="application/json" data-mokly-interactive>` bootstrap;
2. one classic `<script src="/__mokly/client/inspector.js">`;
3. one `<script type="module" src="/__mokly/interactive/<generation>/bundle.js">`.

The bootstrap is canonical JSON with inline-script escapes containing the entry
id, entry kind, optional variant id, viewport, color scheme, the catalogue
generation, and the route table: a map from every logical `mock:<id>` value
resolvable from this view to its portable relative href for the same viewport
and scheme. Shipped Serve resolves this table only from the accepted
generation's manifest fragment routes; parity tests pin those materialized
routes to the ordinary authored-entry Build resolver across every source view.
Routes contain no inspector index and are not subject to the static metadata
map's 1,024-link limit. The bootstrap contains no props, source paths or
repository paths.

Before composition, the interactive origin must pass the ordinary compiled
document through the Browse document adapter. That layer authenticates the
ownership header, links and component ranges and adds the inert inspector map;
the composer validates but never augments or rewrites that map. The map and
sole inspector script must be inside the explicit head. The composer inserts
the bootstrap and module script adjacent to that adapter-owned inspector script.
A component bootstrap must name one of the entry's saved variants. Sentinels,
range markers and statically adapted `MockLink` controls remain byte-identical
in the pre-mount body. Eligibility failures are
`InteractiveViewEligibilityError` values with a typed reason of
`unknown-entry`, `not-live-kind`, `opted-out`, `missing-variant`,
`unknown-variant` or `unexpected-variant`; the server maps each one to 404
before starting a bundle. Invalid generations or malformed adapted documents
are internal composition failures, never `interactive-bundle` failures. Live
documents carry the response policy defined under Interactive Origin.

## Mount Contract

The browser runtime reads the bootstrap, locates the entry and optional
variant in the bundled registry, and builds the React node for the view.
Screens use their authored `mobile` or `desktop` node. Components call the
registered `render` adapter with the saved variant's complete props and
`{ viewport, colorScheme }`.

In the browser, the component wrapper validates props as on the server but
records nothing and emits no sentinels; Review-ignore and material sentinels
also render nothing. The ordinary static bytes paint first. The runtime then
calls `createRoot(document.body, { onCaughtError, onUncaughtError })` and renders
inside `flushSync`, replacing the static body children, range comments, Review
sentinels and statically adapted controls in one task. React keeps the body
element and its attributes, and the static head remains untouched.

Before creating the root, the runtime retains the original body child-node
objects. An uncaught root error reports once, then queues one idempotent recovery:
it disposes Live-link handling, unmounts the failed root and calls
`body.replaceChildren(...staticChildren)`. Reusing the original objects moves
any React-retained body `style`, `script` or stylesheet nodes into their original
positions instead of duplicating them. The Browse adapter's static link indices
therefore work again through the inspector. A caught error reports once but lets
the consumer error boundary own its rendered result. Strict bootstrap, registry,
entry and variant validation occurs before `createRoot`; failure reports once,
rethrows, and leaves the static document untouched.

The diagnostic is a bounded `render-error`. The default reporter logs the
failure in the frame and posts it to the interactive origin at
`POST /__mokly/interactive/<generation>/diagnostics` as JSON limited to the
validated view identity and a bounded message. A failure before valid bootstrap
identity has only `code` and `message`; the reporter derives a safe endpoint
generation from the package module URL. If neither source yields a valid
generation it logs locally without inventing an endpoint. The reporter is
injectable so runtime tests do not require HTTP. Serve strictly validates and
logs the payload once per view and generation. No consumer text enters the
shell.

### Renderer participation

The configured renderer module may export a second function:

```ts
interface InteractiveRenderInput {
  colorScheme: ColorScheme;
  entry: ScreenDefinition | ComponentDefinition;
  variantId?: string;
  componentProps?: Readonly<Record<string, unknown>>;
  node: ReactNode;
  viewport: Viewport;
}

export function interactive(input: InteractiveRenderInput): ReactNode;
```

It receives the pure subset of `RenderInput` and returns the node to mount,
which lets the consumer wrap Live views in the same providers `render` uses.
When absent, the runtime mounts `node` directly, which matches the default
renderer. The consumer keeps `render` and `interactive` visually equivalent at
their initial state. A render failure is reported as above, not masked. Styles that the
server renderer injects into `<head>` at render time, such as collected React
Native Web rules, remain in the static head; the Live runtime does not inject
a second copy, and a component that creates new rules at runtime relies on the
consumer's client-side style injection.

### Browser MockLink behaviour

Every `MockLink` and complete logical value produced by `mockLink` resolves
through the bootstrap route table to the same portable href the build emitted.
Native `MockLink`, `MockLink asChild`, and a delegated handler for resolved raw
`mock:` anchors own unmodified primary activation. They prevent the native click
and dispatch the package-owned `mokly:interactive-navigation` DOM event with the
exact logical identity `{ id, fragment?, target }`. The inspector accepts only a
plain object with the existing bounded id, fragment and target grammars and no
extra fields, then emits the unchanged frame-adapter `navigation` message with
`activation: "primary"`. The event never carries an href, label or arbitrary URL.
Consumer JavaScript can synthesize this in-frame event, so it is a validation
boundary rather than an authentication boundary; the nonce/origin handshake and
the host's independent catalogue destination validation remain authoritative.

Primary activation is prevented before the frame can navigate, even without a
host subscription. Modified and middle activation dispatch no Live event and
keep native behaviour on the resolved portable href within the frame sandbox,
which forbids top navigation and popups. An id absent from the route table
renders inert and reports nothing. Valid fragments and browsing targets are
carried as logical identity only; neither layer trusts the portable href as the
host destination.

## Interactive Origin

Serve opens a second HTTP listener bound to loopback only. Its default port is
the resolved Serve port plus one, advancing past occupied ports unless
`--strict-port` is set, and `--interactive-port` overrides the start. Port `0`
delegates to the operating system. A bind failure fails Serve startup and names
the attempted port. In watched Serve the HTTP child owns both listeners because
it also owns the current document service and catalogue snapshot. The
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
an override, document `frame-ancestors` names both app spellings at the resolved
app port, so a shell opened under either name can frame Live. With an override,
Serve cannot know the forwarded shell authority, so it accepts any canonical
HTTP(S) `mokly-host` distinct from the frame and uses `frame-ancestors http:
https:`. This broader policy is enabled only by explicit configuration; the
frame adapter still pins its nonce handshake to that exact `mokly-host`.
When a forwarding layer changes either browser-facing host names or port
numbers, callers must set `--interactive-origin`; the derived local origin,
local `mokly-host` admission, and local CSP intentionally use Serve's resolved
socket ports.

Every response carries `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff`; Live documents also carry the applicable
`Content-Security-Policy`. No CORS headers are sent. The shell derives a local
frame origin from its own scheme and host name plus the descriptor port, while
an explicit descriptor origin replaces that derivation. Serve prints the
browser-facing Live origin beside its app URL.

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
change. Concurrent requests coalesce. The state is `idle`, `building`, `ready`,
or `failed`; a rejected generation is not retried, while a later generation
gets an independent attempt. Node built-ins and Node-only consumer modules fail
with one typed `interactive-bundle` diagnostic naming the importing module;
Static remains available. Builds appear as `interactive.bundle` spans in
`--debug-timings`. Bundle bytes remain in memory and never enter the source
inventory, generated output, `check`, export, or publication.

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
generations are 404. Like component-control POSTs, it requires `Origin` to equal
`http://` plus the accepted loopback Host exactly and otherwise returns 403.
The app event stream emits private `interactive` events with the complete
descriptor on `building`, `ready`, and `failed` transitions, and includes the
current descriptor when a stream opens. Milestone 5 consumes this transport
and mounts a frame only after `ready`.

## Shell Behaviour

The view toolbar shows a Static/Live segmented control after the viewport
control when the private descriptor carries an interactive origin and the
entry offers Live. The standalone top-bar Appearance selector remains the only
color-scheme control. Preview mode persists across view changes in the current
document and is discarded on reload. Static frames mount exactly as today. Live
frames mount through the cross-origin adapter with `sandbox="allow-same-origin
allow-scripts"` on the interactive origin, and supply pending usage, so they
subscribe to navigation only. Highlight, pick and controls stay Static-only;
while Live is selected, the inspector's Props/Controls and Usage tabs state
"Switch to Static to inspect or edit this view." Switching to Live with unsaved
prop edits discards them, exactly as changing the saved variant does; the
control is not disabled.

Preparing: while the bundle builds, the frame area shows the bundle
preparation state with Static still selectable. Unavailable: after a bundle
failure, opted-out entries, or an unreachable origin, the control shows Live
as unavailable with Static selected; the reason is diagnostic detail, not
shell copy.

## Failure States

| State                      | Cause                                       | Behaviour                                            |
| -------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| `interactive-bundle`       | Node-only import or esbuild failure         | 503 on Live documents; failure cached for generation |
| View ineligible            | Typed entry/kind/variant eligibility reason | 404 on the interactive origin                        |
| Composition fault          | Invalid generation or adapted document      | 500; never presented as a bundle-input problem       |
| Pre-mount failure          | Invalid bootstrap or missing registry view  | Static document untouched; one diagnostic            |
| Uncaught Live render error | Consumer render throws in the root          | Static document restored; one diagnostic             |
| Caught Live render error   | Consumer error boundary catches             | Boundary result retained; one diagnostic             |
| Origin unavailable         | Second listener cannot bind                 | Serve fails to start, naming the port                |
| Generation replaced        | Watched rebuild during a Live session       | Frame reloads through the ordinary update path       |

## Verification

Unit tests cover config and per-entry validation, bundle failure diagnostics,
document composition leaving body bytes unchanged, typed eligibility reasons,
route-table resolution beyond 1,024 entries, and compacted opt-outs.
Serve tests cover binding and shutdown, port policy, local and explicit Host
admission, the exact route set and headers, private descriptor transport,
watched generation rollover, diagnostics, timing, typed 503 states, and 404 for
ineligible entries. A real-Serve browser test mounts a stateful control through
the frame adapter and observes navigation with no diagnostic. Other browser
tests cover render recovery, and export tests prove private Live material is
absent.

## Related Docs

- [Configuration contract](./mokly-configuration.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Component controls](./mokly-component-controls.md)
- [Interactive views design](./mokly-interactive-views-design.md)
