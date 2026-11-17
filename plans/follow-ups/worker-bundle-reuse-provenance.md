# Shared recipes lose worker reuse identity

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-17, from round 1 of the implementation review of the
  bundle disk cache branch `calummoore/lisbon-h906`, finding 1, and its
  finding check.
- **Location:** `crates/mokly-sidecar/src/pool_preparation.rs:24` to line 29,
  `crates/mokly-sidecar/src/pool_requests.rs:85` to line 92,
  `crates/mokly-sidecar/src/pool_bundle_cache.rs:103` to line 110, and
  `crates/mokly-sidecar/src/compiled.rs:124`.
- **Reason:** The defect is Rare and affects only the optional timing output.
  No current command flow was found to trigger it. Its fix does not get harder
  after the merge.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Pool record:** the `state.compiled` entry of one generation in the Rust
    sidecar pool. It holds the compiled recipe that the pool retains for that
    generation.
  - **Runtime key:** the private import name that each compile creates, in
    `packages/mokly/src/sidecar/bundle.ts:155`.
  - **Evaluation digest:** the core's digest of the resolved configuration and
    the CSS Modules maps. It separates evaluation lifetimes of equal compiled
    code, and the generation id includes it.
  - **Split:** a worker holds one compilation of a generation, but the pool
    record names another compilation with an equal recipe and a different
    runtime key.
  - **`cache` field:** the field of the `catalogue.bundle` timing record that
    names why a bundle request compiled, or `memory` or `hit` when it reused
    code.
- **Background:**
  - The pool runs requests in independent Node workers. Each compile creates a
    fresh runtime key. A complete compilation keeps a deterministic identity
    without that key, at `packages/mokly/src/sidecar/bundle-recipe.ts:116`
    and under `docs/protocol/mokly-sidecar-modules.md:193`.
  - `crates/mokly-sidecar/src/pool_requests.rs:85` to line 92 makes the pool
    record of a new bundle result share any retained compilation with an
    equal recipe. `same_recipe` at `crates/mokly-sidecar/src/compiled.rs:124`
    compares neither `runtime_key` nor `code`. So equal compiles share one
    record, also with different evaluation digests. Each worker still holds
    its own compilation with its own key.
  - The sidecar reuses the first live generation that is still current, with
    that generation's own key, at `packages/mokly/src/sidecar/session.ts:68`
    and `packages/mokly/src/sidecar/compiled.ts:114`.
  - `seed_compilation` at `crates/mokly-sidecar/src/pool_preparation.rs:17`
    collects the installed runtime keys of a worker through the pool records,
    at lines 24 to 29. When it finds a complete seed,
    `crates/mokly-sidecar/src/pool_bundle_cache.rs:44` to line 46 sets the
    cause `stamp-mismatch`.
  - `complete_bundle` at `pool_bundle_cache.rs:97` classifies the result at
    lines 103 to 110. A result key in that list gives `memory`. A key equal
    to the disk seed key gives `hit`. Any other key keeps the cause.
  - The timing rule is in `docs/protocol/mokly-timings.md`. Line 123 says:
    "The sidecar compiled for every value except `memory` and `hit`." Lines
    129 to 130 say: "Replay and evaluation-only reuse add no `esbuild`
    count." The span is `catalogue.bundle`, at
    `crates/mokly-render/src/bundle_attempt.rs:22`.
  - `crates/mokly-sidecar/README.md:115` says that the pool compares the
    result with the keys of the generations that the worker holds. The code
    compares it with the keys of their pool records.
  - Both forms of the trigger make a split:
    - Equal evaluation digests: two bundles with equal parameters get one
      generation id. The worker with the newest epoch holds its own key, and
      the pool record holds the key of the other compile.
    - Different evaluation digests: two generation ids share one pool record
      with one key, while the second worker holds another key.
  - No current command flow was found to send two bundles with equal recipes
    at the same time:
    - Serve runs one rebuild at a time, at
      `crates/mokly-cli/src/serve_rebuild.rs:127`.
    - Serve runs one background loop, at
      `crates/mokly-cli/src/entry_serve.rs:265`. That loop waits for a
      cancelled Changes attempt before it starts the next one, at
      `crates/mokly-server/src/changes_background.rs:103`.
    - Captures read retained inputs.
    - `build` prepares the head side and the base side one after the other.
  - The pool contract still lets callers send concurrent requests. The
    default pool size is the core count, at
    `crates/mokly-cli/src/options.rs:45`.
  - The test
    `complete_memory_is_selected_before_newest_epoch_and_installed_keys_count_as_memory`,
    at `crates/mokly-sidecar/src/_tests_/bundle_pool/order_tests.rs:42`, gives
    the worker the retained key. No test gives two workers different keys for
    one equal recipe, with equal or with different evaluation digests.
  - Both review passes followed the scenario through the source. Nobody ran
    it.
  - A second effect of the same cause was considered and not raised. After a
    split on the head side, `served()` at `pool_bundle_cache.rs:131` offers
    the compilation of the pool record. It can have another runtime key than
    the compilation that `complete_bundle` offered, so the bundle store writes
    an equal recipe again. No current command makes a split on the head side.
  - Every option must keep these goals:
    - Existing recipe sharing and the deterministic identity of each
      complete compilation stay.
    - The pool owns the `cache` value and returns it in a field that never
      crosses the wire, as the `epoch` field does.
    - `hit` means that the result key equals the key of the disk seed of the
      request.
    - Rendering and caching behaviour stay as they are.
