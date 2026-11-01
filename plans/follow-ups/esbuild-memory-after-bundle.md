# esbuild keeps its memory after each bundle

- **Severity:** Medium. **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from decision 7 of the closed "Hash-Based Content
  Caching" workspace, 2026-10-27, which the user did not answer.
- **Location:** `packages/mokly/src/sidecar/session.ts:1` and
  `docs/protocol/mokly-sidecar-memory.md:4`.
- **Reason:** The measurement predates PR #226, which changed how the
  sidecar compiles, so the fix needs a new measurement first.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Sidecar:** the Node process under `packages/mokly/src/sidecar` that
    bundles, evaluates, and renders the JavaScript entries.
  - **esbuild service:** the Go process that the esbuild JavaScript API
    starts on the first build. It runs until `stop()` or until the Node
    process exits.
- **Background:**
  - `session.ts:1` imports `build` from esbuild. No sidecar code calls
    esbuild's `stop()`, so the service lives as long as its sidecar.
  - `docs/protocol/mokly-sidecar-memory.md:4` sets a 1 GiB limit across one
    sidecar and its Node descendants. Native helpers such as esbuild are
    left out, so the recycle check does not see esbuild.
  - On 2026-10-27, a development build on `examples/basic` measured one
    bundle at about 6 s. esbuild peaked at 0.85 to 1.05 GiB. In one run it
    still held 967 MiB 39 s after its peak.
  - In that run, a build with Changes peaked at 4.1 GiB in total, and the
    sidecars with esbuild and PostCSS held 3.6 GiB of it.
  - On 2026-10-28, PR #226 changed bundling to a native resolution plan and
    a second compile. Nobody measured esbuild memory after it.
- **Problem:** Each sidecar that bundles keeps its esbuild service and its
  peak memory until the sidecar exits.
- **Impact if no action:** About 1 GiB can stay in use after each bundle.
  In Serve, each JavaScript edit runs a new bundle.
- **Root question:** How does a sidecar give back the bundler's memory when
  no bundle runs?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Call esbuild's `stop()` after each bundle request. The next
    bundle starts a new service, at a small start cost. Effort: Small
    (estimate).
  - **C.** Count native helpers in the sidecar memory check, so that a large
    esbuild service triggers a recycle. This changes the sampling rule of
    the memory page, and a recycle costs more than a service start. Effort:
    Medium (estimate).
- **Left out:** Go runtime memory settings for esbuild. They limit the
  peak, but the service still keeps memory between bundles.
- **Wider fix:** B. Every bundle then ends with no idle service.
- **Previous examples:** None found.
- **Related:**
  - [default-sidecar-count.md](./default-sidecar-count.md): the other large
    part of sidecar memory.
  - [compiled-recipe-cache.md](./compiled-recipe-cache.md): it records an
    esbuild peak of 2.91 GB in a Mokly Cloud sample.
- **Recommendation:** B. It frees the memory as soon as a bundle ends, and
  it changes no protocol rule.
- **Action:** fix after merge, apply B, because no open branch owns the
  sidecar session, and the memory needs a new measurement after PR #226.
