# Warm bundle cache test finds no disk record

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, on branch `calummoore/mokly-flaky-saved-plan-test-5sod`
  at commit `76386b810`, from a macOS CI failure of PR #356.
- **Location:** `crates/mokly-compare/tests/bundle_pool_tests.rs:27` to line
  75, with the warm cache assertion at line 51,
  `crates/mokly-compare/tests/support/bundle_pool.rs:127` to line 137,
  `crates/mokly-sidecar/src/pool_bundle_cache.rs:41` to line 150,
  `crates/mokly-sidecar/src/durable_recipe.rs:31` to line 35,
  `crates/mokly-compare/src/bundle_store.rs:73` and line 138,
  `crates/mokly-sidecar/src/bundle_outcomes.rs:5` to line 19, and
  `packages/mokly/src/sidecar/captured-plan.ts:8` to line 18.
- **Reason:** On 2026-11-19 the performance orchestrator deferred this unknown
  mode, so that the class fix of the branch does not wait for its natural
  trace.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Bundle pool:** the Rust owner of the Node sidecars that compile bundles.
    Each new pool in the test starts new sidecar processes.
  - **Disk record:** a compilation that the bundle cache, the disk cache of
    compiled bundles, stored. The test keeps it in a private cache folder.
  - **Cache outcome:** the `cache` field of a bundle result, a `CacheOutcome`
    in `crates/mokly-sidecar/src/bundle_outcomes.rs:5`. `Hit` means that a
    disk record supplied the compilation. `NoRecord` means that no stored
    compilation exists.
  - **Durable evidence:** reuse evidence whose capture witnesses did not change
    during the compile. A witness holds the stamps of one folder on the path
    to a recorded input.
  - **Write outcome:** the result of a save to the bundle cache, such as
    `Written` or `Unchanged`.
- **Background:**
  - The test is
    `a_warm_inexact_compilation_supplies_the_first_edit_plan_with_one_attempt_and_equal_output`
    at line 27 of `crates/mokly-compare/tests/bundle_pool_tests.rs`. It uses
    real Node sidecars and a real disk cache. Its pool, bundle, and edit
    helpers are in `crates/mokly-compare/tests/support/bundle_pool.rs`.
  - The test makes its fixture with
    `durable_fixture::create(Owner::CompareWarmPlan)`, at line 28.
  - The CI failure ran an earlier copy of the test file, equal to the copy at
    commit `76386b810`. That copy made the fixture root with
    `tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR"))`, at its line 126. Its
    warm cache assertion was at its line 149.
  - The test steps:
    - The first pool compiles the fixture. The test asserts two esbuild
      calls, at line 45, and a plan with two imports, at line 46. Then the
      pool shuts down.
    - A new warm pool sends the same bundle request. The test asserts the
      cache outcome `Hit`, at line 51. The message of that assertion prints
      the flags of the first capture, from `capture_flags` at
      `support/bundle_pool.rs:127`.
    - The test also asserts the same runtime key and plan, at lines 57 and
      58, and zero esbuild calls, at line 59.
    - Then the test edits `value.ts`, sends the plan with the edit, and
      asserts one esbuild call. A third pool compiles the edit without a plan,
      and the test asserts equal output, at line 72.
  - How the plan and the disk record come about:
    - The sidecar returns a plan only for complete and durable evidence with
      no `uncaptured` marker, in `capturedPlan` at
      `packages/mokly/src/sidecar/captured-plan.ts:8` to line 18.
    - After a full capture, `complete_bundle` saves a durable recipe to the
      store, at `pool_bundle_cache.rs:131` to line 143. `DurableRecipe::new`
      admits only captured and durable evidence, at `durable_recipe.rs:32`.
    - The warm pool loads in `seed_bundle`, at `pool_bundle_cache.rs:62`. Line
      63 sets the cause to the cache outcome of the load, or to `NoRecord`
      when the load gives none.
    - `complete_bundle` reports `Hit` only when the compile reuses the
      restored disk runtime, at line 113 to line 124. Otherwise it reports the
      cause, which a save can replace, at line 130 to line 144.
    - In passing diagnostic runs, the first result reports `NoRecord`,
      because no record exists yet, and its save reports `Written`. The warm
      result reports `Hit`.
  - The failure:
    - On 2026-11-19, the job `Native (macos-26)` of CI run 44612675190 failed.
      The run tested PR #356 at commit `9c34d16a4`. That pull request changes
      Git command waits. Its copy of the test file is byte-identical to the
      copy at `76386b810`.
    - Its step `Run native verification` ran
      `cargo xtask check --suite native`. There,
      `cargo test --locked --workspace --no-fail-fast` failed with status 101.
    - The `bundle_pool_tests` binary ran 3 tests and reported
      `1 passed; 2 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.73s`.
    - The failure text of this test is:

      ```text
      thread 'a_warm_inexact_compilation_supplies_the_first_edit_plan_with_one_attempt_and_equal_output' (170207) panicked at crates/mokly-compare/tests/bundle_pool_tests.rs:149:5:
      assertion `left == right` failed
        left: Some(NoRecord)
       right: Some(Hit)
      ```

    - Line 144 of that copy passed, so the first capture returned its plan
      with two imports. So its evidence was complete and durable, with no `uncaptured`
      marker. But the warm pool found no disk record.
    - The log prints no write outcome, no load outcome, and no evidence flags.
    - The same binary also failed
      `fresh_sidecars_skip_esbuild_and_changed_inputs_replace_the_disk_recipe`
      at line 205 of that copy, with `left: Some(StampMismatch)` and
      `right: Some(Hit)`.
      The third test passed. The `Native (windows-2025)` job of the run passed.
    - Failed job:
      https://github.com/mokly-ai/mokly/actions/runs/44612675190/job/135873187612
  - The rerun: a fresh CI run of PR #356, run 44617201041 at commit
    `bb16efe3d`, passed. Its `Native (macos-26)` and `Native (windows-2025)`
    jobs passed. The test file is the same there. Run:
    https://github.com/mokly-ai/mokly/actions/runs/44617201041
  - Local runs before the class fix, on Linux with 4 CPUs at `76386b810`,
    with the default test threads and no test filter:
    - The unchanged binary ran 10 times. Nine runs passed. One run failed the
      replacement test at line 205 of that copy, with `StampMismatch` against
      `Hit`. In
      total, 29 tests passed and 1 failed. This test passed 10 of 10 runs.
    - With local observation-only diagnostics, 10 more runs passed all 30
      tests.
  - Controlled probes before the class fix: a local diagnostic made one
    change at one chosen point. It created and removed one folder in
    `target/tmp`, the parent of the fixture root in that copy.
    - A change after the durability prepare step of the first capture left
      its evidence complete but not durable. The sidecar returned no plan, so
      the test failed earlier, at the plan `unwrap()` of line 144 of that copy.
      This is not the CI failure.
    - A change at the store offer, just before the save, just before the warm
      load, or after the first result did not fail the test. In each of these
      four runs, the first save reported `Written`, the warm result reported
      `Hit`, and every assertion passed.
    - For the replacement test, a change during its changed capture
      reproduced the failure at line 205 of that copy. That capture was
      complete but not
      durable, so it saved nothing. The next pool loaded the old record, which
      failed its input check with `StampMismatch`, and compiled again. This
      chain explains the replacement failure only.
  - The class fix: on 2026-11-19, the performance orchestrator chose to give
    eight tests, this test included, private owner folders under
    `target/durable-capture-fixtures` in the checkout. It also chose to keep
    this mode open in this item. It rejected a hold of the class fix until a
    natural trace of this mode.
  - `durable_fixture::create` in
    `crates/mokly-test-support/src/durable_fixture.rs` serves the six Rust
    tests. `durableRoot` in `tests/helpers/durable_fixture.ts` serves the two
    Node tests. Each helper creates every shared folder and every owner folder
    of its runtime before it returns a fixture. Nobody has shown that the
    class fix removes this mode.
  - Suspected source: unknown. No local run or probe reproduced this mode,
    and no evidence shows a product defect.
