# Serve plan test flakes without a saved plan

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the complete gate of the branch
  `calummoore/mokly-absolute-paths-evidence-fix-zqzl`, on the integrated tree
  at commit `e2078588b` with the final source of that branch.
- **Location:** `crates/mokly-render/tests/integration/plan_invalidation_tests.rs:115`,
  `crates/mokly-render/tests/integration/plan_support.rs:54` to line 119,
  `crates/mokly-render/tests/integration/plan_support.rs:164` to line 176,
  `crates/mokly-render/src/edit_plans.rs:47`,
  `crates/mokly-sidecar/src/pool.rs:129` to line 133, and
  `packages/mokly/src/sidecar/capture-durability.ts:76` to line 92.
- **Reason:** The failing test function and its fixture are byte-identical to
  `origin/main`, and the source is unknown, so a later branch must reproduce
  the failure before any fix.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Plan record:** the resolution plan of a captured compile that the core
    of a Serve head keeps. A later Serve edit request carries it while the
    record's evidence still matches the files.
  - **Durable evidence:** reuse evidence whose capture witnesses saw the same
    identity and change stamps, at the first observation and after the
    compile, for each directory on the path to each recorded input.
  - **`CARGO_TARGET_TMPDIR`:** the temporary folder that Cargo gives to
    integration tests. Every test of one target directory shares it.
