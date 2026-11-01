# Keep healthy remote Testbox runs alive

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of the CI release checks hub review.
- **Location:** `.github/workflows/blacksmith-testbox.yml:25`,
  `docs/protocol/remote-verification-testbox.md:16`, and
  `docs/protocol/remote-verification-testbox.md:99`.
- **Reason:** The review found the stop outside the change that it
  reviewed, and the rebuild required a decision on the Testbox guard before
  any timeout change.

- **Source:** Review.
- **Category:** Process (estimate).
- **Terms:**
  - **Testbox:** a Blacksmith remote runner that the remote gate prepares
    with `.github/workflows/blacksmith-testbox.yml` and then runs one gate
    command on.
  - **Job guard:** the `timeout-minutes` limit of the Testbox job. It covers
    preparation, the commands, and the report download.
- **Background:** The remote gate and its guards work as follows.
  - The remote gate runs each suite on its own Testbox.
  - The Testbox protocol sets `timeout-minutes: 30` for the job, and browser
    work and static delivery use separate 30-minute guards.
  - Static delivery builds the source on its box and then checks the example
    through static HTTP and file URLs.
  - On 2026-10-20 one remote run passed both delivery modes, 645 cases each,
    in 17.70 command minutes, without preparation.
  - Hosted CI gives the static delivery job 60 minutes.
- **Problem:** During the CI release checks of the rebuild, the 30-minute
  guard stopped a healthy Node 22 file-delivery run before its report
  download. Its run annotations exist only in local evidence that is not
  available. The guard cannot tell a slow healthy suite from a hung one, and a
  higher limit raises the cost and the hang time.
- **Impact if no action:** A valid remote gate can fail without a report,
  so the developer must rerun it.
- **Root question:** How should the remote gate finish a healthy suite and
  still stop a hung one at a bounded cost?
- **Options:**
  - **A.** Keep the 30-minute guard, and rerun a stopped job. Effort: Small
    (estimate).
  - **B.** Raise the job guard of the delivery Testbox. This raises a time
    limit and changes the Testbox protocol. Effort: Small (estimate).
  - **C.** Measure the suite and its preparation, then reduce or split its
    work so that it fits under the 30-minute guard. Effort: Medium
    (estimate).
- **Left out:** Removing the timeout loses the remote cost bound and the
  hang bound.
- **Wider fix:** C. Work that fits its guard removes the stop for every
  later run.
- **Previous examples:** Before 2026-10-20 a browser command at
  `3d07196e` ended after 30.55 minutes when its Testbox reached the same
  job limit. On 2026-10-21 the user raised the hosted CI limits of the
  Repository and Viewer jobs to three times their measured medians, 75 and
  40 minutes.
- **Related:**
  - [linux-ci-runner-size.md](./linux-ci-runner-size.md) moves the Testbox
    job back to 2 vCPUs with the Linux CI jobs. That makes each Testbox
    command slower, so measure under C after that change.
  - [local-gate-duration.md](./local-gate-duration.md) concerns the time
    limit of the local complete gate, which once took 114 of its 120
    minutes. Both items recommend cutting suite cost over raising a limit,
    so one measurement of suite times can serve both. The limits and the
    runners differ, so each item keeps its own decision.
- **Recommendation:** C. (estimate) It keeps the guard and makes the suite
  fit it.
- **Action:** ask the user, because condition 6 holds: the item concerns a
  slow check and its cost. Condition 3 also holds for B, because it raises
  a time limit.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4212).
