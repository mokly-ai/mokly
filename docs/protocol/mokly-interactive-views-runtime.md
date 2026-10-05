# Interactive Views: Live Runtime

## Delivery Status

Implemented as part of the
[interactive views plan](../../plans/interactive-views.md). This contract owns
Live document composition, browser mounting, renderer participation, render
recovery, and in-frame catalogue navigation. The
[overview](./mokly-interactive-views.md) owns configuration and eligibility;
the [Serve delivery contract](./mokly-interactive-views-serve.md) owns the
origin, bundle, diagnostics endpoint, and readiness transport.

## Live Document Composition

A Live document starts from the exact static document the ordinary build path
compiles for that view. The interactive origin first applies the Browse
adapter, then composition leaves every byte from `<body` onward unchanged. The
complete Live head contains these three scripts:

1. one `<script type="application/json" data-mokly-interactive>` bootstrap;
2. one classic `<script src="/__mokly/client/inspector.js">`;
3. one `<script type="module" src="/__mokly/interactive/<generation>/bundle.js">`.

The bootstrap is canonical JSON with inline-script escapes containing the
entry path, entry kind, optional variant path, viewport, color scheme, the
catalogue generation, and the route table: a map from every logical
`mock:<path>` value resolvable from this view to its portable relative href for
the same viewport and scheme. Shipped Serve resolves this table only from the
accepted generation's manifest fragment routes; parity tests pin those
materialized routes to the ordinary authored-entry Build resolver across every
source view. Routes contain no inspector index and are not subject to the
static metadata map's 1,024-link limit. The bootstrap contains no props,
source paths or repository paths.

Before composition, the interactive origin must pass the ordinary compiled
document through the Browse document adapter. That layer authenticates the
ownership header, links and component ranges and adds the inert inspector map;
the composer validates but never augments or rewrites that map. The map and
sole inspector script must be inside the explicit head. The composer inserts
the bootstrap and module script adjacent to that adapter-owned inspector
script. A component bootstrap must name one of the entry's saved variants.
Sentinels, range markers and statically adapted `MockLink` controls remain
byte-identical in the pre-mount body.