- **Background:**
  - The test is
    `serve_edit_plans_follow_content_import_candidate_manifest_configuration_and_link_changes`,
    in the `integration_tests` binary of `mokly-render`. It loops over nine
    cases. For each case, it builds a new `Fixture`, runs a captured compile
    with `prepare`, switches to Serve edits with `edit`, changes files, and
    prepares again. Then it asserts the modules, whether the core sent a
    saved plan, and the count of esbuild attempts. The cases "content" and
    "existing import" expect a plan.
  - In the "existing import" case, the fixture writes `existing.ts` with
    `export const extra=1;` before the first compile. The edit rewrites
    `entry.ts` to import from both `./value.ts` and `./existing.ts`. The test
    expects the modules `entry.ts`, `existing.ts`, and `value.ts`, a sent
    plan, and three esbuild attempts.
  - `Fixture::new`, at `plan_support.rs:54` to line 56, calls
    `Fixture::in_parent` with `CARGO_TARGET_TMPDIR`. `in_parent`, at line 58
    to line 119, creates the folder with `tempfile::tempdir_in(parent)`. It
    starts a real Node sidecar from `packages/mokly/dist/sidecar.js` in a pool
    of size 1, with a mock bundle store that always misses and accepts each
    write. It writes `package.json`, `tsconfig.json`, `entry.ts`, and
    `value.ts`. `sent_plan`, at line 164 to line 176, reads the last `bundle`
    request and checks `request.plan.is_some()`.
  - The fixture's `Launch` sets `capture_durability: false`. But `Pool`
    replaces that value with `self.bundle_store.is_some()` at spawn, at
    `crates/mokly-sidecar/src/pool.rs:129` to line 133. The fixture installs
    a bundle store, so the worker gets a capture hint through
    `crates/mokly-sidecar/src/process_factory.rs:193` to line 197, and the
    sidecar checks durability.
  - The core keeps a plan record only from captured and durable evidence, at
    `crates/mokly-render/src/edit_plans.rs:47`. It sends the plan only while
    the evidence of the record still matches. So `left: false` means that no
    record was kept, or that its evidence check failed before the edit. No
    log shows which.
  - The durability check witnesses every directory on the path to each
    recorded input, up to the filesystem root, at
    `packages/mokly/src/sidecar/capture-durability.ts:76` to line 92. Section
    "Stable Capture" of `docs/protocol/mokly-base-cache.md` says that an
    unrelated change in such a directory can make the evidence unstable. A
    change too recent for the time resolution of the file system has the
    same effect, after one wait of at most 50 ms.
  - Only the two tests of `plan_invalidation_tests.rs` use this fixture. The
    second, `serve_plans_reject_an_added_earlier_absolute_paths_target`, is
    new on the branch of this item. At both gate failures, it created its own
    fixture folder in the same `CARGO_TARGET_TMPDIR`, in a parallel test
    thread. Since then, it creates its fixture with `Fixture::in_parent`
    under a private temporary folder in the repository's `.context` folder.
    The failing test still uses `Fixture::new`.
  - The first failure:
    - On 2026-11-18 the complete gate `cargo xtask check` failed in
      `cargo test --locked --workspace` with status 101. The
      `integration_tests` binary of `mokly-render` reported 102 passed, 1
      failed, and 0 ignored, in 68.00 s.
    - The failure text is below. At that commit the assertion was at line 113. Two lines added above the test later moved it to line 115.

      ```text
      thread 'integration::plan_invalidation_tests::serve_edit_plans_follow_content_import_candidate_manifest_configuration_and_link_changes' (881572) panicked at crates/mokly-render/tests/integration/plan_invalidation_tests.rs:113:9:
      assertion `left == right` failed: plan existing import
        left: false
       right: true
      ```

  - The rerun: the exact isolated rerun passed, with 1 passed, 0 failed, 0
    ignored, and 102 filtered out, in 1.91 s. It used `--exact` with the full
    name, which starts with `integration::plan_invalidation_tests::`. A
    filter without that prefix matches no test and passes with zero tests.
  - Later runs: in a second complete gate of the same branch, this test
    passed. Ten runs of the two plan tests together, with both fixtures in
    the shared folder, all passed, with 2 passed and exit 0 in each run. So a
    parallel sibling alone did not reproduce the failure.
  - Suspected sources, from code reading only. No trace of this test
    supports any of them:
    - Shared ancestor churn. At the first failure, the sibling test, or
      another process, could change `CARGO_TARGET_TMPDIR` or another
      ancestor folder during the first captured compile. The evidence would
      then not be durable, and the core would keep no plan record. The new sibling test failed from this kind of churn,
      as the previous examples say, but that reproduction does not trace
      this failure.
    - Capture maturity. The fixture writes its files just before the first
      compile. On a loaded machine, a stamp can still be too recent after
      the wait, so the evidence is not durable.
    - A recorded input changes between the captured compile and the edit
      check, so the core sends no plan.
  - The second failure:
    - On 2026-11-19 the complete gate `cargo xtask check` failed in
      `cargo test --locked --workspace` with status 101. The branch was
      `calummoore/mokly-git-command-wait-kvvh`. Its base and the current
      `origin/main` were both commit `6ae96ed08`. The `integration_tests`
      binary of `mokly-render` reported 102 passed, 1 failed, and 0 ignored,
      in 71.79 s.
    - This time the first case, "content", failed. Its module assertion at
      line 113 passed. So the second `prepare` returned the expected modules
      `entry.ts` and `value.ts`. The loop stopped there, so the "existing
      import" case did not run. The failure text:

      ```text
      thread 'integration::plan_invalidation_tests::serve_edit_plans_follow_content_import_candidate_manifest_configuration_and_link_changes' (332883) panicked at crates/mokly-render/tests/integration/plan_invalidation_tests.rs:115:9:
      assertion `left == right` failed: plan content
        left: false
       right: true
      ```

    - The exact isolated rerun passed, with 1 passed, 0 failed, 0 ignored,
      and 102 filtered out, in 3.77 s. It used the full name with the
      `integration::plan_invalidation_tests::` prefix:

      ```text
      cargo test --locked -p mokly-render --test integration_tests integration::plan_invalidation_tests::serve_edit_plans_follow_content_import_candidate_manifest_configuration_and_link_changes -- --exact --nocapture
      ```

    - Before that gate, `cargo xtask check --suite repository` passed on the
      same code, with this test and all 2,704 Rust tests.
    - The test and its fixture were byte-identical to `origin/main` at
      `6ae96ed08`. The fixture uses `WorkingTree`, `SystemPhysicalInputs`, a
      real Node sidecar, and `mokly_sidecar::process_clock::SystemClock`.
      Neither file uses `mokly_git`. `mokly-render` lists `mokly-git` only as
      a development dependency. So the Git runner and file listing changes of
      that branch are not on the path of this test.
    - In this run, the Cargo target folder was
      `.context/git-command-wait/target-branch` in the repository. So
      `CARGO_TARGET_TMPDIR` was inside `.context`. The sibling test creates
      and removes its fixture folder directly in `.context`. So in this run,
      that folder was a shared ancestor of both fixtures.
    - No trace recorded this failure. The evidence does not show whether
      shared ancestor churn, capture maturity, or a changed input caused it.
  - The third failure:
    - On 2026-11-19 a second complete gate `cargo xtask check` of the same
      branch failed in `cargo test --locked --workspace` with status 101. It
      used the same Cargo target folder inside `.context`, so the same shared
      ancestor setup held. The test and its fixture were still byte-identical
      to `origin/main` at `6ae96ed08`. The `integration_tests` binary of
      `mokly-render` reported 102 passed, 1 failed, and 0 ignored, in 60.48 s.
    - The "existing import" case failed again, at the same line. The
      "content" case passed before it. The failure text:

      ```text
      thread 'integration::plan_invalidation_tests::serve_edit_plans_follow_content_import_candidate_manifest_configuration_and_link_changes' (403437) panicked at crates/mokly-render/tests/integration/plan_invalidation_tests.rs:115:9:
      assertion `left == right` failed: plan existing import
        left: false
       right: true
      ```

    - No isolated rerun followed this failure. The user allowed one isolated
      rerun, and the rerun after the second failure already passed.
    - No trace recorded this failure. Its source remains unknown.
