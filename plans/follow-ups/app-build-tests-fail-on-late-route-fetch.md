# App tests fail on a late route fetch

- **Severity:** Medium (estimate). **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from CI run 40396307516 of the closed [PR #62](https://github.com/mokly-ai/mokly-cloud/pull/62), an unrelated flaky test. Updated on 2026-11-01 with the failures that the closed PR #87 and the branch `calummoore/ci-pipeline-duration` found. Updated on 2026-11-02 with one more failure from the same branch. Updated again on 2026-11-02 with failures in two more CI runs from the same branch, at commits `0d1e5bb9` and `6216f480`. On 2026-11-03, the user chose to record these updates in that branch. Updated again on 2026-11-03 by the branch `conductor/follow-ups-app-test-fixes`, which tried the chosen option C and withdrew it.
- **Location:** The `test` export of `apps/app/src/_tests_/harness.ts`, `apps/app/src/_tests_/build-answers.ts:94`, and `answering` at `apps/app/src/_tests_/build-routes.ts:31-46`, which ignores "Test ended." at line 38 since commit `d7118e8a0`. The decision also concerns `routeBuilds` at `apps/app/src/_tests_/build-routes.ts:53-58`, where the proposed option C would set its mark, and `apps/app/src/_tests_/github-install-landing.spec.ts:53`.
- **Reason:** The chosen teardown hung in an unrelated spec, and its exact cause remains unknown. The user requested a later decision without blocking this branch.
- **Answered:** On 2026-11-03, the user chose the first option C, and the main orchestrator approved a plan that applies only it. The branch `conductor/follow-ups-app-test-fixes` withdrew that fix on the same day, before any commit.
- **Checked:** 2026-11-01, at commit `10834d30`. Verified in CI. From 30 October to 1 November 2026, the error failed 6 CI runs, which the list at the end gives. The shared fixture still has no route teardown, and `answering` at `build-routes.ts:35` still does not ignore "Test ended". On 2026-11-02, the line numbers were checked again on the branch `calummoore/ci-pipeline-duration`.
- **Checked:** 2026-11-17, in this repository after the cloud moved in. The root npm workspace resolves Playwright 1.61.1, not 1.63.0. Commit `d7118e8a0` added "Test ended." to the messages that `answering` ignores. That change is the first option A, which the user rejected on 2026-11-03. The shared fixture still has no route teardown. The line numbers in the record below come from the old cloud repository and can differ by a few lines here.
- **Category:** Test.

- **Terms:**
  - **Build double:** The fake build state that app browser tests lay over the real local API, through route handlers in `apps/app/src/_tests_/build-routes.ts`.
  - **`answering`:** The wrapper in `build-routes.ts:31-46` that ignores four request-lifecycle messages and rethrows every other handler error.
  - **Owned page:** A page on which `routeBuilds` installed the build double.
  - **Waiting unroute:** The call `page.unrouteAll({ behavior: "wait" })`. It removes every page route, then waits for the handlers that still run.
  - **Spec-local overlay:** A handler in one spec that calls `route.fetch()` and then `route.fulfill()` without `answering`. An example is `readAsReviewer`.
- **Background:** The list below gives the facts.
  - `answerRows` in `build-answers.ts:89-101` answers a branch or pull request list request. It calls `route.fetch()` for the real list, then lays the double's rows over it.
  - The double also calls `route.fetch()` at `build-routes.ts:64` and at `build-answers.ts:62` and `:80`.
  - All 24 specs that use the double install the same handlers through `buildScenario` or a direct `routeBuilds` call.
  - Until 2026-11-17, `answering` ignored only errors that matched "Response has been disposed", "Route is already handled" or "has been closed". Any other handler error failed the run.
  - On 2026-11-17 the cloud moved into this repository, and its app tests run with Playwright 1.61.1, the version of the root lockfile. With 1.61.1, a route callback that outlived a passing test failed that test with `Error: "route.fetch: Test ended." while running route callback.`, for example in `build-references.spec.ts:47`. Commit `d7118e8a0` then added `Test ended\.` to the messages that `answering` ignores. A timeout and every other handler error still fail. After that commit, the four `cloud-app` shards passed all 413 browser tests with no retry. Handlers outside `answering`, such as the spec-local overlays, the direct handlers of the GitHub specs and the four billing calls, do not get the ignore.
  - The source flow below names files and lines of `playwright-core` 1.63.0, which the old cloud repository used. Version 1.61.1 can differ.
  - On 2026-11-03 the user chose the first option C: a waiting unroute in the teardown of the shared `page` fixture. The user rejected the first options A, B, and D. The first record of these options stays below, as history.
  - On 2026-11-03 the branch `conductor/follow-ups-app-test-fixes` tried that fix as this uncommitted edit of the `test` export in `harness.ts`:

    ```ts
    page: async ({ page }, run) => {
      await run(page);
      await page.unrouteAll({ behavior: "wait" });
    },
    ```

  - With that edit alone, normal mobile build specs failed in page teardown. An options check confirmed this source flow in `coreBundle.js` of `playwright-core` 1.63.0:
    1. `_unrouteInternal` empties the route list of the page first. It updates the interception patterns only after the wait, at `61767-61774`.
    2. While it waits, the first handler that finishes makes `Page._onRoute` send empty interception patterns, at `61441-61444`.
    3. The server then removes the interceptor of the page. It continues every other running route to the network, at `53661-53672`, `22733-22739`, `52089-52091`, and `13682-13689`.
    4. The later `route.fulfill()` of such a route fails with "Route is already handled!", at `13706` and `13773-13777`.
    5. A failed route call never settles the route, at `59750-59758`. So a waiting unroute that made its list before the failure waits until the test timeout, at `60168-60189`.
  - The exact refused message is inferred, not recorded. The diagnostics did not record the text, so the check found "Route is already handled!" by elimination.
  - The branch then added a cleanup to `answering`, as a call of its orchestrator. After one of its three ignored messages, `answering` called `route.fallback()` and returned. That settled a refused build-double route, so it no longer held the wait.
  - The fix used six selected cases, under `apps/app/src/_tests_/`:
    - `desktop`: `build-references.spec.ts:45`, "the standalone entry shows the default branch's first build".
    - `desktop`: `build-references.spec.ts:107`, "a failed build newer than the newest publication holds the stage".
    - `desktop`: `build-states.spec.ts:14`, "a lockfile builds cannot install links the CI guide".
    - `mobile`: `build-closed-mobile.spec.ts:11`, "a phone names a closed or merged pull request".
    - `mobile`: `build-fork-mobile.spec.ts:11`, "a phone names a pull request from a fork".
    - `mobile`: `build-order-mobile.spec.ts:18`, "a phone shows a closed pull request's running build, then its closed card and the Team card".
  - This command runs each case 10 times with no retry, 60 attempts in total. Run it from the repository root. Each recorded run used its own artifact directory. The command below writes new output under the repository’s ignored scratch directory.

    ```sh
    npm run test:browser --workspace @mokly-cloud/app -- \
      src/_tests_/build-closed-mobile.spec.ts \
      src/_tests_/build-fork-mobile.spec.ts \
      src/_tests_/build-order-mobile.spec.ts \
      src/_tests_/build-references.spec.ts \
      src/_tests_/build-states.spec.ts \
      --grep "a phone names a closed or merged pull request|a phone names a pull request from a fork|a phone shows a closed pull request's running build|the standalone entry shows the default branch's first build|a failed build newer than the newest publication holds the stage|a lockfile builds cannot install links the CI guide" \
      --repeat-each=10 --retries=0 \
      --output=../../.context/app-route-repeat
    ```

  - The runs of 2026-11-03 gave these counts. No run used a retry.
    - Before the fix, the command passed 60 of 60, 10 of 10 for each case. It did not reproduce the original error.
    - With the fixture edit alone, the command gave 30 passed, 1 failed, 1 interrupted, and 28 did not run, and then it was stopped. The failure was `Tearing down "page" exceeded the test timeout of 120000ms.`, in `build-closed-mobile.spec.ts:11`.
    - Two diagnostic runs then repeated `build-closed-mobile.spec.ts:11` with a one-time probe, and stopped at the first failure. The first gave 6 passed, 1 failed, and 3 did not run. The second gave 8 passed, 1 failed, and 1 did not run.
    - With the fixture edit and the cleanup, the command passed 60 of 60, 10 of 10 for each case. These counts cover only the six selected cases.
  - A source-based risk stayed. Handlers outside `answering` did not get the cleanup, so a spec-local overlay that finishes second can fail visibly with "Route is already handled!". It does not hang. No run reproduced it.
    - The overlays under `apps/app/src/_tests_/` are `build-reader.ts:22-32`, `build-plan.spec.ts:73-81`, `build-order.spec.ts:126-134`, `build-settings.spec.ts:98-116`, and `build-state-readers.ts:164-171`. The billing specs also call `route.fetch()` in four places, which the first check did not read.
    - Three specs call the waiting unroute inside a test: `build-settings.spec.ts:85` and `:124`, and `build-references.spec.ts:161`. No failure from them is recorded. `viewer/entry-states.spec.ts:113` also calls it, and the check did not read that call.
  - Then the complete gate recorded a new timeout. It ran on 2026-11-03 after merge `1c9f425b` of `origin/main` commit `18cc4834`, with the fixture edit and the cleanup.
    - Stages 1 to 13 passed. Stage 14 passed its logic suites and its web build, then ran the full App browser suite.
    - The first attempt of the `desktop` test `github-install-landing.spec.ts:50`, "a session startup failure keeps installation pending", failed after 2.0 minutes: `Tearing down "page" exceeded the test timeout of 120000ms.`.
    - The gate log also shows `Error: page.unrouteAll: Test ended.`, at `harness.ts:61`.
    - The existing configured retry passed in 960 ms. No retry or timeout changed.
    - Then the orchestrator stopped the suite: 249 passed, 1 flaky, 1 interrupted, and 120 did not run. The stop interrupted `viewer/access.spec.ts:99`, so that case is not another defect.
    - The gate exited 1 at stage 14. Stages 15 to 25 did not run.
    - No mobile test ran. The gate ran 371 tests on one worker, and its log has 252 desktop results and no mobile result. The 120 tests that did not run include every mobile test.
    - The earlier hang of the fixture edit alone was in mobile build specs.
  - The failing case does not use the build double:
    - It installs two direct page handlers, at lines 55 and 68. `GET /v1/session` answers two failures and then one session. `POST /v1/github/installations/callback` answers a connection to `/sign-in`.
    - Both call `route.fulfill()` directly or through `json` at `auth-callbacks.ts:89-95`. Neither uses `answering` or `buildScenario`, so the cleanup did not cover them. The case holds no promise.
    - The case ends when the callback answer arrives and the request counts match. It does not wait for the navigation to `/sign-in` that `github-install-screen.tsx:95` schedules. That gives a plausible overlap with teardown, but no run proved it.
    - The spec, `auth-callbacks.ts`, and the Playwright configuration match `main`. The page fixture on `main` has no route wait, so the timeout was in the operation that the fix added.
  - A one-time diagnostic then repeated the case 10 times. Its probe spec imported the unchanged spec and only observed settlement. It used `--project=desktop --repeat-each=10 --retries=0 --max-failures=1`.
    - It gave 10 passed, 0 failed, and no retry, in 17.9 seconds.
    - Before each teardown, the two handlers had answered all four calls: three session reads and one installation callback. Each route handling promise had settled. No fulfilment or handler rejection occurred.
    - It did not reproduce the timeout, so the blocked operation is unknown.
  - The earlier deadlock does not follow directly for this case. A rejected handler reaches `finally`, which settles its call, at `60149-60166`. The direct handlers swallow no error.
    - Another pending callback or runner operation would need evidence.
    - The gate stack names `page.unrouteAll` at `harness.ts:61` as the pending call. It does not show whether the callback wait or the interception update blocked.
    - The interception update is the last runner step of every `page.unrouteAll` call, also of a default one, at `61767-61774`. It tells the browser which requests the remaining routes still catch.
    - A timeout in that update would not prove that a drain of callbacks fixes it. Nothing rules out the same hang on build-double pages, because they run the same call.
  - Confidence:
    - High: the shared waiting teardown failed outside the build double, the failure is flaky, and the fix with the cleanup has no full-suite pass.
    - Medium: the failure fits the route-removal and callback-order risk of the source flow.
    - Unconfirmed: the pending request, its promise state, and whether callback tracking fixes this timeout.
  - On 2026-11-03 the main orchestrator reverted both teardown code files, the fixture edit and the cleanup. Neither was committed, so `harness.ts` and `build-routes.ts` match `main`. Follow-up items do not block a merge, so that branch finished its three other fixes without this one.
  - After both code experiments were withdrawn, the full App browser suite passed 371 tests on the earlier base. After merge `5f51b1fb` of main `50283907`, it passed 372 tests. These runs validate the restored teardown and the other three fixes, not any proposed teardown repair.
  - A second options check confirmed the options below on 2026-11-03. It corrected the root question, the effort of A, the costs of B, the limits of C, and the wider fix. It also found these facts:
    - 24 spec files call `buildScenario` or `routeBuilds`. `buildScenario` calls `routeBuilds` at `build-scenario.ts:33`, and `build-settings.spec.ts` calls `routeBuilds` directly. So a mark that `routeBuilds` sets reaches every build-double caller.
    - `billing.spec.ts` and `billing-confirmation.spec.ts` have four `route.fetch()` calls, and they do not use the build double.
    - A repeat of the GitHub case cannot show whether B or C works, because it already passes 10 of 10 without them.
- **Problem:** The original race stays. In this repository, commit `d7118e8a0` hides its error for the build-double handlers with the first option A, which the user rejected on 2026-11-03. Handlers outside `answering` still fail on it. The waiting teardown with cleanup passed six selected cases, but it timed out in an unrelated GitHub installation spec. Nobody knows the exact cause of that timeout yet.
- **Impact if no action:** A handler outside `answering` can still fail the App browser suite at random with "route.fetch: Test ended.", and each failure costs a CI rerun. A build-double handler that outlives its test now passes without a signal, against the choice of 2026-11-03.
- **Root question:** How do build-double handlers finish before the browser context closes, without a new teardown hang in any App test?
- **Options:** The letters A, B, C, and D below belong to this decision. The first options A to D stay in the history below. A, B, and C each also remove the ignore of "Test ended." that commit `d7118e8a0` added, because the user rejected it on 2026-11-03.
  - **A.** Use the withdrawn global waiting teardown and its cleanup in a private diagnostic probe. Capture the exact pending operation before another branch change. Effort: Large.
    - The targeted repeat did not reproduce the timeout. A later fix may need another decision, and the flake stays until its cause is known.
    - Pages without the build double keep the call and the flake. No proof exists today.
    - Verification: full-suite runs with capture until the hang appears. Then a fix, with its own decision and checks.
  - **B.** Use callback tracking in the shared fixture. Keep the routes registered until the recorded callbacks finish, then unroute with the default behavior. This replaces the waiting mechanism of the first option C. Effort: Medium.
    - Its final default unroute repeats the interception update, so it helps only if the callback wait blocked. No run proved it against the new timeout.
    - It adds a drain and an unroute to every page without the build double.
    - Preserve each `page.route` option and return value, and the handler identity for `page.unroute(url, handler)`.
    - While the fixture drains, send new callbacks through `route.fallback()`. Hide no callback error.
    - Apply the same tracked wait to the three waiting unroutes inside tests.
    - Keep every assertion, the configuration, and the outcome of the held-read timeout.
    - Verification: the six cases 10 times each, the full App suite with its mobile project, and the complete gate.
  - **C.** Wait natively only on owned pages: the pages on which `routeBuilds` registered the build double. `routeBuilds` marks each such page in a private `WeakSet<Page>` that it shares with the fixture. Restore the `answering` cleanup. Effort: Medium.
    - It removes the call that the stack names from every unowned page. Those pages then run the teardown of `main`, whichever step blocked.
    - It keeps the user's chosen call and the proven cleanup for all 24 build-double spec files.
    - Limit: it does not find or fix the step that blocked. On owned pages, the waiting unroute still covers every route, also direct handlers and spec-local overlays.
    - Limit: unowned pages lose the wait. So the four billing `route.fetch()` calls return to the state on `main`, where a late fetch can fail with "route.fetch: Test ended.".
    - Limit: a spec-local overlay that finishes second can still fail visibly with "Route is already handled!".
    - Limit: it removes the only place where the hang appeared. A later diagnosis must put the wait back on every page in an uncommitted probe.
    - Limit: code reading supports the change for unowned pages. Repeated runs give evidence for owned pages, but cannot prove that every rare ordering is safe.
    - Limit: only `routeBuilds` sets the mark. A future build-double route helper must call it or set the mark.
    - Available evidence: the code reading, the global-wait version at 60 of 60, and 49 passing desktop build-double results in the gate. No run tested the proposed ownership mark.
    - Put the `WeakSet<Page>` in a small new module under `apps/app/src/_tests_/`, so that `harness.ts` stays under the 300-line cap of the changed-file length audit. Set the mark in `routeBuilds` before its first `page.route` call.
    - Verification: typecheck, ESLint, the six cases 10 times each, the full App suite with its mobile project, and the complete gate.
    - Record what stays open as a follow-up item: the unexplained hang on owned pages, B for spec-local overlays, and the four billing calls.
  - **D.** Keep the ignore that commit `d7118e8a0` added, which is the first option A, and record the user's approval of it. Effort: Small.
    - It needs a new answer, because the user rejected the first option A on 2026-11-03: it hides a handler failure.
    - Timeouts and the other handler errors still fail. With it, the four `cloud-app` shards passed all 413 browser tests on 2026-11-17.
    - Limit: handlers outside `answering` keep the original failure, and the race itself stays.
- **Left out:** The list below gives the approaches that the options leave out.
  - The first option B: use `behavior: "ignoreErrors"`. The user rejected it on 2026-11-03, because it hides handler failures. The first option A, ignore "Test ended", is now option D, because commit `d7118e8a0` applied it.
  - Recorded answers in place of `route.fetch()`, the first option D. The user rejected it on 2026-11-03. It is the only design with no teardown wait, and the user can bring it back.
  - Ignore errors, add retries, raise timeouts, or skip tests. The user prohibited these.
  - A Playwright upgrade. It changes files outside the scope of the tests, and no verified release fix is known.
  - Wait for network idle, or add a sleep. Neither gives a route-completion signal.
  - Keep `main` as it is, without option C. The original "route.fetch: Test ended." flake stays.
  - Accept the new flake under the global wait. The gate stays flaky, so this does not meet the goal.
  - Wait for the final navigation in the GitHub spec. It depends on a cause that nobody confirmed, and it protects only one spec.
  - Private Playwright fields or a dummy route. They depend on Playwright internals, and public options exist.
  - The mark of C with the tracking of B. Its only gain over C is the unproven gain of B on owned pages. A later change can add B on top of C.
- **Shared assumptions:** The options check named these. Each one holds and stays.
  - Build-double handlers keep a live `route.fetch()`, so some teardown must wait. Source: the user's decision of 2026-11-03. Its reason is weaker now, because the reused call has an unexplained hang. Only recorded answers drop it.
  - The blocked work is inside the new `page.unrouteAll` call. Source: the gate stack.
  - Playwright stays at the version of the root lockfile, 1.61.1 on 2026-11-17, and only its public calls are used. Source: the file limits of the task and the cleanup call.
  - The fix adds no retry, sleep, longer timeout, suppression, skip, removal, gate, or committed teardown test. Every assertion stays. Source: the user's directions of 2026-11-03. Commit `d7118e8a0` breaks this assumption for "Test ended.", and option D asks the user to accept that.
  - The fix acts in the fixture teardown, not in spec bodies. Source: the user's decision of 2026-11-03. A spec fix drops it, so it stays left out.
- **Wider fix:** C, not B. The class is a build-double teardown that runs in tests without the build double. C is a mark that the shared fixture honours, so unowned pages skip the call whichever step blocked. B works only if the callback wait blocked. B stays the wider fix for the earlier class: running handlers that meet removed routes.
- **Previous examples:** The list below gives them.
  - The fixture edit alone timed out in `build-closed-mobile.spec.ts:11`. The cleanup in `answering` fixed that build-double timeout. The complete gate then found the separate GitHub timeout.
  - `main` already runs the waiting unroute at `build-settings.spec.ts:100` and `:139`, and at `build-references.spec.ts:208`. No failure from these calls is recorded.
  - A history search found those three calls in commit `26c3e7d0`, from PR #45. That search was incomplete.
- **Recommendation:** C. It removes the named call from every unowned page without knowing which step blocked, and it keeps the user's call on all owned pages.
- **Action:** ask the user, because the new timeout remains unexplained after ten diagnostic passes. B changes the waiting mechanism, C narrows its coverage, and commit `d7118e8a0` applied an option that the user rejected on 2026-11-03.

The first decision record, as history. On 2026-11-03 the user chose its option C. Until then, the item held these fields:

- Kind: Outside the scope.
- Reason: The test helpers are the same on `main`, and the pull request that met the flake did not touch them.
- Problem: A handler can still await `route.fetch()` when its test ends. Playwright then throws "route.fetch: Test ended.", which `answering` does not ignore, so the whole run fails.
- Impact if no action: The app browser suite can fail at random, and each failure costs a CI rerun.
- Root question: How does a route handler of the build double end safely when its test ends first?
- Options:
  - A. Add "Test ended" to the messages that `answering` ignores. It hides a handler failure, so it needs the user's approval. Effort: Small.
  - B. End each build-double test with `await page.unrouteAll({ behavior: "ignoreErrors" })`. Playwright then does not wait for running handlers. It silently catches all their later errors, so it needs the user's approval. Effort: Small.
  - C. Give the shared `page` fixture in `harness.ts` a teardown that calls `await page.unrouteAll({ behavior: "wait" })`. Effort: Small.
    - Playwright then waits for each running handler before the test ends. It catches no error.
    - Risk: a handler that a failed test leaves held stops the teardown until the 120-second test timeout. An example is `holdBuildReads` at `apps/app/src/_tests_/build-announcements.spec.ts:122`. The failure still shows.
    - Before the change, confirm the race with a targeted run or a fresh CI stack that shows "route.fetch: Test ended.". Check the held-read risk too.
  - D. Let the double answer each request from its own rows and a recorded real answer, without `route.fetch()`. No handler then waits on the network. It needs a recorded answer for each overlaid request. Effort: Medium.
- Left out: The list below gives the approaches that the options leave out.
  - A fix in the one flaky spec. All 24 build-double specs install the same handlers, so a fix in one spec fails the goal.
  - Build state from the real API without the double. The test API cannot create build states, as the comment at `build-references.spec.ts:158-159` says.
- Wider fix: C. One teardown in the shared fixture covers every spec that takes `test` from `harness.ts`, and it hides no error.
- Previous examples: The list below gives them.
  - The deleted [desktop app shell plan](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L782-L788) recorded the same failure as "Main merge CI flake 1", at commit `05cf1d9d` and on `main` at `44f2a5f3`. Both reruns passed.
  - The suite already calls `page.unrouteAll({ behavior: "wait" })` at `build-settings.spec.ts:85` and `:124`, `build-references.spec.ts:161` and `viewer/entry-states.spec.ts:112`.
  - The calls in `apps/app/src/_tests_/account.spec.ts:181`, `:211` and `:253` use the default behavior, which does not wait.
- Recommendation: C. It removes the race without hiding an error, and the suite already uses this call.
- Action: fix after merge, apply C, because the flaky helper is outside the branch that met it.

Failures, as history. These facts come from the recorded runs. They do not prove a failure at commit `f568853e`.

- On 2026-10-26, attempt 1 of CI run 40396307516 failed the App checks job. The error text was:
  `Error: "route.fetch: Test ended." while running route callback.`
- The stack ran from `build-routes.ts:32` and `:87` to `answerRows` at `build-answers.ts:93`, for `GET /v1/projects/<id>/pull-requests`.
- Playwright reported "1 error was not a part of any test", 334 passed and 1 did not run. Attempt 2 passed.
- The test that did not run was `apps/app/src/_tests_/build-order-mobile.spec.ts:18` on the `mobile` project. Its title is "a phone shows a closed pull request's running build, then its closed card and the Team card".
- It is the same test in all three recorded failures. The suspected source is a handler of that test that awaits `route.fetch()` after the test ends.

Failures from 30 October to 1 November 2026, found on 2026-11-01 from the branch `calummoore/ci-pipeline-duration` and from the closed PR #87:

- Each run below failed its App checks job with the same summary: "1 error was not a part of any test", and 1 or 2 tests "did not run". The error text was `Error: "route.fetch: Test ended."`, for `GET /v1/projects/<id>/pull-requests`. The test retry cannot help, because the error is outside any test.
  - CI run 41042615066, on `main`, 2026-10-30.
  - CI run 41074435624, on `main`, 2026-10-30. The merged change was plans-only.
  - CI run 41218499525, branch `calummoore/beijing-v3`, 2026-10-31.
  - CI run 41303012130, branch `calummoore/beijing-v3`, 2026-11-01.
  - CI run 41312410200, PR #87, 2026-11-01. The pull request changes only plans.
  - CI run 41318940013, attempt 1, PR #88, 2026-11-01. The pull request changes only plans. Attempt 2 passed.
- In the runs of 41318940013 and 41312410200, the error came after `build-fork-mobile.spec.ts:11` and `build-closed-mobile.spec.ts:11` passed. The test that did not run was `build-order-mobile.spec.ts:18`, as in the earlier failures.
- The same error also failed single attempts inside tests, which then passed on the retry: `build-references.spec.ts:45` in 4 runs, `build-references.spec.ts:107` in 4 runs, and `build-order.spec.ts:66` in 1 run.
  - In CI run 41312410200, `build-order.spec.ts:66` and `build-references.spec.ts:107` failed this way, at `build-answers.ts:93` and `build-routes.ts:61`. PR #87 recorded these two failures.

Failure on 2026-11-02, found from the branch `calummoore/ci-pipeline-duration`:

- CI run 41370073016, attempt 1, job 125038450920, App checks 1/4, at commit `07febda2`. All 12 jobs of the run passed. The branch changed neither the test nor `build-routes.ts`.
- The first attempt of the desktop test `build-states.spec.ts:14`, "a lockfile builds cannot install links the CI guide", failed after 24.7 seconds. The error was `Error: "route.fetch: Test ended."` while running route callback, for `GET /v1/workspaces/by-slug/<workspace>/projects/<project>`.
- The stack ran from `answering` at `build-routes.ts:32` to the project read handler at `build-routes.ts:61`, which awaits `route.fetch()`.
- The retry passed in 1.8 seconds, so the job reported "1 flaky". The error came inside the test, so the retry could pass it.

Additional CI occurrences on 2026-11-02, found from the branch `calummoore/ci-pipeline-duration`:

- Run 41382205841, attempt 1, at commit `0d1e5bb9`, failed App checks 4/4 in job 125075243626. The error was `route.fetch: Test ended.` after a route callback outlived its test. This branch does not change the build route handlers. The rerun in attempt 2 passed. No route-handler source changed.

- Documentation-only head `6216f480`, CI run 41389467855 attempt 1: App checks 4/4, job 125097581754, failed with an out-of-test `route.fetch: Test ended.` callback. The runtime source is identical to the passing `0d1e5bb9` code. Attempt 2 passed without a source change.

Failure on 2026-11-18, found from [PR #132](https://github.com/mokly-ai/mokly-cloud/pull/132), branch `calummoore/desktop-browser-authentication`:

- CI run 44308124659, attempt 1, App checks 4/4, job 134814910432, at commit `0e21b7be`. The branch was not behind `main` and changes neither `build-order-mobile.spec.ts`, `build-answers.ts` nor `build-routes.ts`.
- The job summary was "1 did not run", "93 passed" and "1 error was not a part of any test". The test that did not run was `build-order-mobile.spec.ts:18`. The error was `Error: "route.fetch: Test ended."` while running a route callback, for `GET /v1/projects/<id>/pull-requests`, at `answerRows` in `build-answers.ts:93` from the handler at `build-routes.ts:85`.
- The rerun of the failed job, attempt 2, passed without a source change.
