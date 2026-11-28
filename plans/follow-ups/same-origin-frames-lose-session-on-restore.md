# Same-origin frames lose inspection on restore

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-28, from the check of finding 3 of the review of the branch `calummoore/embedded-access-start-page-worker-and-1p13`.
- **Location:** `packages/frame/src/adapters/same_origin_mount.ts:240` and `packages/frame/src/page_exit.ts`.
- **Reason:** The same-origin mount had this behaviour before that branch, which fixed only the cross-origin adapter and the probe.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Same-origin mount:** the frame adapter that the Browse shell uses when the frames come from the viewer's own origin, as in Serve and the static build.
  - **Back-forward cache:** the browser's retained copy of a page, which it restores on Back or Forward without a new load. It sends `pagehide` with `persisted: true` before it keeps the page, and `pageshow` with `persisted: true` on return.
- **Background:**
  - `packages/frame/src/page_exit.ts` holds one page-exit rule: a `pagehide` with `persisted: true` keeps the session, and any other `pagehide` disposes it. The `postMessageAdapter` and the frame probe use it since commit `55537c5c2`.
  - `same_origin_mount.ts` still disposes the mount on every `pagehide`, at line 240.
  - The standalone shell keeps its React root on a persisted `pagehide` (`packages/viewer/src/browser.tsx:26`), so after Back the shell shows its frames again, but their inspection sessions are disposed.
  - `MoklyViewer` uses the same-origin adapter by default (`packages/viewer/src/viewer/component.tsx:50`), so React hosts meet the same defect.
  - A Back or Forward restore is normal use, so the likelihood is Common. The same review graded the same trigger Common for cross-origin frames.
- **Problem:** After a restore from the back-forward cache, the frames of the standalone shell show their screens, but inspection does not respond.
- **Impact if no action:** A reader who goes Back to a standalone catalogue must reload or change screens to inspect again.
- **Root question:** How does a same-origin frame keep its inspection session when the browser restores its page?
- **Options:**
  - **A.** Use the page-exit rule of `page_exit.ts` in `same_origin_mount.ts`, with a test in `tests/browser/same_origin_adapter.spec.ts` that sends `pagehide` and `pageshow` with `persisted: true`, as `tests/browser/frame_adapter_restore.spec.ts` does for cross-origin frames. Risk: a kept session must answer again after the restore, which the probe already does. Effort: Small.
  - **B.** Remount every frame on a persisted `pageshow`. This reloads each mockup and can reset reader input. Effort: Medium.
- **Left out:** A guard that ignores events after disposal, because the session stays disposed.
- **Wider fix:** A, because every adapter then shares one page-exit rule.
- **Previous examples:** Commit `55537c5c2` fixed the same defect in `postMessageAdapter` and the probe.
- **Recommendation:** A. It reuses the rule that both other ends already follow, and keeps the reader's place.
- **Action:** fix after merge, apply A, because the defect is older than the branch that found it.
