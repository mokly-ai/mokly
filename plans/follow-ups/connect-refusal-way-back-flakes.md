# Connect refusal way back test is flaky

- **Severity:** Medium. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-04, from the complete gate of branch `conductor/follow-ups-mockup-overlay-focus` on 2026-11-03, an unrelated flaky test.
- **Location:** `apps/app/src/_tests_/connect.spec.ts:133-158`, `apps/app/src/screens/account/github-callback-screen.tsx:37` and `:67`, `apps/app/src/screens/app/workspace-route.tsx:38-40`, and `apps/app/src/screens/account/install-screen.tsx:246-250`.
- **Reason:** The branch that met the flake changes no app code and no app test, and the flaky-test rule fixes an unrelated flaky test in its own branch.
- **Checked:** The gate ran on 2026-11-03, on a mockup-only branch based on `main` at commit `50283907`. The test failed once and passed on its configured retry. On 2026-11-04, after `main` at commit `08b3a98b` merged, the test and its wait at line 163 were unchanged. Nobody ran a controlled reproduction.
- **Category:** Test.

- **Terms:**
  - **Recorded account:** The GitHub installation 1 that the app browser tests install through the test harness.
  - **Refusal page:** The GitHub callback page with the heading "This GitHub account is connected to another workspace", the line "Remove it from that workspace first." and a **Back to install** button.
  - **Repository step:** The third setup step, at `/<workspace-slug>/-/new`, with the heading "Choose a repository".
- **Background:**
  - The test `an account another workspace holds is refused with the way back` signs in and creates the project "Holder Org", which installs the recorded account for real. It then creates a second workspace, "Asker Org".
  - It opens `/install?workspaceId=<Asker Org>&installationId=1`, continues on GitHub and waits for `/auth/github/callback`. The refusal heading, the alert line and the one `details` element all pass.
  - At line 162 it clicks **Back to install**. At line 163 it waits with `page.waitForURL((url) => url.pathname === "/install")`.
  - For an install attempt, **Back to install** leads to the bare path `/install`, at `github-callback-screen.tsx:37` and `:67`. That path names no workspace.
  - A bare `/install` loads the first workspace of the reader's list, at `workspace-route.tsx:38-40`.
  - `InstallScreen` hands a workspace whose GitHub account is connected on to its repository step through `router.replace`, at `install-screen.tsx:246-250`. Holder Org's account is connected.
  - The app Playwright configuration retries a failed test once. In the gate, the app stage passed after 29.7 minutes: 371 tests passed, and one test was flaky.
- **Failure:** The desktop project failed at `connect.spec.ts:163:14`, the wait after **Back to install**, with this text:

  ```text
  [desktop] › src/_tests_/connect.spec.ts:139:5 › an account another workspace holds is refused with the way back
  TimeoutError: page.waitForURL: Timeout 30000ms exceeded.
  =========================== logs ===========================
  waiting for navigation until "load"
  ============================================================
  ```

- **Observed page:** The page snapshot at the timeout shows Holder Org's repository step:
  - the heading "Choose a repository", and a Repository control that reads "Choose a repository"
  - the address preview `localhost:8081/holder-org/`
  - the link "Publish with the CLI instead" to `/holder-org/-/new/cli`
  - the setup progress with Workspace and Install done, and Repository as step 3
- **Retry:** The configured retry of the same test passed in the same run. No other app test failed in the final result.
- **Suspected source:** Unproven. The failure fits two sources, and no run separates them:
  - The order of the workspace list. When Holder Org is first, a bare `/install` always hands on to Holder Org's repository step.
  - The timing of that hand-on. The wait passes only when it sees `/install` before `router.replace` runs.
- **Problem:** After **Back to install**, the test waits for the path `/install`. In one run the page showed Holder Org's repository step instead, and the wait timed out after 30 seconds. The retry passed, so the result depends on timing or on order.
- **Impact if no action:** The test can fail the `cloud-app` suite at random, and a failure of the retry too fails the complete gate. If the list order is the source, the way back can also take a reader to the repository step of the workspace that holds the account.
- **Root question:** How does the test check the way back from the refusal page, whatever the order of the workspace list and the timing of the install screen?
- **Options:**
  - **A.** Investigate first. Read the order in which the API lists a reader's workspaces. Reproduce the test with a controlled order and a controlled event order. Then fix the source that the reproduction names, and keep every assertion and time limit. Effort: Medium.
  - **B.** Make **Back to install** keep the workspace that the reader asked for, as `/install?workspaceId=<id>`. The install step of that workspace then stays, because its account is not connected. It changes the recovery address, which is product behaviour. Effort: Small.
  - **C.** Change only the test. After **Back to install**, wait for the page that the way back must reach, not for the path `/install`. Keep the refusal checks. It fits only if the current product behaviour is right, and it changes the expected result of the test. Effort: Small.
- **Left out:**
  - A retry, a sleep, a longer time limit, a skip or a removal of the test. Each hides the source, so each fails the goal. The `testing` skill also allows each of them only with the user's approval.
- **Wider fix:** None yet. No source is proven, so no fix for the class can be named.
- **Previous examples:** Until 2026-11-04, the item `app-completed-steps-read-once.md` recorded setup-strip checks that read the step list once, before the screen settled. Three of them were in this file, at lines 59, 107 and 193. Commit `08ffd6c9`, from PR #105, changed those reads and deleted that item. Its cause, a one-time read of the strip, differs from this wait for an address after a click.
- **Recommendation:** A. The source is unknown, and A names it before any change. B or C then follows from its result.
- **Action:** ask the user, because the source is unknown, and the fix for one candidate changes where the way back leads, which is product behaviour.
