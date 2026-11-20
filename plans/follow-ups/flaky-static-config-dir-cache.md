# Static configDir cache test compiles again

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the complete gate of
  `calummoore/fu-config-repository-root-symlink-v8zb`.
- **Location:** `tests/static_config_dir.test.ts:57`,
  `tests/helpers/config_dir.ts:16`, and
  `tests/helpers/native_resolution.ts:57`.
- **Reason:** The unchanged cache-reuse test failed once and passed on rerun.
  Its cause is outside the repository-root containment fix.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Bundle compile:** the `sidecar.bundle.compile` start event in the
    CLI's timing output.
  - **configDir target:** a path in the fixture's TypeScript configuration,
    relative to that configuration's directory.
- **Background:**
  - The asynchronous test is named
    `strict builds replace cached HTML after an earlier configDir paths target appears`.
  - `configDirPaths` creates a real temporary root with two resolution
    targets: `${configDir}/one/*` and `${configDir}/two/*`.
  - Only `two/value.js` exists initially. It exports `two`.
  - The test uses another temporary root for its cache. It passes that path
    as `XDG_CACHE_HOME` and `LOCALAPPDATA` to each build.
  - Each build runs with `--strict --no-changes --sidecars=1 --debug-timings`
    and writes to `.context/site`.
  - The first build must compile once and render `two`.
  - The second unchanged build must return the same HTML without a bundle
    compile. Line 57 asserts that its compile count is zero.
  - The test then creates `one/value.js`, which exports `one`.
    A fresh bundle must select it. The next CLI build must compile once
    and render `one`.
  - On Linux x86_64 with Node 24.22.1 and four CPUs, `cargo xtask check`
    stopped in its Node suite at about 20:32 UTC.
  - The Node suite ran two test files at once. It reported 3,130 tests:
    3,129 passed, one failed, and zero skipped or cancelled, in 388.9 seconds.
  - The only failure was:

    ```text
    strict builds replace cached HTML after an earlier configDir paths target appears
    Error [ERR_TEST_FAILURE]: Expected values to be strictly equal:
    1 !== 0
    at TestContext.<anonymous> (tests/static_config_dir.test.ts:57:10)
    ```

  - The second build succeeded and returned the expected HTML before this
    assertion. Its timing output counted one compile instead of zero.
  - The failure occurred before the test created the earlier target.
  - With no source or test change, the isolated rerun passed:

    ```sh
    npm test -- tests/static_config_dir.test.ts --test-name-pattern='strict builds replace cached HTML after an earlier configDir paths target appears'
    ```

  - The rerun reported one passed test, zero failures, and zero skipped,
    in 1.763 seconds of test-runner time.
  - The test, its helpers, sidecar code, and bundle-cache code match
    `origin/main` at `f4f0082fd4bc8a6ffb2575f7416c37a216dfd0dd`.
  - The containment change has no effect on this fixture's ordinary
    repository root. Its shared predicate preserves the old checks there.
  - Suspected source: file-system evidence or cache admission differs while
    other test files run. This is unconfirmed. The assertion prints no
    reason for the cache miss, so the actual source remains unknown.
- **Problem:** An unchanged second build compiled again during the complete
  suite. The same test passed alone with no code change.
- **Impact if no action:** The complete gate can fail on an unchanged test.
  The failed Node run alone cost about six minutes.
- **Root question:** How does this test prove unchanged-build reuse on every run?
- **Options:**
  - **A.** Add the existing timing output to the failed assertion's message.
    Keep every assertion. A later failure may then name the cache miss.
    This does not identify or fix the source by itself. Effort: Small.
  - **B.** Reproduce the failure with temporary diagnostics. Record the cache
    admission or miss reason and the affected path under the complete
    Node suite. Commit nothing during this investigation. Effort: Medium.
  - **C.** After A or B names the cause, make the fixture deterministic
    or fix the cache defect. Keep every assertion. Add a failing regression
    first when the cause is product code. Effort: Medium.
- **Left out:**
  - Change nothing. It leaves the gate failure unexplained.
  - Retries, sleeps, skips, longer time limits, and fewer concurrent test
    files. These changes hide the failure without naming its cause.
- **Wider fix:** None yet. The source must be known before a structural fix
  can prevent it.
- **Previous examples:** No earlier item names this test. The saved native
  plan test also lost reusable evidence in a complete suite on 2026-11-18.
  No shared cause is confirmed.
- **Recommendation:** B. It names the actual source before any fix.
  A can improve evidence when B cannot reproduce it. C follows a known cause.
- **Action:** fix after merge, apply B, because the test and cache code are
  unchanged and the containment fix does not affect this fixture.
  An unknown source blocks a code fix until an investigation names it.
