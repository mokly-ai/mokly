# Mac window scroll spec stops 2px short

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-27, from the CI of commit `dfbda1545` on the branch `calummoore/embedded-access-catalogue-server-bearer-9fes`.
- **Location:** `packages/app/src/_tests_/mac-window/scroll.spec.ts:18` and its first `scrollToEnd` call at `:32`, the helper `wheelTo` at `packages/app/src/_tests_/mac-window/scroll.ts:15`, and the same one-wheel-then-poll pattern at `packages/app/src/_tests_/build-output-mobile.spec.ts:68-71`.
- **Reason:** The flake is outside the scope of the branch where it showed. That branch changed the catalogue server, the access service, smoke scripts, docs, and two test files of other areas, none of which touches the sign-up page or the scroll specs.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Mac window specs:** the Chromium browser tests under `packages/app/src/_tests_/mac-window/` that emulate the desktop app's Mac window, whose top row stays over the scrolled page.
- **Background:**
  - The test "the account header scrolls away in a browser, and in the Mac window it stays over the page and keeps focus clear of it" opens `/sign-up` at 640 by 480 pixels and scrolls the page to its end with `scrollToEnd`.
  - `wheelTo` moves the mouse to the window's left edge, sends one mouse wheel event of 10,000 pixels, and then polls until `scrollHeight - innerHeight - scrollY` rounds to 0.
  - On 2026-11-27, in CI run 46053532361, attempt 1, job "App checks 6/7", the test failed after 15.5 seconds with `Error: the page scrolls to its end`: the poll expected 0 and received 2. It failed at the first `scrollToEnd`, before the Mac window emulation, and the poll stopped at the 15,000 ms timeout of `packages/app/playwright.config.ts:61`. Attempt 2 passed. The commit, `dfbda1545`, changed no file under `packages/`, and "App checks 6/7" passed in the run before, 46042238670 on `94d32100b`.
  - The app self-hosts the Geist font with `font-display: swap`, in `packages/app/public/folio/fonts/geist.css`, so the text can change its size after the first layout.
- **Problem:** The test sends one wheel event and then waits for the page to be at its end. When the page grows by a few pixels after the wheel event, for example when a late font or image changes the layout, no further wheel event comes, and the poll waits until its timeout.
- **Impact if no action:** The app shard of the gate fails now and then, and a pull request needs a rerun.
- **Root question:** How does the test bring the page to its end when the layout can still change after the first scroll?
- **Options:**
  - **A.** Wait for the page's layout to settle before the wheel event: `document.fonts.ready` and the loaded images of the page. Effort: Small.
  - **B.** Scroll with `window.scrollTo(0, document.documentElement.scrollHeight)` inside the poll, so each poll reaches the current end. The test then no longer scrolls as a reader does, which its comment says it means to. Effort: Small.
  - **C.** Send a wheel event on each poll until the page is at its end. It stays a reader's action, but it repeats an action until a check passes. Effort: Small.
- **Left out:** A longer timeout or a retry of the test, because the `deterministic-tests` skill forbids both.
- **Wider fix:** A in `wheelTo`, which covers `scroll.spec.ts` and `covered.spec.ts`, and the same readiness wait in `build-output-mobile.spec.ts`, which uses the pattern outside `wheelTo`.
- **Previous examples:** `plans/follow-ups/flaky-readiness-pending-sibling-hover.md`, a browser spec that fails now and then on a layout or event that comes late.
- **Recommendation:** A. It keeps the reader's wheel action and gives the test an explicit readiness signal, as the `deterministic-tests` skill asks. Before the fix, reproduce the flake, for example with a delayed web font, and record the pass counts before and after.
- **Action:** fix after merge, apply A, because the flake is outside the scope of the branch where it showed.
