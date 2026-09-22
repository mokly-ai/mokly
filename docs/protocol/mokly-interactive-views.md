# Interactive Views

## Delivery Status

Approved target tracked by the [interactive views plan](../../plans/interactive-views.md).
Milestone 1 defines this contract; later milestones implement the browser
bundle, the interactive origin in Serve, and the Static/Live control in the
shell. Until they land, every catalogue behaves as `interactive: "off"`.

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
as `--port`. The origin is a canonical serialized HTTP(S) origin with no path,
query, fragment or userinfo.

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

A Live document for a view is the exact static document the ordinary build
path compiles for that view, with three additions inside `<head>` and no change
to `<body>` bytes:

1. one `<script type="application/json" data-mokly-interactive>` bootstrap;
2. one classic `<script src="/__mokly/client/inspector.js">`;
3. one `<script type="module" src="/__mokly/interactive/<generation>/bundle.js">`.

The bootstrap is canonical JSON with inline-script escapes containing the entry
id, entry kind, optional variant id, viewport, color scheme, the catalogue
generation, and the route table: a map from every logical `mock:<id>` value
resolvable from this view to its portable relative href for the same viewport
and scheme, computed by the same resolver the build uses. The bootstrap
contains no props, no source paths and no repository paths.

Sentinels, range markers and adapted `MockLink` controls are produced by the
static path and remain in the body unchanged. The document is served with
`Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and a
`Content-Security-Policy` whose `frame-ancestors` names the app origin only.

## Hydration Contract

The browser runtime reads the bootstrap, locates the entry and optional
variant in the bundled registry, builds the React node for the view, and
hydrates `document.body`. Screens hydrate their authored `mobile` or `desktop`
node. Components call the registered `render` adapter with the saved variant's
complete props and `{ viewport, colorScheme }`.

In the browser, the component wrapper validates props as on the server but
records nothing and emits no sentinels; Review-ignore and material sentinels
also render nothing. React 19 skips comment nodes during hydration, so the
existing comment markers do not cause mismatches. Adapted `MockLink` controls
render as the same anchor element the build produced, from the same route
table, so their element and attributes match.

A hydration mismatch is recoverable: React falls back to client rendering for
the affected subtree, the runtime reports a `hydration-mismatch` diagnostic
through `onRecoverableError`, and the view remains usable. The runtime posts
the diagnostic to the interactive origin at
`POST /__mokly/interactive/<generation>/diagnostics` as JSON limited to the
entry id, view identity and a bounded message; Serve logs it to stderr once
per view and generation. No consumer text enters the shell.

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

It receives the pure subset of `RenderInput` and returns the node to hydrate,
which lets the consumer wrap Live views in the same providers `render` uses.
When absent, the runtime hydrates `node` directly, which matches the default
renderer. The consumer keeps `render` and `interactive` structurally
equivalent; a mismatch is reported as above, not masked. Styles that the
server renderer injects into `<head>` at render time, such as collected React
Native Web rules, remain in the static head; the Live runtime does not inject
a second copy, and a component that creates new rules at runtime relies on the
consumer's client-side style injection.

### Browser MockLink behaviour

Every `MockLink` and `mockLink` value resolves through the bootstrap route
table to the same portable href the build emitted. Primary activation is
intercepted and reported to the shell as a frame-adapter navigation event; the
frame never navigates itself. Modified and middle activation keep native link
behaviour within the frame sandbox, which forbids top navigation and popups.
An id absent from the route table renders an inert link and reports nothing.

## Interactive Origin

Serve opens a second HTTP listener bound to loopback only. Its default port is
the resolved Serve port plus one, advancing past occupied ports unless
`--strict-port` is set, and `--interactive-port` overrides the start. Port `0`
delegates to the operating system. The shell derives the frame origin from its
own scheme and host name plus the announced port; `--interactive-origin`
replaces that derivation for forwarded environments where the browser reaches
the second listener through another host name. Serve prints the interactive
origin beside its URL and announces it in the private capability descriptor,
never in the public catalogue.

The interactive origin serves exactly:

- `/static/**.html` as Live documents for eligible current-generation views;
- `/static/**` public files through the confined public reader;
- `/__mokly/interactive/<generation>/bundle.js`;
- `/__mokly/interactive/<generation>/diagnostics` (POST only);
- `/__mokly/client/inspector.js`.

Every other path, including the shell, catalogue JSON, controls, review and
upload routes, is 404. Requests require Host to be `localhost:<port>` or
`127.0.0.1:<port>` under the same rule as component controls; forwarded
headers grant nothing. Responses are `no-store` and `nosniff`. No
cross-origin resource sharing headers are sent: the shell talks to a Live
frame only through `postMessage`, and a Live frame fetches only its own
origin.

## Browser Bundle

The bundle is the same consumer graph the build loads, with the same module
resolution, React peer resolution and loaders, compiled by esbuild with
`platform: "browser"` and `format: "esm"` together with one package-owned
browser entry. It is built lazily on the first Live request per catalogue
generation, cached in memory, retained for the previous generation while
frames unload, and invalidated by every watched rebuild and configuration
change. Node built-ins and Node-only consumer modules fail the bundle with a
typed `interactive-bundle` diagnostic naming the importing module; Static
remains available. The bundle is served only from the interactive origin and
is excluded from the source inventory, generated output, `check` and export.

## Shell Behaviour

The view toolbar shows a Static/Live segmented control beside the viewport and
scheme controls when the private descriptor carries an interactive origin and
the entry offers Live. The selection persists in memory like viewport and
scheme, and is discarded on reload. Static frames mount exactly as today. Live
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

| State                | Cause                                 | Behaviour                                      |
| -------------------- | ------------------------------------- | ---------------------------------------------- |
| `interactive-bundle` | Node-only import or esbuild failure   | 503 on Live documents; diagnostic to stderr    |
| Origin unavailable   | Second listener cannot bind           | Serve fails to start, naming the port          |
| Hydration mismatch   | `render`/`interactive` disagreement   | Client render; one stderr line per view        |
| Entry opted out      | `interactive: false`                  | 404 on the interactive origin; control hidden  |
| Generation replaced  | Watched rebuild during a Live session | Frame reloads through the ordinary update path |

## Verification

Unit tests cover config and per-entry validation, bundle failure diagnostics,
document composition leaving body bytes unchanged, and route-table resolution.
Serve tests cover origin binding, Host refusal, the exact route set, 503 during
a build and 404 for opted-out entries. Browser tests hydrate a stateful control,
assert no mismatch diagnostic, follow a catalogue link from a Live frame, and
prove export contains no bundle, bootstrap or React beyond the shell's own.

## Related Docs

- [Configuration contract](./mokly-configuration.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Component controls](./mokly-component-controls.md)
- [Interactive views design](./mokly-interactive-views-design.md)
