# Strict configDir build test misses cache reuse

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the second complete gate of the branch
  `calummoore/mokly-flaky-saved-plan-test-5sod` at commit `6ae96ed08`.
- **Location:** `tests/static_config_dir.test.ts:16` to line 64, with the
  failed assertion at line 57, `tests/helpers/config_dir.ts:17`,
  `tests/helpers/native_resolution.ts:52` to line 61,
  `packages/mokly/src/sidecar/capture-paths.ts:59` to line 112,
  `packages/mokly/src/sidecar/capture-durability.ts:153` to line 211, and
  `crates/mokly-sidecar/src/bundle_store.rs:154` to line 157.
- **Reason:** The test, its helpers, and the product code are unchanged from
  `origin/main` on the branch that found the failure, so one fix in a separate
  branch reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Bundle cache:** the disk cache of compiled bundles under the user cache
    folder, such as `XDG_CACHE_HOME` on Linux. A later build loads from it
    instead of compiling again.
  - **Reuse evidence:** the `compiled.reuseEvidence` field of a bundle result,
    in `crates/mokly-sidecar/src/compiled.rs`. Its flags `complete` and
    `durable` decide whether the bundle cache can keep the compilation.
  - **Capture witness:** the identity and change stamps of one folder on the
    path from the file system root to a recorded input, or of one recorded
    configuration or manifest file. The sidecar checks them again after the
    compile.
  - **Mature:** a witness whose change time is at least 50 ms old when the
    sidecar first observes it. With whole-second stamps, the limit is 2.1 s.
  - **`${configDir}`:** a placeholder in a `tsconfig.json` paths target. It
    expands to the folder of the top-level configuration file, as esbuild
    does.
