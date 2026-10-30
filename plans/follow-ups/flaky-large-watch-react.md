# Large React watch journey timed out once

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #217 (`calummoore/reviewjson-purpose`), the
  outside-scope list of its first review.
- **Location:** `tests/browser/large_watch.spec.ts:13`, the test "large
  watch delivers browser evidence for react", with its timeout at line 17.
  `scripts/large/delivery.ts:75`, the wait that was running.
  `docs/protocol/ci-test-timing.md:31`, the accepted timeout exception.
- **Reason:** The test failed in a wait that PR #217 did not change, and the
  same test passed when it ran again.

- **Terms:**
  - **Large watch journey:** the browser test above. It builds a generated
    React catalogue, starts Serve, and makes three watched edits: a screen, a
    component, and a stylesheet.
  - **Complete gate:** `cargo xtask check`. Its remote run spreads the
    browser specs over four shards on separate Blacksmith Testbox machines.
  - **Runner timeout:** the Playwright limit for one whole test, which
    `test.setTimeout` sets. It stops a test that hangs.
  - **Serve:** `mokly serve`, the development server. It watches the
    sources and publishes each new catalogue state to the browser.
  - **Changes:** Mokly's comparison of each entry with the base commit.
    After an edit, Serve publishes the new state first and its ready Changes
    later.
- **Background:**
  - The journey measures each edit until the browser shows the new
    publication and its ready Changes.
  - The test sets a runner timeout of 300,000 ms.
  - `docs/protocol/ci-test-timing.md` requires a runner timeout of at least
    three times a test's typical duration. Its lines 31 to 35 make this
    journey the one accepted exception.
  - A user decision of 2026-10-20 accepted the rare timeouts of this
    journey. It rejected one test per edit kind, because the combined
    journey proves that one Serve process handles the three React edits in
    order.
  - An earlier measurement on two CPUs gave a journey of 185 to 218 seconds.
    About 155 seconds of that went to twelve JavaScript compilations. One
    busy process per CPU pushed the journey past 300 seconds.
- **Problem:**
  - On 2026-10-26, the remote complete gate run
    `20261026T221539Z-992801` failed in browser shard 1 of 4 on this test.
    It tested the change that removed `review.json`, before its merge.
  - The failure text was `Test timeout of 300000ms exceeded.` and
    `Error: page.waitForFunction: Test ended.`, at
    `scripts/large/delivery.ts:75:29`.
  - The test was in the second wait of one edit: the `delivered` call at
    `scripts/large/watch.ts:45`. That wait expects the publication whose
    Changes are ready after the edit.
  - The same test passed in a local rerun: 2 of 2 tests in 4.7 minutes on
    8 CPUs. It also passed in the later remote gate runs.
  - The suspected source is CPU contention on the remote machine. The
    duration of the journey depends on the machine load, and the runner
    timeout bounds the whole journey.
- **Impact if no action:** A complete gate run fails on this test now and
  then, and someone must run it again. The failure shows no product defect.
- **Root question:** How do complete gate runs stay reliable while the
  combined React watch journey runs on small, busy machines?
- **Options:**
  - **A.** Change nothing. Keep the accepted exception, and run the gate
    again when it fails only on this timeout. The cost is an occasional
    rerun. Effort: Small.
  - **B.** Run this test alone, on its own browser shard or on a larger
    machine, so that no other test competes for its CPUs. The cost is one
    more CI job or a larger runner, in the CI and remote gate
    configuration. Effort: Medium (estimate).
  - **C.** Make the journey cheaper. Reuse compiled JavaScript across the
    three edits, so that the twelve compilations shrink. The cost is a new
    compile cache in the render and sidecar crates. Effort: Large
    (estimate).
- **Left out:**
  - A longer runner timeout, because the `deterministic-tests` skill
    forbids a longer time limit as a fix for a flaky test.
  - One test per edit kind, because the decision of 2026-10-20 rejected it.
    The combined journey must stay.
  - A retry, because the `deterministic-tests` skill forbids retries.
- **Wider fix:** C. It removes the compile cost that pushes large journeys
  past their runner timeouts.
- **Previous examples:** The remote complete gate run
  `20261020T153816Z-385781` on 2026-10-20 failed in browser shard 2 of 4
  with the same timeout. Its isolated rerun passed.
- **Recommendation:** A. The decision of 2026-10-20 accepts the rare
  timeouts of this journey, and this run matched that case. C protects the
  test suite best, but it is Large.
- **Action:** ask the user, because condition 6 holds. The review listed
  this flake outside its scope, so only the user can drop this item or
  choose B or C.
