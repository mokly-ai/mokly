# Sidecar start and response encoding cost time

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from finding 11 of the performance profile of
  2026-10-27 in the "mokly perf orchistrator" workspace. On 2026-10-27 the
  user answered "ignore for now".
- **Location:** `packages/mokly/src/sidecar/export-order.ts:1`,
  `packages/mokly/src/sidecar/json.ts:4`, and
  `packages/mokly/src/sidecar/postcss-context.ts:2`.
- **Reason:** The user set this finding aside on 2026-10-27, and its gain
  after the later performance work is not measured.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Sidecar:** the Node process under `packages/mokly/src/sidecar` that
    bundles, evaluates, and renders the JavaScript entries.
  - **`hello`:** the first request that the sidecar pool sends to a new
    sidecar.
  - **Root switch:** a request for another source root, which makes the
    sidecar pool stop one sidecar and start a new one there.
- **Background:**
  - On 2026-10-27, a release build on `examples/basic` measured a sidecar
    `hello` answer after 230 to 290 ms. Imports of the Babel parser and
    traverse took 168 ms of that.
  - `export-order.ts:1` imports `@babel/parser` at the top of the module,
    and `describe.ts` and `stories.ts` import it. `postcss-context.ts:2`
    imports `@babel/traverse`.
  - Serve starts sidecars at startup and on each root switch. On
    2026-10-30, `sidecar.spawn` took 0.24 s before the first bundle of a
    Serve start on a slow machine.
  - `jsonText` in `json.ts:4` encodes each response with sorted keys. It
    showed about 0.5 s of self time for each 600 renders on 2026-10-27.
  - `jsonText` writes negative zero as `-0`. `JSON.stringify` writes `0`,
    and `docs/protocol/mokly-component-props.md:101` requires negative zero
    to survive.
- **Problem:** Each sidecar start loads Babel before it can answer, and
  each response pays for a hand-written encoder.
- **Impact if no action:** Each Serve start and each root switch keep about
  0.2 s of sidecar start time. The user's startup target is about 1 s.
- **Root question:** How does a sidecar answer its first request sooner,
  and encode responses faster, with the same bytes?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Load Babel lazily where the sidecar uses it, and start that load
    in the background after `hello`, so it overlaps the first compile.
    Effort: Small (estimate).
  - **C.** B, and a faster encoder that gives byte-identical output, also
    for negative zero. Effort: Medium (estimate).
- **Left out:** `JSON.stringify` with a sorted replacer, as the profile
  proposed. It loses negative zero.
- **Wider fix:** None. The cost is bounded.
- **Previous examples:** None found.
- **Related:**
  - [serve-sidecar-prestart.md](./serve-sidecar-prestart.md): it removes
    the sidecar start wait of the first background renders.
  - [bundle-disk-cache.md](./bundle-disk-cache.md): the larger part of the
    startup time.
- **Recommendation:** B (estimate). It moves Babel off the startup path
  with no change to output. Measure `hello` and `serve.ready` first, because
  the later performance work changed both.
- **Action:** ask the user, because the user set this finding aside, and no
  option is clearly best before a new measurement.
