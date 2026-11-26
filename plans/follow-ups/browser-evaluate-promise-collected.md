# Browser specs await page work that Chromium can drop

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from the branch `worktree-agent-a283e6ee0f721cf64`, which fixed the item "Viewer pick test loses its page to a navigation".
- **Location:** The asynchronous page functions of 32 files under `tests/browser/`. The most are in `viewer_lifecycle.spec.ts` and `same_origin_identity.spec.ts`, six each, and in `same_origin_adapter.spec.ts`, three.
- **Reason:** The branch fixed the two specs whose failures CI and local runs showed, and each other spec needs its own conversion and repeat runs.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Evaluation promise:** the promise that the page function of a `page.evaluate` call returns. Playwright waits for it through the Chrome DevTools Protocol.
  - **`awaitViewerWork`:** the test helper in `tests/browser/viewer_work.ts`. A Playwright handle holds the page object whose `work` promise the test waits for.
- **Background:**
  - A browser spec often starts viewer work in a page function and awaits it there, for example `await page.evaluate(async () => { await handle.startPick(); ... })`.
  - Chromium 149 and Chrome 151, with V8 14.9 and 15.1, hold an awaited evaluation promise only through a weak handle until they send the reply.
  - The reply comes one microtask after the promise settles, behind the microtasks that the page work queued, such as React renders.
  - When the promise settles in a later task, nothing else references it in that gap. A garbage collection there drops it, and Chromium answers "Promise was collected", code -32000.
  - Playwright reports this answer as "Execution context was destroyed, most likely because of a navigation". No page navigates. The page finishes the work, and later evaluations of the same context succeed.
  - V8 commit `5177b10891e6`, "fix(inspector): hold on to promises", keeps the promise strong until it settles. V8 15.1 does not contain it.
- **Problem:** About 50 asynchronous page functions in 32 browser spec and helper files still return a promise that can settle in a later task. Each of them can fail in this way, rarely and at random.
- **Impact if no action:** A passing change can fail the Browser suite in CI and in the local gate. The failure text points to a navigation that did not happen.
- **Root question:** How does a browser test wait for asynchronous page work so that the browser cannot drop the result?
- **Options:**
  - **A.** Change nothing until Playwright bundles a Chromium with the V8 fix. The failures continue until then, and the date is unknown. Effort: Small.
  - **B.** Convert each remaining page function that awaits page work to `awaitViewerWork`, or to `startViewerPick` for a pick. Run each changed spec 40 times. Effort: Medium.
  - **C.** Change the fixture in `tests/browser/browser_test.ts` so that every `page.evaluate` waits through a held handle. One change covers every spec. It changes how every evaluation of every browser spec waits, so it needs the complete Browser suite. Effort: Medium.
- **Left out:** A retry of a failed evaluation hides the failure. A wait for an idle page before each reply does not remove the weak handle.
- **Wider fix:** C. One fixture covers the specs that later changes add.
- **Previous examples:** Commit `51f356574`, pull request #308, added `startViewerPick` for four tests. The branch of this item added `awaitViewerWork` for `tests/browser/viewer_async.spec.ts` and `tests/browser/viewer_evidence_cancellation.spec.ts`.
- **Related:** `plans/follow-ups/pick-promise-unsettled-during-adapter-swap.md` has the same failure text from another cause: a pick promise that never settles. Through `awaitViewerWork`, such a promise makes the test time out instead.
- **Recommendation:** B. It uses the reviewed helpers and keeps the timing of each other evaluation, and C remains possible later.
- **Action:** fix after merge, apply B, because the two specs with observed failures are fixed and each other spec needs its own runs.

Evidence from the fixing branch: with a forced collection two microtasks after the page function returns, the old form of the concurrent pick test failed 4 of 4 runs, and `awaitViewerWork` passed 24 of 24 runs, 4 of them at that same point. The local protocol log of a natural failure showed the reply "Promise was collected" for the failed evaluation, while the page went on to finish the page function.
