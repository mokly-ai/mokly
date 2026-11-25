# Settings draft rotation test flakes

- **Severity:** High. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from branch `calummoore/mac-title-bar-integration`, the CI run of its pull request.
- **Location:** `packages/app/src/_tests_/settings/drafts.spec.ts:115`, the test "a draft survives the surface changing under it", and its assertion at line 156.
- **Reason:** The test fails on `origin/main` too and its cause is unknown, so its fix needs its own branch and a reproduction.

- **Terms:**
  - **Surface:** the form in which settings open: a dialog over the page on a wide screen, or a full-screen layer route below the 768px breakpoint.
  - **Hand-over:** the address replacement that moves settings from one surface to the other when the screen width crosses the breakpoint.
- **Background:**
  - The test signs in, opens the project pane of the layer route with a query on a 390px screen, and types a draft.
  - It changes the viewport to 1024px and back to 390px, and checks the address after each change.
  - Last, it changes the viewport to 1024px, 390px and 1024px in quick succession. It waits for a dialog and two animation frames, and expects the address to end with `&settings=project`.
  - Three places write the address in a hand-over. `useLayerAddress` in `packages/app/src/settings/layer-address.ts` hands the layer route over to the dialog. The compact effect in `packages/app/src/settings/dialog-host.tsx` hands the dialog over to the layer route.
  - Both call `replaceAddress` in `packages/app/src/navigation/address.ts`. It keeps one exact replacement, and it restores those exact bytes for up to three animation frames.
- **Problem:** After the quick changes, the address sometimes keeps the query without `&settings=project`. The failure text is:

  ```text
  Expected: "?handoff=one%26two+literal%2Bplus%23notes&tag=first&tag=second&settings=project"
  Received: "?handoff=one%26two+literal%2Bplus%23notes&tag=first&tag=second"
    > 156 |   expect(new URL(page.url()).search).toBe(`?${query}&settings=project`);
  ```

  - The page snapshot of each of 29 local failures, 15 on `main` and 14 on the branch, shows the viewer route's wait, the heading "Opening your project…", and no dialog. So the reader ends on the project page without the dialog.
  - That address is the page beneath the dialog, which `pageBeneath` in `packages/app/src/settings/routes.ts` gives. Which write leaves it there is unknown.
  - CI run 44375124852 of commit `f4bc497b` failed the test in the job App checks 2/4, on the first try and on the retry. A rerun of the failed jobs failed it the same way.
  - The push CI run 44092627524 of `main` at `6d5163d6`, on 2026-11-17, failed the same test with the same text, on the first try and on the retry.
  - CI run 44386980398 of the next branch commit, `6704dc72`, passed the test.
  - CI run 44392544275 of branch commit `091b90a7` failed it on both tries. A rerun of the failed jobs failed it the same way.
  - Locally, with `--repeat-each 30 --retries 0 --project desktop --workers 1`, it failed 15 of 30 runs on `origin/main` at `55972c86` and 14 of 30 on the branch. An earlier set of 10 runs failed 2 on `main` and 4 on the branch. So the branch does not change the rate.
  - On 2026-11-25, branch `calummoore/header-bar-loading-issue-mqph` traced each `pushState`, `replaceState`, `go`, `back`, `forward` and `popstate` in 20 runs, and 11 failed. No failed run had a `popstate` or a history traversal. Each one wrote only `replaceState`, and its last write put `&settings=project` back, 50 to 160 ms after the write before it. So in these runs the address arrived late, after the two animation frames, and no write dropped it. The rate followed the machine load: `main` failed 1 of 20 runs on a quiet machine and 6 of 20 on a busy one.

- **Impact if no action:** The test fails about half of its local runs, on `main` too, and the one retry of CI often fails as well. So the required app checks fail and block pull requests until a rerun passes. If the race is in the product, a reader who quickly resizes a window across the breakpoint loses the open settings dialog.
- **Root question:** How does a quick series of surface changes always leave the address of the newest surface?
- **Options:**
  - **A.** Wait in the test until the address ends with `&settings=project`, with `expect.poll`, instead of two animation frames. It assumes that only the test waits too little, which the failure snapshot makes unlikely. It also raises a time limit, so it needs the user. Effort: Small.
  - **B.** Reproduce the race with a trace of each address write. Name the write that leaves the page beneath, and fix it so that only the newest hand-over wins. Keep every assertion of the test. Effort: Medium.
  - **C.** Do B, and give the hand-over one owner. One module receives each surface change and writes only the newest surface's address. Effort: Large.
- **Left out:** A retry of the test. It hides the race.
- **Wider fix:** C. One owner of the hand-over removes stale writes between the two surfaces.
- **Previous examples:** None found.
- **Related:** None.
- **Recommendation:** B. The failure snapshot points at a race in the product, and only a reproduction can name the write.
- **Action:** ask the user, because no option is clearly best until a reproduction names the write that drops the settings key.
