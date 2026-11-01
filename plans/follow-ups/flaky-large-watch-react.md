# Stabilize the large React watch test

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #217 and its completed plan, which put the
  failure outside the scope of its review.
- **Location:** `tests/browser/large_watch.spec.ts:14`, with the runner time
  limit at line 17. `scripts/large/delivery.ts:75` holds the wait that
  failed, called by `scripts/large/watch.ts:45` for ready Changes.
- **Reason:** The test timed out once in the remote gate of PR #217, which
  did not change it, and it passed on the rerun.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Large benchmark harness:** the opt-in scripts under `scripts/large/`.
    The test runs their `watch` scenario on a small generated fixture.
  - **Complete gate:** `cargo xtask check`. Its remote run spreads browser
    specs over four shards on separate Blacksmith Testbox machines.
  - **Runner timeout:** the Playwright limit for one whole test. It stops a
    test that hangs.
  - **Serve:** `mokly serve`, the development server. It watches sources and
    publishes each new catalogue state to the browser.
  - **Changes:** Mokly's comparison of each entry with the base commit.
    Serve publishes the new state first and its ready Changes later.
- **Background:**
  - `tests/browser/large_watch.spec.ts:14` defines "large watch delivers
    browser evidence for html" and "large watch delivers browser evidence
    for react". Line 17 sets a runner time limit of 300,000 ms.
  - Each run makes a screen, a component, and a stylesheet edit. For each
    edit it waits for the publication, a frame reload, the index, and
    Changes.
  - Two other failures of the React test had known causes, and both are
    fixed. PR #222 got two 404 responses for `/static/assets/mark.svg` after
    an extra startup rebuild, and fixed the rebuild on 2026-10-28. PR #244
    fixed the same 404 after a source replacement on 2026-10-29.
  - `docs/protocol/ci-test-timing.md:31` makes this combined React journey
    the one accepted exception to the three-times rule of hang guards. On a
    small runner, CPU contention can push it past the 300,000 ms guard, so
    its rare timeouts are accepted.
  - The user chose this on 2026-10-20: keep the combined React journey and
    its 300-second guard, accept its rare timeouts, and record the limit.
    One test per edit kind was rejected, because the combined journey
    proves that one Serve process handles the three React edits in order.
  - The measurement behind that choice, recorded on 2026-10-21: on two CPUs
    the combined journey took 185 to 218 s, about 155 s of them in twelve
    JavaScript compilations. One busy process per CPU pushed it past 300 s.
- **Problem:**
  - On 2026-10-26, remote complete gate run `20261026T221539Z-992801`
    failed in browser shard 1 of 4 during PR #217.
  - The failure text was `Test timeout of 300000ms exceeded.` and
    `Error: page.waitForFunction: Test ended.`, at
    `scripts/large/delivery.ts:75:29`.
  - The test was in the second wait of one edit: the `delivered` call at
    `scripts/large/watch.ts:45`. That wait expects the publication whose
    Changes are ready after the edit.
  - The local rerun passed both tests in 4.7 minutes on eight CPUs. The
    test also passed in later remote gate runs.
  - CPU contention on the remote machine is the suspected source.
    `docs/protocol/ci-test-timing.md:31` accepts rare timeouts from that
    cause. The waiting step does not prove the cause or exclude a lost
    watch event.
- **Impact if no action:** The browser suite can still fail at random on a
  correct change, as the timing contract accepts. A real lost watch event
  can hide behind such a timeout.
- **Root question:** How does the test know which watch step never finished,
  and wait for each step through an explicit signal?
- **Options:**
  - **A.** Reproduce the timeout by repeating the React test, and name the
    step that waits. Then make that step wait for an explicit readiness
    signal. Keep every assertion. Effort: Medium.
  - **B.** Change nothing until the test fails again. Then record the step,
    the failure text, and the CI run in this item. Effort: Small.
  - **C.** Make the harness report the last finished step of each edit when
    a run ends early, so that the next failure names its step. Effort:
    Small.
  - **D.** Run this test alone on its own browser shard or on a larger
    machine. This changes CI and remote gate configuration and costs an
    extra job or a larger runner. Effort: Medium.
  - **E.** Reuse compiled JavaScript across the three edits to reduce the
    twelve compilations. This needs a new compile cache in the render and
    sidecar crates. Effort: Large.
- **Left out:** A longer time limit, a retry, or a sleep. The
  `testing` skill forbids them, because they hide the source.
  One test per edit kind conflicts with the user's decision of 2026-10-20.
- **Wider fix:** E reduces the compile cost that can exhaust the guard.
  C records the last finished step of each later harness failure.
- **Previous examples:** The 404 failures of the same test, fixed by PR #222
  and PR #244. Before the user's choice of 2026-10-20, the React test also
  timed out twice in gate runs of the Rust rebuild with
  `Test timeout of 300000ms exceeded`, once with
  `page.waitForFunction: Test ended` too. A later gate run and an isolated
  rerun passed.
  Remote gate run `20261020T153816Z-385781` failed in browser shard 2 of 4
  on 2026-10-20 with the same timeout. Its isolated rerun passed.
  [flaky-same-origin-handoff.md at its last commit](https://github.com/mokly-ai/mokly/blob/c7e7d9b88efc84152eb33539ed8ed7ca2ad2bb93/plans/follow-ups/flaky-same-origin-handoff.md)
  records another browser test that failed once and passed on the rerun,
  the same-origin handoff test. Its confirmed source: the preparation poll
  accepted the committed URL while the document still loaded. The fix of
  2026-11-01 also waits for a complete document and its action link.
- **Related:**
  - [compiled-recipe-cache.md](./compiled-recipe-cache.md) asks for a
    byte-bounded cache of unused compiled recipes. On 2026-10-20 the
    rebuild named this cache as one option against these timeouts, because
    the accumulated React and base compilations of the journey can exhaust
    its guard. The work differs, so the items stay separate.
- **Recommendation:** C. The failed wait is known, but its cause
  is not confirmed. The last finished step can help distinguish CPU
  contention from a lost event. E reduces compile cost if compilation causes
  the timeout. The current evidence does not confirm that cause.
- **Action:** ask the user, because the evidence does not show which cause
  needs a fix. The failure was not reproduced, and no option is clearly
  best until its cause is confirmed.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/remove-review-json.md?plain=1#L185).
