# PostCSS build input recheck flakes

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the complete gate of
  `calummoore/fu-build-render-once-test-ekcm`.
- **Location:** `crates/mokly-cli/tests/changes_javascript_tests.rs:74`,
  `crates/mokly-cli/tests/changes_support/mod.rs:54`, and
  `crates/mokly-static/src/fingerprint.rs:224`.
- **Reason:** This unchanged test failed in the complete gate and passed
  alone. The render-once timing test does not change its code or inputs.

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
    until the trace names the source. Effort: Medium.
  - **C.** After B names the source, isolate mutable fixture inputs or fix
    the product defect. Keep the static input check and every assertion.
    Add a failing regression first for a product defect. Effort: Medium.
- **Left out:** Change nothing leaves the gate failure unexplained.
  Retries, sleeps, skips, longer time limits, and weaker input checks hide
  the failure without identifying its cause.
- **Wider fix:** None yet. A trace must name the source before a structural
  change can prevent it.
- **Previous examples:** Other tests have lost file-system reuse evidence.
  No earlier item names this test or this static input rejection.
- **Recommendation:** B. Identify the actual input change before changing
  the test or the product. A can improve a later failure's evidence.
- **Action:** fix after merge, apply B, because this branch changes only
  the render-once timing test. An unknown source blocks a code fix until
  an investigation names it.
