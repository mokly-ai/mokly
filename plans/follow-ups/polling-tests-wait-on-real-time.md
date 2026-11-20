# Polling browser tests wait on real time

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from open finding 6 of the Milestone 26 review TODO in the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `apps/app/src/viewer/build-watch.ts:16` and `:72`, `apps/app/src/_tests_/build-announcements.spec.ts:120-148` and `apps/app/src/_tests_/build-order.spec.ts:173-190`.
- **Reason:** PR #45 merged on 2026-10-20 with the finding open. The review-fix rule leaves its category to the user.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The tests still wait on the real poll interval and on fixed one-second waits. No current flake is known.
- **Category:** Test.

- **Background:** The viewer polls a running build for new steps and log windows. The review of 2026-10-20 found that the browser tests of that polling wait on real time. The `deterministic-tests` skill asks for operation counts, captured inputs or a fake clock instead. The list below gives the current waits.
  - The running hook polls with a real three-second `setInterval`: `build-watch.ts:16` sets the interval, and `:72` starts the timer.
  - `build-announcements.spec.ts:120-148` waits for the next held read, releases it, then waits a real second.
  - `build-order.spec.ts:173-190` has three one-second `waitForTimeout` calls.
  - Several other polling checks already assert operation counts. They are not elapsed-time assertions.
- **Problem:** These polling tests depend on real time and on the speed of the machine that runs them. Nobody reproduced a flake from them.
- **Impact if no action:** The tests run slowly and can flake on a slow CI runner. Each new polling test copies the pattern.
- **Root question:** How do the polling tests advance time without waiting on the wall clock?
- **Options:**
  - **B.** Change nothing. Effort: Small.
  - **A.** Use Playwright's clock to advance the poll interval in each test. The change is test-only. It is Medium only if it adds a test helper file. Effort: Small (estimate).
- **Left out:** Not recorded.
- **Wider fix:** A. A controlled clock removes the class from the polling tests.
- **Previous examples:** The runner tests wait under ten seconds for a child process. `plans/follow-ups/integration-tests-need-gnu-timeout.md` now holds that case.
- **Related:** `plans/follow-ups/integration-tests-need-gnu-timeout.md`, same class in the runner tests.
- **Recommendation:** A. The review recommended it, and the `deterministic-tests` skill asks for it.
- **Action:** ask the user, because condition 6 holds: the finding concerns a test design, a category that the review-fix rule does not let an agent fix alone.

The review graded the finding Low severity and Medium effort. That effort grade is history. The effort scale does not count test lines.

Source: [the Milestone 26 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2192-L2244) of the deleted plan.