- **Problem:** The test fails now and then. In three complete gates, a Serve
  edit request carried no saved plan where the test expects one. The failures
  were in the "existing import" case, then the "content" case, then the
  "existing import" case again. An isolated rerun passed after each of the
  first two failures. The source remains unknown. In the last two failures,
  both plan fixtures shared the `.context` ancestor folder.
- **Impact if no action:** A complete gate can fail without a code defect,
  and each such failure costs a gate run. If the source is in product code,
  a Serve edit can also lose its saved plan and run the native attempt
  again.
- **Root question:** How can the Serve plan test check plan reuse in any
  order and in parallel, without depending on unrelated file system
  activity?
- **Options:**
  - **A.** Reproduce and trace, with no committed change. Run the
    `integration_tests` binary of `mokly-render` many times, with the sibling
    test in parallel, and record the pass counts under `.context/`. Add a
    local diagnostic that logs the `complete` and `durable` flags of the
    first captured compile of each case, and the first witness that
    changed. Then name the source. Effort: Medium.
  - **B.** Run the two plan tests in turn, for example as cases of one test
    or behind one shared lock, so that their fixtures never overlap. It
    removes the sibling churn only, and it keeps every assertion. Since the
    sibling moved to a private folder, B matters only for a later test that
    shares the folder. Effort: Small.
  - **C.** Before the first compile, set the stamps of the written files and
    folders to a time older than the file system resolution, instead of a
    wait. It removes the recent-change case only, and it keeps every
    assertion. Effort: Small.
  - **D.** Narrow the durability witnesses in the product, for example to the
    folders between each input and its source or dependency root. It removes
    unrelated ancestor churn from every capture, also in real Serve
    sessions. It changes the stable-capture rule of
    `docs/protocol/mokly-base-cache.md`, so it needs the user. Effort:
    Large.
  - **E.** Create this test's fixtures with `Fixture::in_parent` under a
    private parent folder that no other test changes during a capture, as
    the new sibling test now does. It removes parent-folder churn from
    sibling tests, and it keeps every assertion. It does not name the source
    of this failure, so it follows A. Effort: Small.
- **Left out:**
  - Add a precondition assertion that the first compile kept a plan record,
    with a message that names the cause. It names the source only after a
    later failure, and A names it now.
  - Retry the test, add a sleep, raise a time limit, or skip the case. The
    testing rules forbid each of these without the user's approval, and each
    hides the source.
  - Assert the plan only when the first evidence is durable. It loosens an
    assertion and hides the flake.
  - Replace the durability check with a test double. It replaces the code
    under test.
- **Wider fix:** D, if a reproduction confirms unrelated ancestor churn. It is
  blocked, because it changes the stable-capture rule.
- **Previous examples:**
  - `plans/follow-ups/flaky-program-environment-probe.md` records another
    flaky test whose source was unknown at the first failure.
  - On the branch of this item, the new sibling test
    `serve_plans_reject_an_added_earlier_absolute_paths_target` failed in the
    second complete gate with "Mock for BundleStore::save was never called.
    Dead mocks should be removed." A reproduction created and removed a
    sibling folder in `CARGO_TARGET_TMPDIR` right after the durability
    preflight of the capture. The first observation of
    `target/absolute-paths-check/tmp` was then rejected as not mature,
    because its change time was too recent. The evidence had
    `complete: true` and `durable: false`, and the test failed with status 101. The isolated run passed with `durable: true`, and the product code
    did not change. This confirms shared-folder churn for that test only. It
    does not trace the failure of this item.
  - A new strict-build Node fixture of the same branch had a confirmed flake
    from churn in `/tmp`.
- **Related:**
  - [in-process-resolution-coherence.md](./in-process-resolution-coherence.md):
    it describes the durable check that this flake may trip. A change to
    that check can change this test. Each item can merge alone.
- **Recommendation:** A. It names the source before any change, as the
  flaky-test rule requires. B or E can follow when A confirms sibling churn,
  C when A confirms capture maturity, and D when unrelated ancestor churn is
  the source.
- **Action:** ask the user, because no option is clearly best until a
  reproduction names the source.