- **Problem:** The warm test failed once in macOS CI with the cache outcome
  `NoRecord` instead of `Hit`, after its first capture returned a durable
  plan. No local run or probe reproduced this mode, and the CI log does not
  show why the warm pool found no disk record.
- **Impact if no action:** CI can fail at random on this test, and each
  failure costs a rerun. The failed macOS job took about 23 minutes. If
  the source is in product code, a durable compilation can miss the disk
  cache, and a later process compiles again.
- **Root question:** How does the warm bundle pool test prove its disk hit on
  every run, also on a macOS CI runner?
- **Options:**
  - **A.** Change nothing, and add each recurrence with its failure text to
    this item. Cost: CI stays flaky, and the source stays unknown. Effort:
    Small.
  - **B.** Make a later failure name its reason. Since the class fix, the
    message of the assertion at line 51 prints the flags of the first capture.
    B adds the rest. Examples are the cache outcome of the first result, the
    flags of the warm result, and the file list of the cache folder. Keep
    every assertion. Cost: a small test change, and the next failure can take
    many CI runs. Effort: Small.
  - **C.** Reproduce and trace, and commit nothing.
    - Run the complete `bundle_pool_tests` binary many times, with the
      default test threads, also on macOS. Count the failures, and record the
      counts under `.context/`.
    - With local diagnostics in the sidecar and the core, record the
      `complete`, `durable`, and `uncaptured` flags of each capture. Record
      the disk admission, the write outcome, the load outcome, and whether
      the sidecar restored a loaded record. The store's `load` and `save` are
      at `crates/mokly-compare/src/bundle_store.rs:73` and line 138.
    - Keep every assertion, so that a failing run stops where the CI run
      stopped.
    - Cost: machine time, macOS runs, and an unknown number of runs. This
      mode appeared in none of the 20 local runs. Effort: Medium.
  - **D.** After B or C names the cause, fix it, and keep every assertion. A
    cause in the test or its fixture gets a deterministic test fix. A cause in
    product code is a product bug: add a failing test first. Bring each
    product change to the performance orchestrator before the fix. Cost:
    unknown until the cause is known. Effort: Medium.
- **Left out:**
  - A retry, a sleep, a repeat, a skip, a quarantine, a longer time limit, or
    a weaker assertion. The testing rules forbid each of them without the
    user's approval, because each hides the defect. The performance
    orchestrator authorized none of them.
  - Running the tests one at a time, or any other serialization. It changes
    the runner only to make the test pass, and it names no cause.
  - A product fix before a trace. No evidence shows a product defect.
  - A hold of the class fix until a natural trace of this mode. The
    performance orchestrator rejected it on 2026-11-19, because the wait
    would delay the reproduced class fix.
- **Wider fix:** None yet, because the defect class is unknown until a trace
  names the cause.
- **Previous examples:** The replacement test of the same binary failed in the
  same CI run, and a controlled probe reproduced its chain, as the background
  says. The class fix covers that test. Its chain does not explain this mode.
- **Recommendation:** C. It names the cause under the conditions of the
  failure before any change, as the testing rules require, and it changes
  nothing in the repository. B is the next step when C cannot reproduce the
  failure, and D follows when the cause is known.
- **Action:** fix after merge, apply C, because on 2026-11-19 the performance
  orchestrator kept this mode open while the class fix merges. The testing
  rules require a named source before a fix. If C cannot reproduce the
  failure or name its source, the testing rules give the fix the outcome
  `ask the user`.
