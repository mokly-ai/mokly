# Stabilize the large React watch test

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #217 and its completed plan, which put the
  failure outside the scope of its review.
- **Location:** `tests/browser/large_watch.spec.ts:15`, with the runner time
  limit at line 18. The accepted exception is in
  `docs/protocol/ci-test-timing.md`, section "Hang Guards And Budgets". `scripts/large/delivery.ts:75` holds the wait that
  failed, called by `scripts/large/watch.ts:45` for ready Changes.
- **Reason:** On 2026-11-03 the user chose option E, the reuse of compiled
  JavaScript across the edits, and asked for it in a later branch. On
  2026-11-25, measurements showed that the React journey now takes 15 to 41
  seconds, so the premise of E is gone and the next step needs the user.

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
  - On 2026-11-03 the user chose option E.
  - Measurements of 2026-11-25, at `main` commit `1f2f00024`:
    - Six recent push runs of `main` on GitHub-hosted runners, with no
      restored Mokly cache, passed the React test in 14.8, 17.3, 17.6, 23.1,
      23.5, and 24.1 seconds. The runs are 45673612145, 45680155780,
      45688809426, 45692262045, 45710272091, and 45713813952.
    - A local run on Linux, pinned to two CPUs with `taskset -c 0,1`, passed
      the html test in 13.7 seconds and the React test in 28.0 seconds.
    - A local run on the same two CPUs, beside one busy loop on each CPU,
      passed the React test in 41.0 seconds. In October, that load pushed the
      journey past 300 seconds.
    - The command was
      `taskset -c 0,1 node scripts/verification/browser-developer.mjs tests/browser/large_watch.spec.ts`,
      after `npm run build`, with Node 24.22.1 and one Playwright worker.
    - The 300,000 ms guard now allows more than seven times the slowest
      measured duration. So the test meets the three-times rule without the
      exception, and E has no timeout left to prevent.
    - The measurements did not count the compilations of the journey.
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
- **Impact if no action:** The protocol keeps an exception that the test
  no longer needs, and the item keeps a Large compile cache as planned work
  that no measured timeout justifies.
- **Root question:** What work should follow, now that the React journey
  takes 15 to 41 seconds against its 300-second guard?
- **Options:**
  - **F.** Close this item and drop E. Keep the exception paragraph in
    `docs/protocol/ci-test-timing.md`. The paragraph then describes a risk
    that the measurements do not show. Effort: Small.
  - **G.** Close this item and drop E. Remove the exception paragraph from
    `docs/protocol/ci-test-timing.md`, because the test meets the
    three-times rule. Keep the combined journey, its 300-second guard, and
    every assertion. A later timeout of the test is then a flaky test under
    the normal rules. Effort: Small.
  - **E.** Keep the user's choice of 2026-11-03: reuse compiled JavaScript
    across the three edits, with a new compile cache in the render and
    sidecar crates. It makes a fast journey faster and protects against no
    measured timeout. Effort: Large.
- **Left out:**
  - A longer time limit, a retry, or a sleep. The `testing` skill forbids
    them, because they hide the source.
  - One test per edit kind. It conflicts with the user's decision of
    2026-10-20.
  - A shorter guard. The three-times rule sets only a minimum, and a shorter
    guard saves time only when the test hangs.
  - The earlier options A to D: reproduce the timeout, wait for a failure,
    report the last finished step, or run the test alone. No timeout remains
    to reproduce or to explain at the measured durations.
- **Wider fix:** None. The three-times rule already covers every other
  test, and G brings this test under it.
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
  - The
    [compiled recipe cache item at its last commit](https://github.com/mokly-ai/mokly/blob/c7e7d9b88efc84152eb33539ed8ed7ca2ad2bb93/plans/follow-ups/compiled-recipe-cache.md)
    asked for a byte-bounded cache of unused compiled recipes. On 2026-10-20
    the rebuild named this cache as one option against these timeouts,
    because the accumulated React and base compilations of the journey can
    exhaust its guard. It closed on 2026-11-01, when the sidecar pool
    started to keep the last released recipe of each set of bundle settings,
    so a later bundle whose inputs equal an earlier compile can skip
    esbuild.
  - PR #312 merged on 2026-11-18. It keeps compiled sidecar bundles in a
    bounded disk cache across command processes, and it deleted the
    [bundle disk cache item at its last commit](https://github.com/mokly-ai/mokly/blob/bc858df427b0ffe2cb53dbf3fe35a44e032475cc/plans/follow-ups/bundle-disk-cache.md).
    [stylesheet-cache-across-restarts.md](./stylesheet-cache-across-restarts.md)
    now holds the parked restart-store design. The user chose startup
    PostCSS preparation on 2026-11-21 and parked stored stylesheet records.
    E keeps compiled output across the edits of one process. So the plan for E
    reads the cache of PR #312 and that item first.
- **Recommendation:** G. The measured durations meet the three-times rule,
  so the exception and the compile cache protect nothing. The first
  recommendation was C, and the user chose E on 2026-11-03, before the
  measurements of 2026-11-25.
- **Action:** ask the user, because the user chose E on 2026-11-03, and G
  replaces that choice and changes a protocol rule.
- **Work, only when the user keeps E:**
  - E is Large, so start with a plan under `plans/`, as the `plans` skill
    says.
  - Measure first. On two CPUs, record each of the twelve compilations of
    the React journey, with its inputs and its time.
  - Build on the retained recipes of commit `2ca57742`. The sidecar pool
    keeps the last released recipe of each set of bundle settings. An edit
    changes the inputs, so the reuse of whole bundles alone does not cover
    the journey.
  - Keep every assertion of the test and its 300-second guard.
  - After E, measure the journey on two CPUs again. When it fits the
    three-times rule of `docs/protocol/ci-test-timing.md`, propose the
    removal of the exception at line 31 as a decision.
  - Delete this item in the branch that applies E.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/remove-review-json.md?plain=1#L185).
