# Warm bundle cache test finds no disk record

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix now.
- **Added:** 2026-11-19, on branch `calummoore/mokly-flaky-saved-plan-test-5sod`
  at commit `76386b810`, from a macOS CI failure of PR #356.
- **Location:** `crates/mokly-compare/tests/bundle_pool_tests.rs:36` to line
  90, with the warm cache assertion at line 60,
  `crates/mokly-compare/tests/support/bundle_pool.rs:42` to line 161,
  `crates/mokly-compare/tests/support/bundle_pool_trace.rs:14` to line 131,
  `crates/mokly-compare/tests/support/bundle_pool_observations.rs:10` to line
  62, `crates/mokly-compare/tests/support/bundle_pool_sidecar.mjs:1` to line
  176, `crates/mokly-sidecar/src/pool_bundle_cache.rs:41` to line 150,
  `crates/mokly-sidecar/src/durable_recipe.rs:31` to line 35,
  `crates/mokly-compare/src/bundle_store.rs:73` and line 138,
  `crates/mokly-sidecar/src/bundle_outcomes.rs:5` to line 19, and
  `packages/mokly/src/sidecar/captured-plan.ts:8` to line 18.
- **Reason:** A natural recurrence on 2026-11-20 named a contended save.
  The performance orchestrator authorized a controlled trace of the lock
  holder, then a fix that keeps every assertion and adds no request wait.

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
  - Test line numbers in this background are those of commit `e272615f2`,
    unless the text names another copy. The **Location** line gives the
    lines with the diagnostics of 2026-11-20.
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
  - The record of 2026-11-19 had the kind Fix after merge. It recommended C,
    with B next when C cannot reproduce the failure, and D after the cause
    is known.
    - Its reason: on 2026-11-19 the performance orchestrator deferred this
      unknown mode, so that the class fix of the branch does not wait for its
      natural trace.
    - Its action: fix after merge, apply C, because on 2026-11-19 the
      performance orchestrator kept this mode open while the class fix
      merges. The testing rules require a named source before a fix. If C
      cannot reproduce the failure or name its source, the testing rules
      give the fix the outcome `ask the user`.
  - On 2026-11-20, the user chose B first, then C. The user allowed D only
    for a cause in the test or its fixture that a trace names. When the
    runs cannot reproduce the failure or name its source, the user asked for
    a change that adds evidence only, and for a decision.
  - The investigation of 2026-11-20 applied B, then C, on Linux:
    - It started at commit `e272615f2` of `main`. There, this item and the
      code that it names still applied.
    - The machine ran Ubuntu 24.04.4 LTS on Linux x86_64, with kernel
      6.8.0-117-generic. It had 4 CPUs, 8 GiB of memory, 2 GiB of swap, and
      an ext4 checkout. The tools were Rust and Cargo 1.98.1, Node 24.22.1,
      npm 11.21.0, and Bun 1.4.4.
    - B added test-only diagnostics. They observe the real calls and change
      no result. A failed test now prints these facts:
      - the cache outcome and the capture flags of each bundle and edit
        result
      - each real store load, save, and invalidate outcome
      - each real restore of a loaded record
      - the files of the cache folder
      - the first recorded input that differs between two compared captures
      - the path and the saved and read stamps of the first check that made
        a capture not durable
    - The test pools launch `support/bundle_pool_sidecar.mjs`. It imports the
      exported capture classes of the built sidecar, observes their calls,
      and passes each call to the original method. Then it imports the real
      built `packages/mokly/dist/sidecar.js`. It adds no filesystem probes,
      and it keeps each return value and each error.
    - C ran the complete `bundle_pool_tests` binary 50 times, with the
      default test threads and no test filter. All 50 runs passed all 150
      tests.
    - C ran the binary 50 more times under parallel load. All 50 runs passed
      all 150 tests. Each round started three complete binaries at the same
      time, one of each kind:
      - a prebuilt `config_dir_pool_tests` binary of `mokly-compare`, with
        1 test
      - a prebuilt `recipe_reuse_tests` binary of `mokly-sidecar`, with 3
        tests
      - the `bundle_pool_tests` binary, with 3 tests
    - No two running tests shared a fixture owner folder. The
      `config_dir_pool_tests` binary passed 50 of 50 runs with 50 tests. The
      `recipe_reuse_tests` binary passed 50 of 50 runs with 150 tests.
    - No Cargo build or gate ran during the runs. The builds used
      `CARGO_BUILD_JOBS=2` and `CARGO_INCREMENTAL=0`.
    - In total, 100 of 100 runs passed 300 of 300 tests, and the load passed
      200 of 200 tests. No run had a failed, ignored, measured, or filtered
      test, or a missing harness summary.
    - In each of the 100 runs, the first capture of the warm test was
      complete and durable, with no `uncaptured` marker. It returned a plan
      with two imports, and its save reported `Written`. The warm load
      reported `Hit`, and the restore succeeded. The warm save reported
      `Unchanged`, and the warm result reported `Hit`.
    - Across the 100 runs, all 1000 full bundles were complete and durable,
      with no `uncaptured` marker. The 200 edit results had the `uncaptured`
      marker `ServeEdit`, as expected. No capture failed its durability
      check.
    - One controlled probe checked the rejection output. A temporary change
      to an ignored build file created and removed one folder in
      `target/durable-capture-fixtures/rust/compare-warm-plan`. It did this
      at the finish of the first capture of the warm test.
      - The complete binary exited with status 101, with 2 tests passed and
        1 failed.
      - The warm test failed earlier than in CI, at the plan `unwrap()` after
        the first capture. That capture was complete but not durable, with
        no `uncaptured` marker and no plan. The pool offered no save.
      - The rejection output named that owner folder. Its saved ctime and
        mtime were 1795167194078392855 ns, and the read values were
        1795167194774386962 ns.
      - This probe does not reproduce this mode. In CI, the first capture
        returned a valid plan with two imports, and then the warm pool found
        no disk record.
      - The build file was restored byte for byte. All hashes of the built
        sidecar, the sources, and the archived test binaries were verified.
    - No cause is proved. The investigation made no fixture fix and no
      product fix, and no fixture fix follows from the controlled probe.
    - The runs check the diagnostics only. No fix exists, so no pass counts
      before and after a fix exist.
    - The diagnostics keep all 32 assertions of the binary, with their
      operands and expected values. They add and remove no test. They add no
      retry, sleep, repeat, skip, quarantine, longer time limit,
      serialization, gate, or lint.
    - No run on macOS took part, because no local macOS machine was
      available.
  - The diagnostic merge, accepted on 2026-11-20:
    - The performance orchestrator accepted the diagnostics at commit
      `662a5fcc4` of branch
      `calummoore/fu-flaky-warm-bundle-cache-no-record-jbfp`. The acceptance
      includes the wrapper entry `support/bundle_pool_sidecar.mjs`, under a
      fail-stop condition.
    - The user requires this stop: when `CaptureDurability`,
      `captureRuntime`, or `CaptureVolumes` is missing from
      `packages/mokly/dist/sidecar/`, the wrapper entry stops and names that
      export. It never starts the sidecar without its observers. Its static
      named ESM imports already do this.
    - `crates/mokly-compare/tests/bundle_pool_sidecar_tests.rs` exercises the
      actual wrapper entry in isolated fake module trees.
    - A branch that renames one of these exports updates the wrapper entry
      in the same branch.
    - The follow-up orchestrator found that this merge needs no further user
      decision, because it changes diagnostics only and keeps every
      assertion.
    - The cause stays unknown. The eventual fix stays the user's choice.
  - Natural recurrence on 2026-11-20, after the diagnostic merge:
    - The macOS CI job 136411016758 of run 44771759675 tested PR #424 at
      commit `06f5cbbc3`. That unrelated change left `crates/mokly-sidecar`
      and `crates/mokly-compare` equal to `main` at `78b08fdf8`.
    - The warm test failed at `bundle_pool_tests.rs:60`. Its assertion
      expected `Some(Hit)` and got `Some(NoRecord)`.
    - The diagnostics printed the first load as `Miss(Absent)` and the
      first save as `Skipped(Contended)`. The first capture had
      `complete=true`, `durable=true`, and `plan_imports=Some(2)`.
    - The warm load was `Miss(Absent)`. Its later save was `Written`.
      The first unequal captured input was `None`.
    - The initial runtime key was
      `277167f79db304d1abe78b7c0416c4e35a135745849fe4dc`.
      The warm runtime key was
      `9611ac63aac08e0393fa9706f0d8474b80d0f16c8ef71295`.
    - The other two tests of `bundle_pool_tests` passed.
    - Failed job:
      https://github.com/mokly-ai/mokly/actions/runs/44771759675/job/136411016758
    - `CachedBundles::save` in `crates/mokly-compare/src/bundle_store.rs`
      returns `Skipped(Contended)` when the compilation lookup is contended.
      `crates/mokly-compare/src/bundle_cache_read.rs` reports that outcome
      when another caller holds the entry's lock stripe.
    - This trace names the cause class. It does not name the lock holder.
  - Recorded decision on 2026-11-20: the performance orchestrator holds
    the user's delegation for speed and reliability. It authorized these
    steps without another user decision:
    - Record and push this recurrence before the fix.
    - Name the lock holder with a deterministic interleaving, an existing
      test seam, or a controlled lock. Keep temporary trace evidence under
      `.context/`.
    - If the holder can finish without writing the record, preserve the
      skipped record through the lock owner or the existing writer. Add a
      regression test that fails before the fix. Add no request wait,
      retry loop, or timeout change.
    - If the holder always writes an equal record, keep the correct skip.
      Make the test deterministic for that ordering. Keep every assertion.
    - Keep the diagnostics and `support/bundle_pool_sidecar.mjs`.
    - Stop and report the evidence when the trace does not name the holder.
    - Before opening a pull request with a save-path change, send its commit
      to the performance orchestrator for warm-restart checks on Mokly Cloud.
      Wait for its result.
