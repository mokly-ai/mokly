# App test files pass 300 lines

- **Severity:** Low. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from Milestone 5 of [PR #77](https://github.com/mokly-ai/mokly-cloud/pull/77).
- **Location:** `apps/app/src/_tests_/viewer/overlays.spec.ts`, `apps/app/src/_tests_/settings/panes.spec.ts`, `apps/app/src/_tests_/harness.ts`, `apps/app/src/_tests_/settings.test.ts`, `apps/app/src/_tests_/stripe-double.ts`, `apps/app/src/_tests_/viewer-mobile.spec.ts`, `apps/app/src/_tests_/viewer/selection.test.ts`, `apps/app/src/_tests_/github-callback.spec.ts`, `apps/app/src/_tests_/account.spec.ts`, `apps/app/src/_tests_/onboarding.spec.ts`, `apps/app/src/_tests_/settings-address-handoff.spec.ts`, `apps/app/src/_tests_/viewer/stage-view.test.ts`, `apps/app/src/_tests_/settings-mobile.spec.ts` and `apps/app/src/_tests_/viewer/access.spec.ts`.
- **Reason:** The files already pass 300 lines on `origin/main`, so a separate branch splits them.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. 14 files under `apps/app/src/_tests_/` pass 300 lines, from 759 lines down to 312.
- **Category:** Code structure (estimate).

- **Background:** The always-on rules target about 200 lines for a file and split a file that passes 300. `AGENTS.md` makes 300 lines a hard cap for Rust files only. Other files may pass the target for generated code, large data or cohesion, but they are split when practical. On 2026-10-29, PR #77 counted 15 app test files past 300 lines, from 732 lines down to 302. Its Milestone 5C split `github-install.spec.ts`, which now has 162 lines. It moved its new walks out of `github-callback.spec.ts`, which still has 381 lines.
- **Problem:** 14 app test files pass 300 lines. The line counts are below.
  - `viewer/overlays.spec.ts`: 759. `settings/panes.spec.ts`: 598. `harness.ts`: 589. `settings.test.ts`: 544.
  - `stripe-double.ts`: 458. `viewer-mobile.spec.ts`: 416. `viewer/selection.test.ts`: 389. `github-callback.spec.ts`: 381.
  - `account.spec.ts`: 379. `onboarding.spec.ts`: 341. `settings-address-handoff.spec.ts`: 322. `viewer/stage-view.test.ts`: 315.
  - `settings-mobile.spec.ts`: 314. `viewer/access.spec.ts`: 312.
- **Impact if no action:** Agents and reviewers read long test files on each change. Each new test in these files adds to the later split.
- **Root question:** How do the app test files return to the length target?
- **Options:**
  - **A.** Split the 14 files in one branch. Group the tests of each file by the behavior that they cover. The split moves tests and helpers into new test files, with no product code change. Effort: Medium (estimate).
  - **B.** Split each file when a branch next changes it. Files that no branch changes stay long. Effort: Medium (estimate).
  - **C.** Do A, and add a length check for changed TypeScript files. A new check is a new gate, so it needs the user's approval. `plans/follow-ups/changed-files-have-no-length-check.md` holds that choice. Effort: Medium (estimate).
- **Left out:** Keep the files as they are. It fails the goal, and no exception for generated code, large data or cohesion covers these files.
- **Wider fix:** C. Only a check stops new files from passing the target, and that check is a pending choice of the user.
- **Previous examples:** PR #77 split `github-install.spec.ts` in its Milestone 5C. [`plans/follow-ups/viewer-stage-mockup-passes-300-lines.md`](https://github.com/mokly-ai/mokly-cloud/blob/164d73db2601d451392a3bfb13b0f918345807b6/plans/follow-ups/viewer-stage-mockup-passes-300-lines.md) records a mockup file of the same class.
- **Related:** `plans/follow-ups/changed-files-have-no-length-check.md`, shared wider fix. It names this item as a previous example.
- **Recommendation:** A (estimate). One branch restores the target for every file, and the split changes no product behavior.
- **Action:** fix after merge, apply A (estimate), because the files were already long on `origin/main` before PR #77.
