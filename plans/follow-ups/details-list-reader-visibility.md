# The Details list reader reads hidden text

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from branch `calummoore/test-audit-mokly-browser-and-viewer-din6`, the wider fix of review finding 6.
- **Location:** `tests/browser/comparison_evidence_page.ts`, `evidenceFiles`; `tests/browser/comparison_stylesheet_details.spec.ts`, the viewport loop of "a screen the changed styles reach names them in Details".
- **Reason:** The fix changes the checks of specs outside the audit branch's diff, so it gets its own review.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Details:** the part of the right panel that lists the stylesheets that explain a comparison result, with an outcome sentence for each file.
- **Background:** Five browser specs read the Details list through `evidenceFiles`, which reads `textContent`. The audit branch restored one `toBeVisible` check of the first file's sentence in the changed-screen journey.
- **Problem:** A CSS rule that hides a sentence, a selector, or a file row still passes every exact-list read of the five specs. Also, the viewport loop of "a screen the changed styles reach names them in Details" calls `setFrames`, which selects Inspect, so the loop reads Details in a hidden tab body.
- **Impact if no action:** A reader can lose an outcome sentence of a non-first file while the list checks still pass.
- **Root question:** How do the Details list checks read what the reader sees?
- **Options:**
  - **A.** Make `evidenceFiles` return only the visible parts, as `tests/browser/comparison_navigation.spec.ts:23` filters rows with `checkVisibility()`. Reopen Changes in the viewport loop. Prove each spec with a CSS break. Effort: Medium.
  - **B.** Add `toBeVisible` checks for each sentence in each of the five specs. Effort: Medium.
- **Left out:** A markup-only check, because it cannot apply the cascade.
- **Wider fix:** A. One reader serves the five specs.
- **Previous examples:** Review finding 6 of the audit branch: the fold of "a change that can reach anything says so without naming a status" kept the text but lost its visibility check.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because it changes checks of specs outside the audit branch's diff.
