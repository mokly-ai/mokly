# Published frame inspector

The inspector is a dependency-free browser IIFE for the optional cross-origin
frame adapter. The viewer package build emits `dist/browser/inspector.js`, and the root
`scripts/package-check.mjs` enforces its 9,216-byte minified, uncompressed budget.
Serve and export publish it at `/__mokly/client/inspector.js`.
The build uses esbuild, then [`scripts/inspector-pool.mjs`](../../scripts/inspector-pool.mjs) shares repeated strings
and native references before Terser minification. The output is ordinary
JavaScript with no runtime imports, decoder or evaluator. Only explicitly named
private members are mangled. The pool rejects native-name shadowing and generated
name collisions; semantic regression tests cover its transformations.

`index.ts` installs only a bounded handshake listener before activation. The
document must have exactly one canonical `mokly-host` origin parameter. Only its
immediate parent at that origin may pin the first nonce. Every reply uses that
exact origin; no top-window or parent-location access is involved. The local
sandbox disables the script, and standalone documents without a valid handshake
keep native behavior.

`schema.ts` and `values.ts` validate the wire contract for both transports.
Requests and responses have separate validators so the inspector bundle includes
only the host-message decoder. Every known value is checked, and exact field
counts reject unknown fields recursively. JSON is byte-bounded before parsing.
The host additionally verifies all returned identities against the mount's usage.
Outgoing fields are validated ASCII identities, control states and numeric
geometry, so their serialized character count also bounds UTF-8 bytes. Incoming
messages and metadata always receive the full UTF-8 check before parsing.

`metadata.ts` reads the bounded inert map authenticated by the Browse adapter.
Its `ranges` array stores `[instanceKey | null, parentIndex | null]` tuples:
index `n` names `r-n`, null keys identify slots, and null parents identify roots.
Keys are derived uniquely from the range map, including empty/null instances.
`links` contains deduplicated logical navigation identities; native links carry
`data-mokly-inspector-link` indices into that array. An optional `error`
of `limit` or `unavailable` explicitly disables inspection. No props, component
labels, source paths or private evidence enter this map. Parents must refer to
earlier ranges; the runtime also authenticates their actual DOM nesting.

`ranges.ts`, `geometry.ts` and `inspection.ts` authenticate every marker pair,
measure real element and text regions, clip overflow and occlusion, and scroll
the first rendered placement. Viewport clipping bounds every emitted coordinate;
range and total box limits fail explicitly without truncation. `runtime.ts`
coalesces geometry/hover events, handles selection before links, and owns all
observers and cleanup. `overlay.ts` draws the existing SVG mask union and
outlines without modifying consumer content or styles. Its shadow root isolates
SVG styling and redraw mutations. The overlay host sits after the authored body,
outside range and occlusion candidates. Text-only ranges scroll their real
rectangles through inner containers and the document viewport.
`clipping.ts` is shared with the local highlight measurer. It follows fixed
containing blocks while retaining inner-scroll clipping and ancestor visibility.
The overlay host resets consumer presentation with inline important styles;
the shadow SVG resets inherited styles before drawing its mask and outlines.
The 9 KiB budget accommodates these correctness fixes after safe pooling and
minification; the completed component explorer plan records the measured size
and alternatives.

```bash
npm run build
npm run package:check
node --import tsx --test tests/inspector*.test.ts
npx playwright test tests/browser/frame_adapter.spec.ts tests/browser/frame_adapter_security.spec.ts
```

See the [normative frame protocol](../../../../docs/protocol/mokly-frame-adapter.md),
[client adapters](../client/README.md), and [publication boundary](../../../../src/browse/README.md).
