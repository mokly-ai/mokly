# Preparation describe still returns its definitions

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-21, from `calummoore/mokly-cheaper-sidecar-describe-dlz0`,
  as its deferred Part B. Completed on 2026-11-21 by review finding 1 of that
  branch.
- **Location:** `restore` in `crates/mokly-sidecar/src/pool_preparation.rs:190`,
  `Step::Prepare` in `crates/mokly-sidecar/src/pool_warmup.rs:39`,
  `Response::decode_result` in `crates/mokly-sidecar/src/wire.rs:118`,
  `Call::Describe` in `crates/mokly-sidecar/src/methods.rs:254`, the binary's own
  `describe` in `crates/mokly-render/src/bundle.rs:178`, the `describe` case in
  `packages/mokly/src/sidecar/session.ts:116`, `collect` in
  `packages/mokly/src/sidecar/describe.ts`, the `describe` row of
  `docs/protocol/mokly-sidecar.md`, and
  `docs/protocol/mokly-sidecar-definitions.md`.
- **Reason:** The user approved this work on 2026-11-21, but on the same day the
  performance orchestrator chose not to build it, because no option keeps the
  Rust definitions check, and the reply that it removes costs only about 3 ms
  of a warm edit.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Preparation describe:** the `describe` that `restore` in
    `pool_preparation.rs` and the warm-up `Step::Prepare` in `pool_warmup.rs`
    send to a render sidecar before its first render of a generation. The pool
    drops its result.
  - **Definitions check:** the decode in `Response::decode_result` of
    `wire.rs`, which turns each `describe` result into
    `MethodResult::Definitions` and fails on a bad reply.
- **Background:**
  - After a Serve edit, the binary asks the bundling sidecar for `describe` in
    `bundle.rs:178` and keeps that result. Each other sidecar that renders the
    generation gets a preparation describe first.
  - A preparation describe evaluates the generation, registers its
    definitions, and builds, encodes, and sends every definition record. The
    binary decodes the records in `wire.rs` and drops them.
  - The user approved this change on 2026-11-21, as "Part B" of the cheaper
    sidecar describe work. The approved shape: an optional prepare-only
    `describe` that evaluates and registers in full, keeps the same failures
    and state, and returns no definitions. Rust owns the wire types and the
    generated TypeScript. The protocol doc changes with the code.
  - The rule of 2026-11-21: the work stays conditional until its full error
    contract holds or the user chooses a contract change. No failure-path
    exception is approved.
  - On 2026-11-21 the performance orchestrator chose not to build it in that
    pull request, and moved it here.
  - A profile on `main` 793d0c77d of `mokly-cloud` (4 vCPU, release core,
    3 warm one-line edits) measured the non-bundling describes at 106 to
    269 ms. Evaluate took 68 to 153 ms, export order 14 to 53 ms, serialize 3.5
    to 13.6 ms, send 7 to 11 ms, and garbage collection 3 to 60 ms. Only
    serialize, send, and the Rust decode depend on the returned records.
  - The export-name cache of `packages/mokly/src/sidecar/export-name-cache.ts`
    later removed most of the export-order time.
  - A split of warm `mokly-cloud` edits on one monotonic clock for the core
    and every sidecar, by workspace 234 on 2026-11-22, measured this:
    - In each warm edit, the three cold sidecars run `restoreGeneration` and a
      preparation describe inside the background pass, before their first
      render and before Changes publishes. This preparation takes a median of
      200 ms on each of them.
    - A preparation describe takes a median of 134 ms. `orderedExports` is
      about 23% of it, which the export-name cache removes for unchanged
      entries.
    - The definitions reply is about 0.2 MB, so removing it saves about 3 ms.
    - The record is `plans/follow-ups/serve-edit-background-pass-split.md` on
      branch `calummoore/mokly-edit-background-render-olos`, commit 77fe22c13.
  - Correction of 2026-11-22: an earlier record said that render sidecars run
    their describes after Changes publishes in warm edits. That claim came
    from spans of different processes aligned by `elapsedMs`, and each process
    starts that clock at its own start. It is wrong.
  - Other open work changes the same code. On 2026-11-21, pull request #465
    rewrote `Response::decode_result` in `wire.rs`, the preparation path of
    `pool_preparation.rs`, the `bundle` and `restoreGeneration` cases of
    `session.ts`, the methods table of `docs/protocol/mokly-sidecar.md`, and
    the README files of `packages/mokly/src/sidecar` and
    `crates/mokly-sidecar`. Read those places on `main` again before you start.
- **Problem:** Each preparation describe serializes, encodes, sends, and
  decodes definitions that the binary drops.
- **Impact if no action:** Each cold render sidecar keeps about 3 ms of reply
  work inside the background pass of each warm edit. The edit time that a
  user sees changes little.
- **Root question:** How does a render sidecar prepare a generation without
  sending definitions that nobody reads, and keep every failure that the full
  reply reports today?
- **Shared assumptions:** Only the preparation calls change, from the code:
  the binary keeps only the result of its own call in `bundle.rs`. The
  preparation runs the same collection, `serialize` included, because
  `serialize` fills `generation.savedSlots`, from the code.
- **Options:**
  - **A.** Change nothing. This withdraws the work that the user approved.
    Effort: Small.
  - **B.** Add an optional `prepareOnly` flag to a new `DescribeParams` in
    `methods.rs`, with `generation`. A prepare-only call returns
    `result: null`, and `wire.rs` selects an empty result for it. `dispose`
    keeps `GenerationParams`. A null reply skips the Node encoding and
    frame-limit failures and the definitions check. Effort: Medium.
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
- **Work for an option that builds it:**
  - Write red tests first. In Rust, the decoder selects the empty result,
    `restore` and the warm-up send prepare-only calls, and the binary's own
    call stays full. In Node, a prepare-only call returns `null` and fails
    with the same code and message. It leaves the same handles,
    registrations, saved slots, and stories. A later full call equals a fresh
    call.
  - Add the wire shape in `methods.rs`, and move every `Call::Describe` use to
    it. Regenerate the TypeScript modules with the `shared-types` skill.
  - Select the empty result in `wire.rs`, send prepare-only calls from
    `restore` and the warm-up, and return `null` in `session.ts` after the
    same collection.
  - Change the `describe` row of `docs/protocol/mokly-sidecar.md` in place
    within its 250-line cap. Add the rule and its decision to
    `docs/protocol/mokly-sidecar-definitions.md`. Update the Key Code lists of
    the README files of `packages/mokly/src/sidecar` and `crates/mokly-sidecar`.
  - Run `cargo test -p mokly-sidecar`, `cargo test -p mokly-render`, the new
    Node tests, and `cargo xtask check --suite repository`.
- **Wider fix:** None. This is one call path.
- **Previous examples:** None found.
- **Related:** None.
- **Recommendation:** A. Each other option drops a failure check or changes
  the contract, and the measured gain is about 3 ms per warm edit. Measure
  again when the reply grows.
- **Action:** ask the user, because the user approved this work on 2026-11-21,
  option A withdraws it, and every option that builds it drops a failure
  check or changes the error contract of `describe`.