- **Background:**
  - A Mokly build runs a Rust core and a Node sidecar. The sidecar runs
    esbuild and returns the reuse evidence of each compilation.
  - The test makes a catalogue whose page imports `entry.mjs`, which imports
    `@/value.js`. `tsconfig.json` maps `@/*` to `${configDir}/one/*`, then to
    `${configDir}/two/*`. At first, only `two/value.js` exists.
  - The test runs this command three times, with `XDG_CACHE_HOME` and
    `LOCALAPPDATA` set to one new cache folder:
    `mokly build --strict --no-changes --sidecars=1 --debug-timings --out=.context/site`.
    It counts the `start` records of the timing stage
    `sidecar.bundle.compile`, which wraps each esbuild call.
  - The test proves that an unchanged strict build reuses the bundle cache,
    and that a new earlier mapped target replaces the cached HTML:
    - The first build must compile once and show `two`.
    - The second build has no change. It must give equal HTML with zero
      compiles, so it must load the first compilation from the bundle cache.
    - Then the test adds `one/value.js`, and the third build must compile once
      and show `one`.
  - The fixture and the cache folder come from `nativeRoot` with its default
    parent, `os.tmpdir()`. On the gate machine, that is `/tmp` on ext4. At
    least 65 files under the test folders call `os.tmpdir()`, so other test
    files create and remove folders there.
  - The core saves a compilation to the bundle cache, and loads it, only when
    its reuse evidence is complete and durable. The sidecar sets `durable` with
    `CaptureDurability`, whose class comment says that its witnesses gate disk
    saves.
  - `CapturePaths.walk` witnesses each folder from the file system root down,
    so `/tmp` is a witness in this test. `observe` rejects a witness that is
    not mature. `finish` rejects a witness whose stamp changed. Each rejection
    makes the evidence not durable.
  - Section "Stable Capture" of `docs/protocol/mokly-base-cache.md` states
    this rule. An unrelated change in a folder on the path to a recorded input
    can prevent the store. So can a change too recent for the time resolution
    of the file system. Before a compile, the sidecar waits once, for at most
    50 ms, when a recent change could otherwise make its evidence unstable.
  - PR #343, commit `3063dd8d1` of 2026-11-19, added this test and
    `tests/static_absolute_paths.test.ts`. The second test has the same three
    builds and the same reuse assertion, at its line 55. But it creates its
    fixture and its cache under a private folder in the repository's
    `.context` folder, at its lines 12 to 16.
  - The first failure:
    - On 2026-11-19 the complete gate `cargo xtask check` ran on Linux x86_64
      with 4 CPUs and Node 24.22.1. It ended at about 15:49 UTC. Its tree had
      staged changes only to `tests/helpers/plan_capture.ts` and
      `tests/sidecar_saved_plan.test.ts`, and the deletion of one resolved
      follow-up item. Only the saved-plan and plan-limit tests use
      `plan_capture.ts`.
    - The repository suite passed, with 2697 Rust tests passed and 2 ignored.
      The CI typecheck passed.
    - The Node step `npm run test:viewer:prepared` ran
      `node scripts/verification/run-viewer.mjs --strict` with two test files
      at once, `MOKLY_UNIT_CONCURRENCY=2`. It ran 586 files and reported
      `tests 3130, pass 3129, fail 1, cancelled 0, skipped 0` after 455 s.
      The gate then stopped with status 1, before the browser suites.
    - The failure text is:

      ```text
      ✖ strict builds replace cached HTML after an earlier configDir paths target appears
      Error [ERR_TEST_FAILURE]: Expected values to be strictly equal:

      1 !== 0

      Caused by:
      AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

      1 !== 0

          at TestContext.<anonymous> (/home/user/code/mokly/tests/static_config_dir.test.ts:57:10)
      ```

    - Line 57 is `assert.equal(unchanged.compiles, 0)`. Lines 53, 54, and 56
      passed. So the first build compiled once and showed `two`. The second
      build gave equal HTML, but it compiled once. The test stopped before it
      added `one/value.js`. The test file ran for 1443 ms.
    - The failure printed no evidence flags, no bundle cache outcome, and no
      standard error of the builds.
    - The absolute paths test passed in the same Node step.
  - The rerun of the first failure: right after the gate, with no source or
    build change, one isolated run passed:
    `node --import tsx --test tests/static_config_dir.test.ts`. It reported 1
    passed and 0 failed, skipped, or cancelled. The test took 3361 ms, and the
    run took 3633 ms. Nobody made a second targeted rerun.
  - Other runs: on the same machine and day, the test passed in 14 other full
    Node runs, each with 3130 tests and two files at once. They were 3
    baseline runs, 10 validation runs of the branch's test changes, and the
    Node step of the first complete gate of the same branch. That gate failed
    on a separate Markdown link test, which the branch then corrected. Later,
    the third complete gate of the same branch passed. Its Node step passed
    all 3130 tests, this test included.
  - The second failure, in CI:
    - On 2026-11-19, attempt 1 of CI run 44578048802 ran for the pull request
      of the same branch, at commit `b87d5f46e`. The parent of that commit is
      `origin/main` at `6ae96ed08`. Like the tree of the first failure, the
      commit changes only `tests/helpers/plan_capture.ts`,
      `tests/sidecar_saved_plan.test.ts`, and follow-up items.
    - The job `Viewer (Node 22.15.0)` ran on a GitHub-hosted `ubuntu-24.04`
      runner. Its step `Run viewer verification` ran
      `cargo xtask check --suite viewer`. That suite ran the same Node step,
      `npm run test:viewer:prepared`, with two test files at once.
    - In that Node step, another test file made a folder under `/tmp` with
      `os.tmpdir()`. So `os.tmpdir()` was `/tmp` there too.
    - The Node step ran from about 17:33 to 17:44 UTC. It reported
      `tests 3130, passed 3129, failed 1, skipped 0, cancelled 0` after 637 s.
    - The failure text is below. In the log, lines that another test file
      printed at the same time fall between its lines. The text leaves them
      out. It also leaves out two stack frames inside Node, as the text of the
      first failure does.

      ```text
      ✖ strict builds replace cached HTML after an earlier configDir paths target appears
      Error [ERR_TEST_FAILURE]: Expected values to be strictly equal:

      1 !== 0

      Caused by:
      AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

      1 !== 0

          at TestContext.<anonymous> (/home/runner/work/mokly/mokly/tests/static_config_dir.test.ts:57:10)
      ```

    - The assertion at line 57 failed again, after lines 53, 54, and 56
      passed. So the second build again gave equal HTML, but it compiled once.
      The failure again printed no evidence flags, no bundle cache outcome,
      and no standard error of the builds.
    - The absolute paths test passed in the same Node step. Each other
      verification job of the run passed. The summary job `Required CI`
      failed only because the Viewer job failed.
    - This failure came from another machine and another Node version than
      the first failure.
  - The rerun of the second failure: attempt 2 of the same run reran the
    failed jobs, with `gh run rerun 44578048802 --failed`. It ran the same
    commit. Its Node step passed this test and reported
    `tests 3130, passed 3130, failed 0, skipped 0, cancelled 0` after 495 s.
    The run ended with the conclusion `success`. It was the only rerun of
    this failure.
  - Suspected source: unknown. Nobody reproduced or traced either failure. The
    candidates come from code reading only:
    - Shared `/tmp` churn. Another test file changes `/tmp` during or just
      before the capture of the first build. The `/tmp` witness is then not
      mature or not stable, and the core keeps no compilation. The product
      would then follow the "Stable Capture" rule.
    - The first build keeps the compilation, but the second build does not
      load it, for a reason that the test does not print.
    - The evidence of the first build is not complete, for another reason.
- **Problem:** The test failed once in a local complete gate and once in CI.
  Each time, its second, unchanged strict build compiled again instead of
  reusing the bundle cache. After each failure, one unchanged rerun passed.
  Neither failure shows why the cache was not used.