- **Problem:** After a split, a later unchanged request on that worker
  returns the worker's own key, which is not in the list that
  `seed_compilation` builds. So `catalogue.bundle` reports `stamp-mismatch`,
  although no compiler ran.
- **Impact if no action:** The timing output reports a compile when no
  compiler ran, and `sidecar.operation` shows no `esbuild` event for that
  request. The split stays, so each later reuse on that worker gives a wrong
  report. Each new generation that the worker makes from its compilation also
  gets a wrong record. Rendered output and caching do not change, and the
  `sidecar.operation` counts give a workaround.
- **Root question:** How should each request report whether its worker
  reused compiled code?
- **Options:**
  - **A.** Require equal runtime keys before sharing compiled recipes. Add the
    two-worker regression for equal and for different evaluation digests. It
    removes sharing only between independent compiles of an equal recipe.
    Reuse that returns the retained key still shares its recipe. With equal
    generation ids, `stale_generation` at
    `crates/mokly-sidecar/src/pool_cleanup.rs:22` marks the copy with the older
    epoch, so the next request on that worker disposes it before a later
    restore. Effort: Small.
  - **B.** Keep the actual installed runtime key with each worker's record of
    a loaded generation. Update this record on bundle, restore, and disposal.
    Add a controlled two-worker regression with equal compilation identities
    and different runtime keys. It preserves recipe sharing, but it must keep
    the record right at six install and disposal paths. Effort: Medium.
  - **C.** Make the sidecar report whether its bundle request reused code. Use
    that fact for memory classification, and keep the comparison with the
    disk seed key for disk provenance. Update the wire types and add the
    regression. It changes the `bundle` result row of
    `docs/protocol/mokly-sidecar.md:61`, so it needs the user. Effort: Medium.
  - **D.** Classify from the actual compile:
    - The worker client reads each `operation` event before the response, in
      the request loop at `crates/mokly-sidecar/src/client.rs:92` to line 97.
    - The process worker counts the `esbuild` events of a `bundle` request.
      It shares the counter with `ForwardEvents`, as `PhaseState` does, at
      `crates/mokly-sidecar/src/process_worker.rs:23` and line 70.
    - It stores the count in a field of the bundle result that never crosses
      the wire, like the `epoch` and `cache` fields.
    - If no compile ran and the key equals the disk seed key,
      `complete_bundle` reports `hit`.
    - If no compile ran in any other case, it reports `memory`.
    - If a compile ran, it keeps the cause of the request.
    - `seed_compilation` then returns only completeness.
    - No wire or protocol change is necessary, because the timings page
      already says that reuse adds no `esbuild` count.
    - It changes the process worker, each `results::Bundle` test literal, and
      the pool paragraph of `crates/mokly-sidecar/README.md`. Add the
      two-worker regression for equal and for different evaluation digests,
      and a worker test that counts the events of each request.
    - Effort: Medium.
  - **E.** Make the worker hold the compilation of the pool record:
    - When a bundle result shares a compilation that has another runtime key,
      the pool sends `dispose` to that worker.
    - Then it sends `restoreGeneration` with the shared compilation, before it
      frees the slot.
    - `complete_bundle` then offers the shared compilation, and one shared
      copy stays.
    - In the rare split case, it costs one more round trip of a recipe of
      several megabytes. It also needs failure handling for a restore that
      comes after a successful bundle.
    - It also removes the repeated equal store write above. A removes that
      write only within one generation. B and D do not change it.
    - Effort: Medium.
- **Left out:**
  - Change nothing. It leaves timing output that contradicts the compiler
    operation counts.
  - A single-flight wait for equal settings in the pool scheduler. It removes
    only the concurrent trigger, so a split from another path still gives a
    wrong report. It also changes FIFO leasing and cancellation while a
    request waits.
  - A generation id that contains the runtime key. It breaks the
    deterministic identity rule, which stays.
  - A classification by recipe equality. It reports `memory` after the
    sidecar compiled an equal recipe again.
  - A choice of the live compilation by the sidecar. It needs a new `bundle`
    parameter, and the record of the chosen generation can still name
    another key.
- **Wider fix:** D. Actual compiler events then decide the classification,
  also when sharing, seeding, or worker records change. The first review pass
  named B.
- **Previous examples:** The test
  `sharing_code_keeps_different_unmapped_directory_records`, at
  `crates/mokly-sidecar/src/_tests_/pool_provenance_tests.rs:16`, protects
  other metadata from wrong recipe sharing. It predates the bundle disk cache
  change. A search of commits `055c95981` and `2ca577425` found no earlier
  runtime-key case.
- **Recommendation:** D. It uses the actual compiler events that define
  memory reuse and disk hits, and it adds no wire field or requirement. It
  replaces the first recommendation, B. A is the direct fix, B must keep
  worker records right at six paths, and C needs the user.
- **Action:** fix after merge, apply D, because the defect is Rare and affects
  only the optional timing output. No current command flow was found to trigger
  it. The fix does not get harder after the merge.
