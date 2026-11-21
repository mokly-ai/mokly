# Sidecar start loads Babel before its first answer

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from finding 11 of the performance profile of
  2026-10-27 in the "mokly perf orchistrator" workspace. On 2026-10-27 the
  user answered "ignore for now". Narrowed on 2026-11-21 by
  `calummoore/mokly-sidecar-bundle-tail-mge9`, which made the response
  encoder faster with the same bytes.
- **Location:** `packages/mokly/src/sidecar/export-order.ts:1` and
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
  - The finding of 2026-10-27 also covered the response encoder `jsonText`
    in `json.ts`. On 2026-11-21, the user approved a faster encoder with the
    same bytes, also for negative zero, and the sidecar bundle-tail change
    added it. This item covers only the sidecar start.
- **Problem:** Each sidecar start loads Babel before it can answer.
- **Impact if no action:** Each Serve start and each root switch keep about
  0.2 s of sidecar start time. The user's startup target is about 1 s.
- **Root question:** How does a sidecar answer its first request sooner,
  with the same output?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Load Babel lazily where the sidecar uses it, and start that load
    in the background after `hello`, so it overlaps the first compile.
    Effort: Small (estimate).
- **Left out:** A faster response encoder, because the encoder of
  2026-11-21 already gives the same bytes faster. The profile's
  `JSON.stringify` with a sorted replacer would also lose negative zero. No
  other approach for the Babel imports is recorded. Widen the options after
  the new measurement, because the later performance work changed the start
  path.
- **Wider fix:** None. The cost is bounded.
- **Previous examples:** None found.
- **Related:**
  - [serve-sidecar-prestart.md](./serve-sidecar-prestart.md): it removes
    the sidecar start wait of the first background renders.
  - The [bundle cache](../../docs/protocol/mokly-base-cache.md#bundle-entries)
    of compiled JavaScript: it removes the bundle compile, the larger part of
    the startup time, from a warm restart.
- **Recommendation:** B (estimate). It moves Babel off the startup path
  with no change to output. Measure `hello` and `serve.ready` first, because
  the later performance work changed both.
- **Action:** ask the user, because the user set this finding aside, and no
  option is clearly best before a new measurement.
