# Stabilize the large React watch test

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #217 and its completed plan, which put the
  failure outside the scope of its review.
- **Location:** `tests/browser/large_watch.spec.ts:14`, with the runner time
  limit at line 17.
- **Reason:** The test timed out once in the remote gate of PR #217, which
  did not change it, and it passed on the rerun.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Large benchmark harness:** the opt-in scripts under `scripts/large/`.
    The test runs their `watch` scenario on a small generated fixture.
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
  - Failure: the React test timed out once after 300 s in remote browser
    shard 1 of 4 during PR #217, on or before 2026-10-27.
  - Failure text: the test timeout of 300 s. The step that waited was not
    recorded.
  - Rerun outcome: the test passed on the rerun.
  - Suspected source: not recorded for this run.
    `docs/protocol/ci-test-timing.md:31` names CPU contention on a small
    runner as the accepted cause of such timeouts. Without the waiting
    step, a lost watch event is not excluded.
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
- **Left out:** A longer time limit, a retry, or a sleep. The
  `testing` skill forbids them, because they hide the source.
- **Wider fix:** C. Each later failure of a harness journey then
  names its own step.
- **Previous examples:** The 404 failures of the same test, fixed by PR #222
  and PR #244. Before the user's choice of 2026-10-20, the React test also
  timed out twice in gate runs of the Rust rebuild with
  `Test timeout of 300000ms exceeded`, once with
  `page.waitForFunction: Test ended` too. A later gate run and an isolated
  rerun passed.
  [flaky-same-origin-handoff.md](./flaky-same-origin-handoff.md) records
  another browser test that failed once and passed on the rerun.
- **Related:**
  - [compiled-recipe-cache.md](./compiled-recipe-cache.md) asks for a
    byte-bounded cache of unused compiled recipes. On 2026-10-20 the
    rebuild named this cache as one option against these timeouts, because
    the accumulated React and base compilations of the journey can exhaust
    its guard. The work differs, so the items stay separate.
  - [flaky-same-origin-handoff.md](./flaky-same-origin-handoff.md) is a
    separate case of the same recorded class: a browser test that failed
    once and passed on the rerun. It has its own test and suspected source.
- **Recommendation:** C. The failure text does not name a step,
  so the next failure must name it before A can find the source.
- **Action:** ask the user, because the failure has not been reproduced with a
  confirmed cause. No fix is clearly best until reproduction identifies the
  source, as the flaky-test rule requires.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/remove-review-json.md?plain=1#L185).
