# Viewer layout repeats dark at 320 px

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from branch `calummoore/ci-speed-test-scope-items-9-to-15-and-19-rsi4` (PR #574), test-scope item 10B.
- **Location:** `tests/browser/viewer_layout.spec.ts:55-67`.
- **Reason:** The user's test-scope decision covered copies at 390 px only, and this copy runs at 320 px.

- **Background:** `LAYOUT_CASES` in `tests/browser/viewer_layout.spec.ts` runs the embedded layout test at 1440, 900, 390, and 320 px. The test-scope change of 2026-11-26 removed the 390 px dark case, because the compact search branch at that width has no scheme input.
- **Problem:** The 320 px dark case runs the same compact branch as the 320 px light case. It may repeat it with the same result.
- **Impact if no action:** One browser test of a few seconds runs on each CI run, possibly as a copy.
- **Root question:** Does the compact layout need a dark run?
- **Options:**
  - **A.** Keep the 320 px dark case. Effort: Small.
  - **B.** Find what differs in dark at 320 px. When nothing differs, prove it with a break and remove the case. Effort: Small.
- **Left out:** Remove it without a proof, because the testing rules need one.
- **Wider fix:** None. Each copy needs its own review.
- **Previous examples:** The 390 px dark case of the same table, removed on 2026-11-26.
- **Recommendation:** B. A proof decides it in a few minutes.
- **Action:** ask the user, because the removal of a second-width copy needs the user's approval.
