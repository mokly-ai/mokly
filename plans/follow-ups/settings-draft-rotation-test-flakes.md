# Settings rotation test reads the address too early

- **Severity:** High. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from branch `calummoore/mac-title-bar-integration`, the CI run of its pull request. On 2026-11-25 the branch `calummoore/ci-speed-flaky-follow-ups-b-and-new-k3dt` merged the item `flaky-settings-surface-address.md` into this one and added a code analysis of the cause.
- **Location:** `packages/app/src/_tests_/settings/drafts.spec.ts:115`, the test "a draft survives the surface changing under it", its quick series at lines 152-158, and its local `settleAddress` helper.
- **Reason:** The user has not chosen how the test observes the end of a hand-over, so the fix waits for that answer.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Surface:** the form in which settings open: a dialog over the page on a wide screen, or a full-screen layer route below the 768px breakpoint.
  - **Hand-over:** the address replacement that moves settings from one surface to the other when the screen width crosses the breakpoint.
  - **Route wait:** the dialog that a settings route draws on a wide screen until its hand-over lands, in `packages/app/src/settings/route-wait.tsx`.
  - **Scope read:** the read of the reader's workspaces and the named project that a settings surface needs before it draws a pane, in `packages/app/src/settings/scope.ts`.
- **Background:**
  - The test signs in, opens the project pane of the layer route with a query on a 390px screen, and types a draft. It changes the viewport to 1024px and back to 390px, and checks the address after each change.
  - Last, it sets 1024px, 390px and 1024px in quick succession. It waits for a dialog and two animation frames in `settleAddress`, and expects the address to end with `&settings=project`.
  - `useLayerAddress` in `packages/app/src/settings/layer-address.ts` hands the layer route over to the dialog. The compact effect in `packages/app/src/settings/dialog-host.tsx:198-215` hands the dialog over to the layer route. Both call `replaceAddress` in `packages/app/src/navigation/address.ts`, which keeps one exact replacement and restores those bytes for up to three animation frames.
  - The failure text:

    ```text
    Expected: "?handoff=one%26two+literal%2Bplus%23notes&tag=first&tag=second&settings=project"
    Received: "?handoff=one%26two+literal%2Bplus%23notes&tag=first&tag=second"
      > 156 |   expect(new URL(page.url()).search).toBe(`?${query}&settings=project`);
    ```

  - CI runs 44375124852, 44392544275, and the push run 44092627524 of `main` at `6d5163d6` failed it on the first try and on the retry. On 2026-11-21 the frozen-base gate of `calummoore/mokly-incremental-render-keys-38ts` saw it fail once and pass on the runner retry.
  - Locally, with `--repeat-each 30 --retries 0 --project desktop --workers 1`, it failed 15 of 30 runs on `main` at `55972c86` and 14 of 30 on a branch. The page snapshot of each of 29 failures shows the viewer route's wait, the heading "Opening your project…", and no dialog.
  - On 2026-11-25, a trace of every history call in 20 runs gave 11 failures. Each failed run wrote only `replaceState`, with no `popstate` or traversal. Its last write put `&settings=project` back 50 to 160 ms after the write before it. `main` failed 1 of 20 runs on a quiet machine and 6 of 20 on a busy one.
  - A code analysis on 2026-11-25 names the mechanism:
    - At 1024px the first compact settings route hands over at once, because its scope read is done.
    - At 390px the compact effect of the dialog host writes `/{workspace}/{project}/settings?{query}`. The router mounts a new settings route, which starts its scope read: `listWorkspaces`, then `getProjectBySlug`, one after the other.
    - At 1024px the new route draws the route wait, which has the role `dialog`. Its hand-over returns early until the scope read answers, at `layer-address.ts:61`. The test's `getByRole("dialog")` matches the route wait, and two frames later the address still has no settings key.
    - When the scope read answers, the route writes `/{workspace}/{project}?{query}&settings=project` with exact bytes, at `layer-address.ts:67-74`. The final state is right, and no write is stale.
    - The received query encodes the space as `+`, which is the app's own write. The router writes `%20`. So `pageBeneath` in `packages/app/src/settings/routes.ts` is not the source.
    - The route wait is designed behaviour: `packages/app/README.md:228` and `docs/protocol/cloud/product-mockups-settings.md:99` describe it.
  - Mokly Cloud pull request #131, commit `fd260b1a` of 2026-11-06, added the route wait. It changed `openDialog` in `packages/app/src/_tests_/harness.ts:142-152` and `openDialogInApp` in `packages/app/src/_tests_/settings/in-app.ts:23-28` to wait for the address first. This test kept its two frames. `packages/app/src/_tests_/settings/route-waits.spec.ts:23-81` already covers the late hand-over with held reads.
  - The analysis does not explain why all 29 failure snapshots show the viewer's wait. Playwright takes the snapshot when it closes the context, which can be just after the last write and before the dialog host draws.
- **Problem:** The test takes the route wait as the end of the hand-over. It then reads the address of the compact route, before the correct last write lands one scope read later.
- **Impact if no action:** The required app check fails now and then, and its one retry often fails as well. It blocks pull requests until a rerun passes. Readers are not affected.
- **Root question:** How does the test know that a quick series of surface changes has ended, so that it checks the newest surface and its exact address?
- **Options:**
  - **A.** Before each address check, wait for the address with `expect(page).toHaveURL`, as `openDialog` does. Keep every assertion. The wait uses the configured expect limit, which the deterministic-test rule allows for an expected state. Record repeat counts before and after. Effort: Small.
  - **B.** Reproduce the race with a trace of each address write, name the write, and fix the product so that only the newest hand-over wins. The analysis finds that the newest hand-over already wins, so B ends in A after a longer reproduction. Effort: Medium.
  - **C.** Do A, and give the hand-over one owner in the root layout. It keeps the scope and writes the newest address in the task of the width change. It must keep `?settings=` on the durable route below the breakpoint. Effort: Large.
  - **D.** Do A, and let the route that a hand-over mounts start from the scope that the dialog host holds, so that it hands over at once. It needs a shared scope store that follows the invalidation rules. On 2026-11-25, pull request #522 chose to stop remounts, not to cache reads. Effort: Medium.
- **Left out:**
  - More animation frames, a sleep, or a retry: they hide the late write, and the deterministic-test rule forbids them.
  - Remove the quick series: A keeps the same coverage at the same cost.
  - Make the route wait stop being a dialog: it breaks the documented route wait.
  - Hand over before the scope read: it breaks the rule that a project the reader cannot open hides the project section and does not fail the page.
- **Wider fix:** None. Since pull request #131, the shared settings helpers wait for the address first. No other browser test reads an address a fixed number of frames after a surface change.
- **Previous examples:** `openDialog`, `openDialogInApp`, and `expectSettingsHandoff` in `packages/app/src/_tests_/settings-address-handoff.ts:36-38` wait for the address in the same way.
- **Recommendation:** A. The test misses a correct write that lands one scope read late by design. C best protects the codebase, because one owner removes the remount and the second scope read from every hand-over. Until 2026-11-25 the recommendation was B.
- **Action:** ask the user, because the user has not answered this choice, and the open decisions of the CI speed work stay with the user.
