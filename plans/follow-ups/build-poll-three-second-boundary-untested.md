# No test checks the three-second build poll

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from branch `calummoore/test-audit-app-and-cloud-rust-fl63`, review finding 7.
- **Location:** `packages/app/src/_tests_/build-clock.ts:12`, `packages/app/src/viewer/build-watch.ts:66`, `packages/app/src/viewer/build-poll.ts:6`.
- **Reason:** `origin/main` never checked the exact interval either, so the check is new coverage, not a check that the audit removed.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Build poll:** one scheduled read of a working build and of new lines of its log, which the viewer's build card makes while the build can still change.
  - **Page clock:** Playwright's `page.clock`, which the build specs install so that a test can move the page's timers forward.
- **Background:**
  - `docs/protocol/cloud/viewer-builds.md` says that the card reads a working build every three seconds. The hook `useBuildWatch` in `packages/app/src/viewer/build-watch.ts` starts `setInterval(poll, buildPollIntervalMs)` when the card mounts. `buildPollIntervalMs` is 3,000 in `packages/app/src/viewer/build-poll.ts`.
  - The build specs install the page clock, which still runs in real time. `nextPoll` in `packages/app/src/_tests_/build-clock.ts` moves it forward by a test literal of 3,000 ms. Then each test waits for the next state, with the expect timeout of 15 s or the navigation timeout of 30 s.
  - With `buildPollIntervalMs` set to 60,000, eight clock tests fail. So the tests bound the interval from above, at about 18 s or 33 s.
  - Before the audit, the real-time waits on `origin/main` gave a similar upper bound of about 15 s or 30 s. No test ever set a lower bound or the exact boundary.
- **Problem:** No test fails when the interval becomes 5 or 10 seconds, or when it becomes 1 second and the card reads three times as often.
- **Impact if no action:** A change of the refresh rate, slower or faster, can reach users without a failing test.
- **Root question:** How does a kept test show that the next build and log reads start after exactly three seconds of page time?
- **Options:**
  - **A.** In one running-build browser case, pause the page clock before the page opens, because the interval starts at mount. Then advance 2,999 ms and check that no build or log read starts. Then advance 1 ms more and check one read of each. Effort: Small.
  - **B.** Mount `useBuildWatch` in a Node DOM test (the App has `packages/app/src/_tests_/dom.ts`) with Node's mock timers. Check no read at 2,999 ms, one build read and one log read at 3,000 ms, and no third read before 6,000 ms. Effort: Medium.
  - **C.** Move the schedule into the follower logic with an injected timer, and check the boundary in `packages/app/src/_tests_/viewer/build-follow.test.ts` with mock timers. This changes product code to make the schedule testable. Effort: Medium.
- **Left out:** A test that `buildPollIntervalMs` equals 3,000, because it restates a constant and does not prove that the hook uses it. A shorter real-time wait, because it makes the result depend on the speed of the runner.
- **Wider fix:** None. The class is one interval of one card.
- **Previous examples:** None found.
- **Recommendation:** B. It checks the boundary at the hook that owns the interval, does not depend on the speed of the runner, and adds no browser time.
- **Action:** fix after merge, apply B, because the boundary check is new coverage that `origin/main` never had.
