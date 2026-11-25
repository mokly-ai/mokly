# Changelog playhead label passes the page side

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch `calummoore/homepage-functionality-vjxs`, review round 2, a new problem that the fix of finding 7 found.
- **Location:** `apps/site/src/styles/changelog-timeline.css`
- **Reason:** The rule is on `origin/main`, outside the diff of the home zoom change.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Classic scrollbar:** a scrollbar that takes room beside the page, as Chrome draws it on Windows and Linux.
  - **Playhead label:** the version label, such as "v0.21.0", that the changelog's release timeline draws at its current release.
- **Background:** The public site's changelog page draws a release timeline with a playhead label. The site design rules say that no part passes the window at 320px width and 200% text.
- **Problem:** In a 320px Chrome window with 200% text and classic scrollbars, the page area is 305px wide. The "v0.21.0" playhead label then passes the page's right side by about 1.2px. Playwright's default runs hide scrollbars, so the site browser suite does not see it.
- **Impact if no action:** On Windows or Linux with enlarged text on a very narrow window, the label's last pixel is cut off.
- **Root question:** How does the playhead label stay inside the page area at every supported width and text size?
- **Options:**
  - **A.** Let the label wrap or shrink its side offset when the timeline is narrower than the label. Add a case to a browser spec that shows classic scrollbars, at 320px with 200% text. Effort: Small.
  - **B.** Add the changelog page to a shared classic-scrollbar overflow check of every site page at 320px with 200% text. Effort: Medium.
- **Left out:** A smaller label text breaks the rule that text follows the reader's text size.
- **Wider fix:** B. It finds every part that passes the page area only when a classic scrollbar takes room.
- **Previous examples:** `plans/follow-ups/overflow-checks-count-the-scrollbar-width.md` records overflow checks that count the scrollbar as page width.
- **Recommendation:** A. It fixes the one label at the lowest cost.
- **Action:** fix after merge, apply A, because the label is on `origin/main` and outside the home zoom change.
