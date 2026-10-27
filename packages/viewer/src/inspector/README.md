# Published frame inspector

The inspector is a dependency-free browser IIFE for the optional cross-origin
frame adapter. The viewer package build emits `dist/browser/inspector.js`.
Serve and the static build deliver it at `/mokly-viewer/client/inspector.js`,
and the static build injects it into the current documents that it writes.
[`inspector_budget.test.ts`](../../tests/inspector_budget.test.ts) checks the
built script against the script budget of the
[published inspector contract](../../../../docs/protocol/mokly-published-inspector.md).

The build uses esbuild, then [`scripts/inspector-pool.mjs`](../../scripts/inspector-pool.mjs) shares repeated strings
and native references before Terser minification. The output is ordinary
JavaScript with no runtime imports, decoder or evaluator. Only explicitly named
private members are mangled. The pool rejects native-name shadowing and generated
name collisions; semantic regression tests cover its transformations.

## Validation

Requests and responses have separate validators, so the inspector bundle
includes only the host-message decoder. Exact field counts reject unknown
fields. Outgoing fields are validated ASCII identities, control states, and
numeric geometry, so their serialized character count also bounds their UTF-8
bytes. Incoming messages and metadata always receive the full UTF-8 check
before parsing. The
[inspector handshake and wire protocol](../../../../docs/protocol/mokly-inspector-wire.md)
define the handshake, the messages, and their limits.

## Published map and markers

`metadata.ts` reads the inert map that the static build writes into each
current document, and `ranges.ts` reads the `mokly-instance` and `mokly-slot`
markers of that document. The Publication Boundary and Range Markers sections
of the
[published inspector contract](../../../../docs/protocol/mokly-published-inspector.md)
define the map format and the markers.

## Overlay

The overlay host sits after the authored body, outside the range and occlusion
candidates. Its shadow root isolates the SVG styling and the redraw mutations.
The host resets consumer presentation with inline important styles, and the
shadow SVG resets inherited styles before it draws the mask and the outlines.
Text-only ranges scroll their real rectangles through inner containers and the
document viewport.

## Development

```bash
npm run build
cargo xtask check --suite viewer
```

### Key Code

- [`index.ts`](./index.ts) is the IIFE entry, which installs only the bounded
  handshake listener and starts the runtime after the first valid `hello`.
- [`runtime.ts`](./runtime.ts) holds `inspectorRuntime`, which owns the
  observers, the input handling, the presentation, and the ordered requests of
  one session.
- [`schema.ts`](./schema.ts) and [`values.ts`](./values.ts) validate the wire
  messages of both transports.
- [`metadata.ts`](./metadata.ts) holds `readMetadata`, which reads the inert
  inspector map of a published document.
- [`ranges.ts`](./ranges.ts) holds `documentRanges`, which authenticates the
  marker ranges of the map through the shared pattern in
  [`markers.ts`](./markers.ts).
- [`inspection.ts`](./inspection.ts) and [`geometry.ts`](./geometry.ts) list
  the instance boundaries, measure their clipped boxes, and scroll to an
  instance.
- [`overlay.ts`](./overlay.ts) holds `drawOverlay`, which draws the SVG mask
  union and the outlines.
- [`clipping.ts`](./clipping.ts) holds the clipping rules that the same-origin
  measurer of [the client](../client/README.md) shares.
- [`links.ts`](./links.ts) holds `inspectorNavigation`, which turns a marked
  link activation into a logical navigation.
- [`../../scripts/inspector-bundle.mjs`](../../scripts/inspector-bundle.mjs)
  holds `bundleInspector`, which runs esbuild, the string pool, and Terser.

See the [normative frame protocol](../../../../docs/protocol/mokly-frame-adapter.md),
[published inspector contract](../../../../docs/protocol/mokly-published-inspector.md),
[inspector wire protocol](../../../../docs/protocol/mokly-inspector-wire.md),
[client adapters](../client/README.md), and [publication boundary](../../../../docs/protocol/mokly-export-delivery.md).