- **Problem:** The warm test failed again in macOS CI with `NoRecord`
  instead of `Hit`, after a durable capture returned a plan. The natural
  trace shows that its first save skipped a held lock stripe. The holder
  is not yet known.
- **Impact if no action:** CI can fail at random on this test, and each
  failure costs a rerun. The failed macOS job took about 23 minutes. If
  the source is in product code, a durable compilation can miss the disk
  cache, and a later process compiles again.
- **Root question:** How does the warm bundle pool test prove its disk hit on
  every run, also on a macOS CI runner?
- **Options:**
  - **A.** Change nothing after the diagnostics merge. Add each recurrence
    with its failure text to this item. No fix follows without a new
    decision. Cost: CI stays flaky, and each failure costs a rerun. Effort:
    Small.
  - **B.** Make a later failure name its reason. The test-only diagnostics of
    2026-11-20, in the background, print the facts that the CI log lacked.
    They merge without a fixture or product fix, and without a user
    decision, as the background says. Keep this item open. Add the trace of
    the next natural failure to this item. When the trace names the cause, D
    follows. Keep every assertion. Cost: three more test-support files and a
    wrapper test file to maintain, and the next failure can take many CI
    runs. The wrapper entry `support/bundle_pool_sidecar.mjs` names internal
    modules and methods of the built sidecar. A rename there can fail these
    tests or silently drop an observation. Effort: Small.
  - **C.** Reproduce and trace more, before any fixture or product fix.
    - Run the complete `bundle_pool_tests` binary many more times, with the
      default test threads and the diagnostics of B, preferably on macOS.
      Count the failures, and record the counts under `.context/`.
    - When the diagnostics of B show too little, add local diagnostics in
      the sidecar and the core, and commit none of them. The store's `load`
      and `save` are at `crates/mokly-compare/src/bundle_store.rs:73` and
      line 138.
    - Keep every assertion, so that a failing run stops where the CI run
      stopped.
    - Cost: machine time, macOS runs, and an unknown number of runs. This
      mode appeared in none of the 120 local Linux runs: 20 at `76386b810`
      and 100 at `e272615f2`. Effort: Medium.
  - **D.** After B or C names the cause, fix it, and keep every assertion. A
    cause in the test or its fixture gets a deterministic test fix. A cause in
    product code is a product bug: add a failing test first. Bring each
    product change to the performance orchestrator before the fix. On
    2026-11-20 the user allowed D only for a traced cause in the test or its
    fixture. Cost: unknown until the cause is known. Effort: Medium.
