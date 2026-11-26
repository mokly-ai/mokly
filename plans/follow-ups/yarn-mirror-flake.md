# Diagnose the Yarn Classic mirror fallback

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 192.
- **Location:** `tests/static_base_manager_mirror.test.ts:14`.
- **Reason:** The fallback happened once, the rerun passed, and nobody knows its
  source. A reproduction on 2026-11-26 did not fail, so the item waits for the
  next failure, which now records how the install ended.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Dependency tier:** the source of a base side's dependencies. Tier two
    is a private base install. Tier three uses the working tree's
    dependencies with a warning.
  - **Offline mirror:** a committed Yarn Classic folder of package archives
    that an install can use without the registry.
- **Background:** The hosted test "a cold Yarn Classic base installs
  ordinary versions from its committed offline mirror" builds a base. Its
  Yarn Classic install must use the committed mirror. It expects tier two.
  The test already writes the manager output as a test diagnostic when the
  tier is not 2, at `tests/static_base_manager_mirror.test.ts:64-65`. The
  probe records only what the install writes to standard output and
  standard error, at `tests/helpers/base_manager_tools.ts:190-196`.
  - On 2026-11-26, the branch `calummoore/ci-speed-flaky-decisions-k3dt` ran
    the test 30 times with
    `node --import tsx --test tests/static_base_manager_mirror.test.ts`, on a
    4-CPU machine with four CPU spinners, at a load average of 7 to 10. It
    passed 30 of 30 runs, none skipped, each in about 6 seconds.
- **Problem:** The test fell back to tier three instead of tier two once on
  hosted CI, in PR #200 run 40194214551, attempt 1. The unchanged rerun
  passed. The failure text was `3 !== 2`, after the CLI warning
  `base dependencies at "yarn.lock" could not be installed (installation failed); using working-tree dependencies`.
  The manager output diagnostic was empty. The failure output gives neither
  the install's exit status or signal nor Mokly's install error detail, so
  the cause is unknown.
- **Impact if no action:** The test can fail at random, and its failure does
  not give the evidence that the diagnosis needs.
- **Root question:** How should the test make a tier fallback explain its
  cause?
- **Options:**
  - **A.** Done on 2026-11-26: reproduce with the manager output captured.
    It passed 30 of 30 runs under load.
  - **B.** Apply A, and also print the manager output in the failure
    message. The test already prints the manager output as a diagnostic.
    Effort: Small.
  - **C.** Applied on 2026-11-26, the user's choice: the probe in
    `instrumentManagers` of `tests/helpers/base_manager_tools.ts` ends the
    manager output with `[manager exit code {code}]`, or with
    `[manager signal {name}]` for SIGTERM, SIGINT, or SIGHUP. An output
    without either line means a signal that Node cannot catch, such as
    SIGKILL, or a crash of the Node process.
- **Left out:** A longer timeout has no evidence, because the failure did
  not show a timeout.
- **Wider fix:** None. B's lasting diagnostic is already in place.
- **Previous examples:** The cold manager tests in
  `tests/static_base_managers.test.ts` already report the manager output as
  a test diagnostic when a build does not reach tier two.
- **Recommendation:** Wait for the next failure, and read the last line of
  its manager output diagnostic. Then fix the cause that it names.
- **Action:** fix after merge, when the next failure names the cause.
- **Done when:** The cause of a tier-three fallback in this test is fixed,
  or the user drops the item.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6503).
