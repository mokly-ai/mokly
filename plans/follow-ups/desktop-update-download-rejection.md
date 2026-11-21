# The desktop updater leaves a failed download unhandled

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the `Outside the scope` list of review round 2
  on branch `calummoore/desktop-release-process-ujn3`.
- **Location:** `packages/desktop/src/updates.ts`, the `query` function.
- **Reason:** The problem was on `main` before that branch, so it belongs in
  its own change.
- **Category:** Product bug.

- **Background:** The desktop updater calls `checkForUpdates()` of
  `electron-updater`. With automatic download on, the result also carries a
  `downloadPromise`. The updater reports a failed download through its
  `error` event, which the app logs.
- **Problem:** The app never awaits or catches `downloadPromise`. A reviewer
  ran the pinned `AppUpdater` with a download that fails. Both the old and
  the new code logged the failure and then raised
  `unhandledRejection: download connection reset`.
- **Impact if no action:** A failed download writes a second, unhandled error
  to the main-process log. It does not stop the app.
- **Root question:** How does the app treat each failure of an automatic
  download once?
- **Options:**
  - **A.** Attach a handler to `downloadPromise` that ignores the rejection,
    because the `error` event already logs it. Add a logic test with a
    rejecting promise. Effort: Small.
  - **B.** Await `downloadPromise` in the automatic check and route its
    failure through the existing warning. Effort: Small.
- **Left out:** A global `unhandledRejection` handler, because it would hide
  other defects.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** A. The `error` event stays the one place that logs a
  failed download.
- **Action:** fix after merge, apply A, because the problem predates the
  branch.