- **Left out:**
  - A retry, a sleep, a repeat, a skip, a quarantine, a longer time limit, or
    a weaker assertion. The testing rules forbid each of them without the
    user's approval, because each hides the defect. The performance
    orchestrator authorized none of them.
  - Running the tests one at a time, or any other serialization. It changes
    the runner only to make the test pass, and it names no cause.
  - A product fix before a trace. No evidence shows a product defect.
  - A fixture fix based on the controlled probe of 2026-11-20. That probe
    failed earlier than CI, at the plan `unwrap()`, so it names no cause of
    this mode.
  - A hold of the class fix until a natural trace of this mode. The
    performance orchestrator rejected it on 2026-11-19, because the wait
    would delay the reproduced class fix.
- **Wider fix:** D, after a controlled trace names the lock holder.
  Preserve a record when the holder can finish without writing it.
- **Previous examples:** The replacement test of the same binary failed in the
  same CI run, and a controlled probe reproduced its chain, as the background
  says. The class fix covers that test. Its chain does not explain this mode.
- **Recommendation:** C, then D under the recorded decision of 2026-11-20.
  Name the lock holder before changing the save path or the test ordering.
- **Action:** fix now, apply C, then D when the trace names the holder.
  The natural recurrence and the performance orchestrator's decision of
  2026-11-20 replace the earlier request for a user decision. Stop and ask
  when the controlled trace cannot name the holder.