- **Impact if no action:** The complete gate and CI can fail at random on an
  unchanged test, and each failure costs a rerun. The Node step alone takes
  about 5 to 8 minutes on the gate machine and about 8 to 11 minutes in CI. If
  the source is in product code, a real strict build can also compile again
  without need.
- **Root question:** How does the strict build reuse test prove cache reuse on
  every run, also while other test files run beside it?
- **Options:**
  - **A.** Change nothing, and add each recurrence with its failure text to
    this item. Cost: the gate stays flaky, and the source stays unknown.
    Effort: Small.
  - **B.** Make a later failure name its reason. For example, add the standard
    error of each build, or the evidence flags and the bundle cache outcome,
    to the message of line 57. Keep every assertion. Cost: a small test
    change, and the next failure can take many gates. Effort: Small.
  - **C.** Reproduce and trace under the full Node suite, with two test files
    at once, and commit nothing.
    - Run the Node step of the gate many times with a local diagnostic in the
      sidecar and the core. Count the failures. Record the pass counts under
      `.context/`.
    - On a failure, record the `complete`, `durable`, and `uncaptured` flags
      of the first build. Record the save outcome of the first build and the
      load outcome of the second build.
    - Record the first rejected witness, its path, and whether it was not
      mature or had changed.
    - Run the test file alone in a loop too, for comparison.
    - Cost: machine time and an unknown number of runs. On the gate machine,
      the observed rate was 1 failure in 16 full Node runs. CI also failed
      once, as the background says. Effort: Medium.
  - **D.** After B or C names the cause, make the test deterministic for that
    cause. Keep every assertion. For shared `/tmp` churn, give the fixture and
    the cache a parent folder that no other test changes during a capture. A
    cause in product code is a product bug: add a failing test first, then fix
    the code. Cost: unknown until the cause is known. Effort: Medium.
- **Left out:**
  - A retry, a sleep, a repeat, a skip, a quarantine, or a longer time limit.
    The testing rules forbid each of them for a flaky test without the user's
    approval, because each hides the defect. For the flaky test work of
    2026-11-19, the user also forbade each of them and a weaker assertion.
  - A weaker assertion, such as one allowed compile in the second build, or a
    check of the HTML only. The test would then no longer prove cache reuse.
  - One test file at a time, or any other lower concurrency in the Node step.
    It changes the runner configuration only to make the test pass, and it
    names no cause.
  - The private folder of the absolute paths test, before a trace names the
    cause. It can miss the real cause, and the testing rules ask for a named
    source before a fix. It stays an example for D.
  - A product change that narrows the durability witnesses. It changes the
    "Stable Capture" rule, so it needs the user. Also, nobody showed that the
    rule causes this failure.
- **Wider fix:** None yet, because the defect class is unknown until a trace
  names the cause.
- **Previous examples:**
  - [flaky-serve-plan-existing-import.md](https://github.com/mokly-ai/mokly/blob/b87d5f46ed4e4255312d2733b98eb1412d3428d5/plans/follow-ups/flaky-serve-plan-existing-import.md)
    records a Rust Serve plan test that lost its saved plan once in a complete
    gate. Its suspected source is also shared folder churn, and nobody traced
    it.
  - That item also records two cases from PR #343. Controlled churn in the
    shared Cargo temporary folder made the evidence of a Rust fixture
    `complete: true` and `durable: false`. That fixture moved to a private
    folder. A strict build Node fixture had a confirmed flake from churn in
    `/tmp`. The item does not name that fixture. Of the two strict build tests
    of PR #343, only the absolute paths test uses a private folder.
  - On the branch of this item, controlled `/tmp` churn made the final recheck
    reject `/tmp` for `tests/sidecar_saved_plan.test.ts`, with
    `complete: true` and `durable: false`. The cause was its test helper
    `tests/helpers/plan_capture.ts`, which froze the parent stamps. This test
    does not use that helper.
  - These cases show that churn in a shared parent folder can make capture
    evidence not durable. None of them traces this failure. This failure came
    from a normal full Node run, with no controlled churn and no recorded
    flags.
- **Related:**
  - [ancestor-churn-disables-durable-capture.md](./ancestor-churn-disables-durable-capture.md):
    it investigates the ancestor witness rule in real use. The suspected
    `/tmp` churn source of this item would be one case of that rule. A trace
    of this item can give it evidence, and a changed witness rule can change
    this test. Each item can merge alone.
- **Recommendation:** C. It names the cause under the conditions of the
  failure before any change, as the testing rules require, and it changes
  nothing in the repository. B is the next step when C cannot reproduce the
  failure, and D follows when the cause is known.
- **Action:** fix after merge, apply C, because the test, its helpers, and the
  product code are unchanged on the branch that found the failure, and the
  source must be named before a fix. If C cannot reproduce the failure or name
  its source, the testing rules give the fix the outcome `ask the user`.
