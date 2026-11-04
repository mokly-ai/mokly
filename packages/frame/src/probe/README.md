# Frame probe

The frame probe is a dependency-free browser IIFE for the optional cross-origin
frame adapter. The package build emits `dist/browser/frame-probe.js`. The
viewer build copies that file into `packages/viewer/dist/browser` and lists it
in the viewer's browser module inventory. Serve and the static build deliver
the script at `/mokly-viewer/client/frame-probe.js`, and the static build
injects it into the current documents that it writes. The same-origin adapter
runs the shared event core of the frame probe directly with viewer callbacks.
[`probe_budget.test.ts`](../../tests/probe_budget.test.ts) checks the
built script against the script budget of the
[frame probe contract](../../../../docs/protocol/mokly-frame-probe.md).

The build uses esbuild, then [`scripts/probe-pool.mjs`](../../scripts/probe-pool.mjs) shares repeated strings
and native references before Terser minification. The output is ordinary
JavaScript with no runtime imports, decoder or evaluator. Only explicitly named
private members are mangled. The pool rejects native-name shadowing and generated
name collisions; semantic regression tests cover its transformations.

## Validation

Requests and responses have separate validators, so the frame probe bundle
includes only the host-message decoder. Exact field counts reject unknown
fields. Outgoing fields are validated ASCII identities, control states, and
numeric geometry, so their serialized character count also bounds their UTF-8
bytes. Incoming messages and metadata always receive the full UTF-8 check
before parsing. The
[frame probe handshake and wire protocol](../../../../docs/protocol/mokly-frame-probe-wire.md)
define the handshake, the messages, and their limits.

## Published map and markers

`metadata.ts` reads the inert map that the static build writes into each
current document, and `ranges.ts` reads the `mokly-instance` and `mokly-slot`
markers of that document. The Publication Boundary and Range Markers sections
of the
[frame probe contract](../../../../docs/protocol/mokly-frame-probe.md)
define the map format and the markers.

## Geometry and picking

The frame probe draws nothing in the preview document. It reports instance
boundaries and geometry changes so the shell can draw masks, outlines, and
labels with `@mokly/ui` components above the frame. Highlight requests set the
keys and mode of the pick listeners. Hover, pick, Escape, and navigation reports
keep the same wire messages. Text-only ranges scroll their real rectangles
through inner containers and the document viewport.

## Development

```bash
npm run build
cargo xtask check --suite viewer
```

### Key Code

- [`index.ts`](./index.ts) is the IIFE entry, which installs only the bounded
  handshake listener and starts the runtime after the first valid `hello`.
  It wraps direct core calls with ordered requests, replies, and wire errors.
- [`runtime.ts`](./runtime.ts) holds `probeRuntime`, which owns the
  observers and input handling of one document. Its direct methods list,
  highlight, scroll, subscribe, and dispose without wire messages.
- [`runtime_types.ts`](./runtime_types.ts) defines the core's event callback,
  link classifier, and observer and timer environment. The caller supplies
  the callback realm separately from the measured window.
- [`schema.ts`](./schema.ts) and [`values.ts`](./values.ts) validate the wire
  messages of both transports.
- [`metadata.ts`](./metadata.ts) holds `readMetadata`, which reads the inert
  frame probe map of a published document into `ProbeMetadata`.
- [`ranges.ts`](./ranges.ts) holds `documentRanges`, which authenticates the
  marker ranges of the map through the shared pattern in
  [`markers.ts`](./markers.ts).
- [`inspection.ts`](./inspection.ts) and [`geometry.ts`](./geometry.ts) list
  the instance boundaries, measure their clipped boxes, and scroll to an
  instance.
- [`clipping.ts`](./clipping.ts) holds the clipping rules that the same-origin
  and cross-origin adapters share through the core. The shell also uses these
  rules to clip the frame to its host ancestors.
- [`links.ts`](./links.ts) holds `probeNavigation`, which turns a marked
  link activation into a logical navigation.
- [`../../scripts/probe-bundle.mjs`](../../scripts/probe-bundle.mjs)
  holds `bundleProbe`, which runs esbuild, the string pool, and Terser.

See the [normative frame protocol](../../../../docs/protocol/mokly-frame-adapter.md),
[frame probe contract](../../../../docs/protocol/mokly-frame-probe.md),
[frame probe wire protocol](../../../../docs/protocol/mokly-frame-probe-wire.md),
[client adapters](../../../viewer/src/client/README.md), and [publication boundary](../../../../docs/protocol/mokly-export-delivery.md).
