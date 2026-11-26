# PostCSS build input recheck flakes

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the complete gate of
  `calummoore/fu-build-render-once-test-ekcm`.
- **Location:** `crates/mokly-cli/tests/changes_javascript_tests.rs:74`,
  `crates/mokly-cli/tests/changes_support/mod.rs:54`, and
  `crates/mokly-static/src/fingerprint.rs:224`.
- **Reason:** On 2026-11-26 the user chose option A, and the branch
  `calummoore/ci-speed-flaky-decisions-a` applied it. The cause waits for the
  next failure, which now prints the full rejected path.

- **Source:** Implementation.
- **Category:** Test.
- **Background:**
  - The Rust integration test is named
    `historical_postcss_relative_reads_change_only_the_owned_component`.
  - It creates a Git fixture with a React component, an HTML screen,
    a stylesheet, and a PostCSS plugin.
  - The plugin reads `tone.txt` relative to the fixture and reports that
    file as a dependency. The test changes its value from red to blue.
  - The fixture links `node_modules` to the repository's installed packages.
    Its helper runs the real build command with a private temporary cache.
  - The build must succeed and report one changed entry with empty stderr.
  - The final static input check rejects changed inputs before publication.
  - On Linux with Node 24.22.1 and Git 2.56.1, the complete gate failed
    at the build's success assertion on line 92.
  - The test binary reported six passes and one failure in 22.02 seconds.
    The failure text was:

    ```text
    historical_postcss_relative_reads_change_only_the_owned_component
    assertion `left == right` failed: ✖ The static output could not be written.  [mokly/export-invalid]
      Inputs changed during the build: /home/user/code/mokly/node_modules/@babel/co…
      Fix the reported output directory or input and retry.
      left: Some(1)
     right: Some(0)
    ```

  - The rich terminal output shortened the dependency path. The full path
    and the changed stamp were not available in the failure output.
  - No source or test change preceded the isolated rerun:

    ```sh
    CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 cargo test --locked -p mokly-cli --test changes_javascript_tests historical_postcss_relative_reads_change_only_the_owned_component -- --exact
    ```

  - The rerun passed with one pass, zero failures, zero ignored tests,
    and six filtered tests in 3.74 seconds.
  - The same test passed in two earlier workspace-wide runs on this tree.
  - The failure occurred after a cloud computer resume. No other test,
    install, or build command ran beside the gate.
  - Suspected source: shared dependency file stamps or metadata changed
    during input capture and recheck. Resume-time file restoration is
    another possible source. Neither source is confirmed.
  - The original render-once timing change touched neither this test nor
    its inputs. That is why the earlier branch deferred this flake.
  - Before this investigation, this item recorded `fix after merge, apply B`.
    On 2026-11-20, the user confirmed B and asked for a decision that includes A
    when B names no source.
  - B ran on 2026-11-20 at commit `a2f61eb53`. The host was Linux
    `box-node-a33854b8325a11d9`, x86_64, with four CPUs, 7.8 GiB of memory,
    and ext4. It used Rust 1.98.1, Node 24.22.1, npm 11.21.0, and Git
    2.56.1.
  - The checkout had no `node_modules` at the start. A fresh `npm ci` with
    npm 11.19.1 installed the dependencies, and then npm was upgraded. The
    machine did not resume with an installed `node_modules`, so B did not
    test file restoration after a resume. That source stays unconfirmed.
  - Temporary Rust trace code recorded the full path, the values, the
    metadata, the file stamps, and the digests of each rejected input.
  - Two probes changed a private `tone.txt` and a private
    `mokly.config.json` on purpose during a build. Each build rejected its
    changed input. The trace kept the full path, the digests before and
    after, the file identity, and the metadata. The probes check the trace
    only, and they do not reproduce the flake.
  - Cargo built with
    `CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 CARGO_BUILD_JOBS=2`.
    `RUST_TEST_THREADS` was not set.
  - A complete run started the test binary of `changes_javascript_tests`
    directly, so all seven tests ran. Its name holds a hash of that build.
    An exact run gave it the arguments
    `historical_postcss_relative_reads_change_only_the_owned_component --exact`.
    A load phase ran the workspace command beside the complete runs:

    ```sh
    target/debug/deps/changes_javascript_tests-37654bc0b9b4aca1
    MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test cargo test --locked --workspace
    ```

  - No repetition rejected an input. Seconds is the sum of the direct runs. Each
    exact run also filtered out the other six tests:

    | Runs                                          | Passed runs | Passed tests | Seconds |
    | --------------------------------------------- | ----------- | ------------ | ------- |
    | Complete, traced, alone                       | 20 of 20    | 140          | 448.706 |
    | Complete, traced, beside the load             | 20 of 20    | 140          | 463.102 |
    | Exact, traced, alone                          | 20 of 20    | 20           | 154.877 |
    | Complete, not traced, alone                   | 10 of 10    | 70           | 229.760 |
    | Complete, traced, beside a setup-limited load | 20 of 20    | 140          | 459.020 |

  - The setup-limited load lacked `packages/native-linux-x64-gnu/bin/mokly`,
    so its workspace command failed. A full `npm run build` fixed that
    before the other load phase.
  - In the other load phase, the first workspace command failed an
    unrelated test, which the
    [catalogue starvation item at its last commit](https://github.com/mokly-ai/mokly/blob/b343edfbc/plans/follow-ups/flaky-catalogue-unread-body-starvation.md)
    records.
    In both load phases, the second workspace command was stopped after the
    complete runs ended. Neither phase completed the full workspace suite.
  - The trace code is removed, and clean test and native package builds
    passed after its removal. No product code, test, or assertion changed.
  - B named no source. The full path and the changed value of the original
    rejection stay unknown. C did not start, and no fix exists.
- **Problem:** A build with no intended input change failed its final input
  check. The same test passed alone without a code change.
- **Impact if no action:** The complete gate can fail intermittently.
  The shortened diagnostic does not identify the input that changed.
- **Root question:** How can this test verify PostCSS dependency changes
  without an unexplained static input rejection?
- **Options:**
  - **A.** Add the full input rejection to this test's failure output.
    Keep every assertion. A later failure can then name the dependency,
    but this does not resolve the cause. Effort: Small.
  - **B.** Reproduce and trace the input rejection with temporary diagnostics.
    Record the full path and its before and after evidence. Commit no fix
    until the trace names the source. On 2026-11-20, B ran and named no
    source. Effort: Medium.
  - **C.** After B names the source, isolate mutable fixture inputs or fix
    the product defect. Keep the static input check and every assertion.
    Add a failing regression first for a product defect. Effort: Medium.
- **Left out:** Change nothing leaves the gate failure unexplained.
  Retries, sleeps, skips, longer time limits, and weaker input checks hide
  the failure without identifying its cause.
- **Wider fix:** None yet. A trace must name the source before a structural
  change can prevent it.
- **Previous examples:** Other tests have lost file-system reuse evidence.
  No earlier item names this test or this static input rejection. PR #360
  found `ETXTBSY` when a child inherited a writable fixture handle. PR #352
  found sibling tests changed a shared fixture parent under `target/tmp`
  during capture. Neither cause was confirmed in this investigation.
- **Recommendation:** A. The first recommendation was B, before the
  investigation of 2026-11-20. B named no source in 90 runs. A makes a later
  failure print the full rejected path, so that the failure can name the
  dependency. C still needs a named source.
- **Action:** fix after merge, apply C when a failure names the rejected
  path, because the user chose A on 2026-11-26 to get that evidence first.
- **Applied:** On 2026-11-26, the test started to run its build through
  `run_full_width` in `crates/mokly-cli/tests/changes_javascript_tests.rs`.
  It sets `MOKLY_TEST_STATIC_COLUMNS` to 4096, so the rich output of the
  debug build no longer shortens a long path with `…`. Every assertion
  stayed.

**Reproduction, added 2026-11-20** from
`calummoore/canvas-redesign-m1-cloud-viewer-mockups-1osn`: after an edit to
one stylesheet under `docs/mockups/styles/product/` and no other change,
`npm run mockups:build` failed every time with
`[mokly/export-invalid] Inputs changed during the build`. Deleting the cached
entry bundles under the Mokly cache directory made the next build pass. This
gives a repeatable starting point for option A's trace.

**Check, added 2026-11-25** from `calummoore/ci-speed-flaky-follow-ups-a-ube3`:
the reproduction above no longer holds on `main` at `1f2f00024`. On Linux
with Node 24.22.1, `npm run mockups:build` passed once. Then one new rule was
added to `docs/mockups/styles/product/account.css`, with no other change. Two
more runs of `npm run mockups:build` both passed, with no
`[mokly/export-invalid]` line. The commit that removed the reproduction is not
known. So option A or B has no repeatable starting point, and the flake of the
Rust test stays unexplained.