Eligibility failures are `InteractiveViewEligibilityError` values with a
typed reason of `unknown-entry`, `not-live-kind`, `opted-out`,
`missing-variant`, `unknown-variant` or `unexpected-variant`; the server maps
each one to 404 before starting a bundle. Invalid generations or malformed
adapted documents are internal composition failures, never
`interactive-bundle` failures. Live documents carry the response policy in the
[interactive-origin contract](./mokly-interactive-views-serve.md#interactive-origin).

## Browser Entry Identity

The browser collects every branded named or default export through the same
module collector as Build. It uses the accepted root membership, prefix,
transparent directories, file name, authored path, and local variant slug to
resolve each path. It does not discover files again. Component wrappers and
imported definition links receive this resolved identity before React mounts.
The current entry's link base resolves relative logical links. Definition
references use an unguessable token until their target path is known. The
browser uses Web Crypto, including on forwarded HTTP origins.

## Mount Contract

The browser runtime reads the bootstrap and locates the entry and optional
variant in the bundled registry. Screens use their authored `mobile` or
`desktop` node. Components use a deferred React element that calls the
registered `render` adapter with the saved variant's complete props and
`{ viewport, colorScheme }` when React traverses it. This keeps the component
render beneath the configured interactive renderer's provider tree, so a
saved component can read the same theme and consumer contexts as it does in a
screen.

In the browser, the component wrapper validates props as on the server but
records nothing and emits no sentinels; Review-ignore and material sentinels
also render nothing. The ordinary static bytes paint first. The runtime then
calls `createRoot(document.body, { onCaughtError, onUncaughtError })` and
renders inside `flushSync`, replacing the static body children, range comments,
Review sentinels and statically adapted controls in one task. React keeps the
body element and its attributes, and the static head remains untouched.

Before creating the root, the runtime retains the original body child-node
objects. An uncaught root error reports once, then queues one idempotent
recovery: it disposes Live-link handling, unmounts the failed root and calls
`body.replaceChildren(...staticChildren)`. Reusing the original objects moves
any React-retained body `style`, `script` or stylesheet nodes into their
original positions instead of duplicating them. The Browse adapter's static
link indices therefore work again through the inspector. A caught error
reports once but lets the consumer error boundary own its rendered result.
Strict bootstrap, registry, entry and variant validation occurs before
`createRoot`; failure reports once, rethrows, and leaves the static document
untouched.

The diagnostic is a bounded `render-error`. The default reporter logs the
failure in the frame and posts it to the interactive origin at
`POST /__mokly/interactive/<generation>/diagnostics` as JSON limited to the
validated view identity and a bounded message. A failure before valid
bootstrap identity has only `code` and `message`; the reporter derives a safe
endpoint generation from the package module URL. If neither source yields a
valid generation it logs locally without inventing an endpoint. The reporter
is injectable so runtime tests do not require HTTP. Serve strictly validates
and logs the payload once per view and generation. No consumer text enters the
shell. The endpoint is defined by the
[diagnostics contract](./mokly-interactive-views-serve.md#diagnostics).

### Renderer participation

The configured renderer module may export a second function:

```ts
interface InteractiveRenderInput {
  colorScheme: ColorScheme;
  entry: (ScreenDefinition | ComponentVariantDefinition) & { path: string };
  componentProps?: Readonly<Record<string, unknown>>;
  node: ReactNode;
  viewport: Viewport;
}

export function interactive(input: InteractiveRenderInput): ReactNode;
```

It receives the pure subset of `RenderInput` and returns the node to mount,
which lets the consumer wrap Live views in the same providers `render` uses.
For a saved component, `input.node` is the deferred element described by the
mount contract: placing it beneath providers in the returned tree makes those
providers visible while the component's registered render function runs. When
the export is absent, the runtime mounts `node` directly, which matches the
default renderer. The consumer keeps `render` and `interactive` visually
equivalent at their initial state. A render failure is reported as above, not
masked. Styles that the server renderer injects into `<head>` at render time,
such as collected React Native Web rules, remain in the static head; the Live
runtime does not inject a second copy, and a component that creates new rules
at runtime relies on the consumer's client-side style injection.

## Browser MockLink Behaviour

Every `MockLink` and complete logical value produced by `mockLink` resolves
through the bootstrap route table to the same portable href the build emitted.
Native `MockLink`, `MockLink asChild`, and a delegated handler for resolved raw
`mock:` anchors own unmodified primary activation. They prevent the native
click and dispatch the package-owned `mokly:interactive-navigation` DOM event
with the exact logical identity `{ screenPath, fragment?, target }`. The inspector
accepts only a plain object with the existing bounded path, fragment and target
grammars and no extra fields, then emits the unchanged frame-adapter
`navigation` message with `activation: "primary"`. The event never carries an
href, label or arbitrary URL.

Consumer JavaScript can synthesize this in-frame event, so it is a validation
boundary rather than an authentication boundary; the nonce/origin handshake
and the host's independent catalogue destination validation remain
authoritative. Primary activation is prevented before the frame can navigate,
even without a host subscription. Modified and middle activation dispatch no
Live event and keep native behaviour on the resolved portable href within the
frame sandbox, which forbids top navigation and popups. A path absent from the
route table renders inert and reports nothing. Valid fragments and browsing
targets are carried as logical identity only; neither layer trusts the
portable href as the host destination.

## Verification

Unit tests cover document composition without body-byte changes, every typed
eligibility reason, renderer selection, bootstrap validation, route tables
beyond 1,024 entries, and pre-mount, caught, and uncaught render failures. Real
browser tests mount a stateful component, verify that a saved component reads a
renderer provider, preserve the static initial state, exercise navigation
through the frame adapter, and verify that diagnostics are reported exactly
once.

## Related Docs

- [Interactive views overview](./mokly-interactive-views.md)
- [Interactive Serve delivery](./mokly-interactive-views-serve.md)
- [Interactive views shell](./mokly-interactive-views-shell.md)
- [Rendering and generated output](./mokly-rendering.md)
- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Catalogue navigation](./mokly-navigation.md)
