# Parent-death test sees two Serve binaries

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
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
- **Problem:** The test counts every Serve binary below the test process.
  Under load, a second Serve process, from this test's own host start or
  from another process in the same tree, can still be in the list.
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
