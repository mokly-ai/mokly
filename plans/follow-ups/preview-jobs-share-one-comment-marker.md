# Three preview jobs overwrite one comment

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-flaky-follow-ups-b-and-new-k3dt`, a finding check of its review.
- **Location:** `.github/workflows/preview.yml`, the `deploy-pr`, `close-pr`, and `release` jobs, and `infra/scripts/preview-comment.py:103`.
- **Reason:** The branch changed only how these steps retry, not which comment each job writes.

- **Source:** Review.
- **Category:** Product bug.
- **Background:**
  - The `deploy-pr` and `close-pr` jobs report the Cloudflare Pages preview. The `release` job reports the cloud preview. All three write a comment that holds `<!-- mokly-preview -->`, and `infra/scripts/preview-comment.py:103` starts its body with the same marker.
  - Each job updates the first bot comment with that marker. So each job overwrites the body of the others.
  - On pull request 529, `deploy-pr` created the comment at 2026-11-25 16:34:57 UTC, and it later held the `release` body "Preview removed".
- **Problem:** Two different previews share one comment, so the comment shows only the last job's preview.
- **Impact if no action:** A reviewer can miss the link or the state of one preview, or read a "removed" state for a preview that still runs.
- **Root question:** How does each preview of a pull request keep its own current comment?
- **Options:**
  - **A.** Give the Cloudflare Pages jobs their own marker, for example `<!-- mokly-pages-preview -->`. Effort: Small.
  - **B.** Write both previews into one comment with two sections, which each job updates in place. Effort: Medium.
  - **C.** Remove the Cloudflare Pages comment when the cloud preview replaces that preview. First confirm with the owner of `docs/ops/preview.md` that the Pages preview is no longer needed. Effort: Small.
- **Left out:** None.
- **Wider fix:** None. The finding is one marker choice.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/shared-preview-comment-publisher.md`, the same steps.
- **Recommendation:** A. It separates the two previews with the smallest change.
- **Action:** fix after merge, apply A, because the branch that found it changed only the retry of these steps.
