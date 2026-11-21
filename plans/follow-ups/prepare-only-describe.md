# Preparation describe still returns its definitions

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-21, from `calummoore/mokly-cheaper-sidecar-describe-dlz0`,
  as its deferred Part B.
- **Location:** `crates/mokly-sidecar/src/pool_preparation.rs:190`,
  `crates/mokly-sidecar/src/wire.rs:135`, `crates/mokly-render/src/bundle.rs:178`,
  `packages/mokly/src/sidecar/describe.ts`, and the `describe` row of
  `docs/protocol/mokly-sidecar.md`.
- **Reason:** On 2026-11-21 the performance orchestrator chose not to build
  this change, because it saves little on the warm edit path and cannot keep
  the Rust check of the definitions without a contract change.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Preparation describe:** the `describe` that `restore` in
    `pool_preparation.rs` sends to a render sidecar before its first render of
    a generation. The pool drops its result.
  - **Definitions check:** the decode in `wire.rs:135`, which turns each
    `describe` result into `MethodResult::Definitions` and fails on a bad reply.
- **Background:**
  - After a Serve edit, the binary asks the bundling sidecar for `describe` in
    `bundle.rs:178` and keeps that result. Each other sidecar that renders the
    generation gets a preparation describe first.
  - A preparation describe evaluates the generation, registers its
    definitions, and builds, encodes, and sends every definition record. The
    binary decodes the records in `wire.rs` and drops them.
  - A profile on `main` 793d0c77d of `mokly-cloud` (4 vCPU, release core,
    3 warm one-line edits) measured the non-bundling describes at 106 to
    269 ms. Evaluate took 68 to 153 ms, export order 14 to 53 ms, serialize 3.5
    to 13.6 ms, send 7 to 11 ms, and garbage collection 3 to 60 ms. Only
    serialize, send, and the Rust decode depend on the returned records.
  - The export-name cache of `packages/mokly/src/sidecar/export-name-cache.ts`
    later removed most of the export-order time.
  - The orchestrator split each `mokly-cloud` edit into stages over four
    blocks. In warm edits, render sidecars ran their describes 2.7 to 4.9 s
    after the edit started, after Changes published. In cold 10-edit sessions,
    about one render-sidecar describe per edit fell inside `serve.background`,
    at about 25 ms with the export-name cache.
- **Problem:** Each preparation describe serializes, encodes, sends, and
  decodes definitions that the binary drops.
- **Impact if no action:** Render sidecars keep a few milliseconds to about
  20 ms of work per generation, mostly after Changes publishes. The edit time
  that a user sees changes little.
- **Root question:** How does a render sidecar prepare a generation without
  sending definitions that nobody reads, and keep every failure that the full
  reply reports today?
- **Shared assumptions:** Only the preparation calls change, from the code:
  the binary keeps only the result of its own call in `bundle.rs`. The
  preparation runs the same collection, `serialize` included, because
  `serialize` fills `generation.savedSlots`, from the code.
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Add an optional `prepareOnly` flag to a new `DescribeParams`, with
    `generation`. A prepare-only call returns `result: null`, and `wire.rs`
    selects an empty result for it. `dispose` keeps `GenerationParams`. A null
    reply skips the Node encoding and frame-limit failures and the
    definitions check. Effort: Medium.
  - **C.** Add a new method, such as `prepareGeneration`, with the same
    evaluation and no result. Cost: a new method row, a dispatch case, and a
    timeout rule. It loses the same failures as B. Effort: Medium.
  - **D.** As B, but the sidecar encodes the full reply and drops it before it
    sends `null`. This keeps the Node encoding and frame-limit failures. It
    still loses the definitions check. Effort: Medium.
  - **E.** Skip only the Rust decode of a preparation reply, and keep the full
    transfer. It loses the definitions check. Effort: Small.
  - **F.** Change the contract so that only the binary's first full reply is
    checked. Then B, C, D, or E keeps the contract. Effort: Medium.
- **Left out:** A decode skip with a check of only a hash, because it still
  needs the full transfer and gives a weaker check than the decode.
- **Wider fix:** None. This is one call path.
- **Previous examples:** None found.
- **Related:** None.
- **Recommendation:** A. The work falls mostly after Changes publishes, and
  each other option drops a failure check or changes the contract.
  Measure again when a later change moves render-sidecar describes onto the
  edit path.
- **Action:** ask the user, because each option other than A changes the
  error contract of `describe` in `docs/protocol/mokly-sidecar.md`.
