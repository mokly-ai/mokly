# Parent-death test sees two Serve binaries

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-04, from the verification of the branch `calummoore/viewer-inspector-purpose`, which does not change this test.
- **Location:** `tests/browser_host_parent_death.test.ts:43`.
- **Reason:** The test is flaky without a change of the branch that saw it, so one fix in a separate branch reaches every open branch.

- **Terms:**
  - **Serve binary:** the native `mokly serve` process that a test starts
    through the shim.
  - **Sidecar:** the Node render process that the Serve binary owns.
- **Background:**
  - The test "killing the Serve binary leaves no sidecar of its browser host"
    starts Serve with one sidecar, then lists the processes of the test
    process with `processTree(process.pid)`.
  - It filters that list for commands that match `mokly serve`, and it
    asserts that exactly one Serve binary runs, at line 43.
  - On 2026-11-04 it failed once during a full Node run
    (`npm run -s test:prepared`) with
    `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 2 !== 1`
    at `tests/browser_host_parent_death.test.ts:43:14`.
  - It then passed 3 of 3 reruns alone with
    `npx tsx --test tests/browser_host_parent_death.test.ts`, and it passed
    in the later full runs.
  - On 2026-11-18 the same test failed again in CI for PR #319.
    The Viewer job on Node 22.15.0 reported `2 !== 1` at
    `tests/browser_host_parent_death.test.ts:43:14`.
    The run is https://github.com/mokly-ai/mokly/actions/runs/44320885126,
    and the failed job is `134859275542`.
  - PR #319 changes sidecar bundle code in `bundle.ts`, `plugins.ts`,
    and `recipe-size.ts`, plus its own tests.
    It changes neither this test nor the Serve process tree.
    Its owner reruns the failed job once.
    `gh run view 44320885126` showed the Viewer rerun passed in attempt 2,
    job `134870795457`, on 2026-11-18 at 14:35:48 UTC.
  - On 2026-11-18 local diagnostic repetitions with syscall tracing and
    a long Git search path passed 5 of 10 runs.
    Five runs failed with the same `2 !== 1` assertion.
    A process snapshot showed native Serve PID `58974`, below shim PID
    `58964`, and matching child PID `59014`, below native Serve.
    The trace showed PID `59014` searching for Git to run
    `git --no-optional-locks rev-parse --verify --end-of-options HEAD^{commit}`.
  - The unchanged tracked test then passed 6 of 10 runs under the same
    diagnostic conditions.
    Four runs failed with `2 !== 1`, and no run skipped the test.
  - After option A, the tracked test passed 10 of 10 normal runs and
    10 of 10 runs under those same diagnostic conditions.
    No run failed or skipped the test.
- **Problem:** The test matches command text across the test process tree.
  A forked Git child can briefly retain its native Serve parent's command
  before it executes Git.
  The test then counts the one Serve binary and that transient child.
- **Impact if no action:** The full Node run, and so the gate, fails now and
  then without a defect.
- **Root question:** How does the test find exactly the Serve binary that its
  own host started?
- **Options:**
  - **A.** Take the binary process id from the host that `serveHost`
    returns, and inspect only its tree. Effort: Small.
  - **B.** Keep the search, but wait until the process list holds one
    stable Serve binary, with an explicit readiness signal of the host.
    Effort: Small.
  - **C.** Run the test in its own process group, so that no other test
    process shares its tree. Effort: Medium.
- **Left out:** A retry or a longer wait hides the flake and breaks the
  rules of the `testing` skill.
- **Wider fix:** A. A process id that the host owns removes the search, so
  no other process can match.
- **Previous examples:** None found.
- **Recommendation:** A. The host already knows its process, and the test
  then checks exactly that process. First reproduce the flake under load
  and record the pass count before and after.
- **Action:** fix after merge, apply A, because the test is not part of the
  change that saw it.
