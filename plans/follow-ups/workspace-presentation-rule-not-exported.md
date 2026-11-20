# No export gives the workspace presentation rule

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from the gap list `plans/follow-ups/mokly-upstream-gaps-to-file.md`, which the Mokly 0.18.0 upgrade of the cloud wrote on 2026-11-02 on the branch `calummoore/mokly-cli-upgrade`. The move of Mokly Cloud into this repository split that list into items.
- **Location:** `docs/mockups/src/screens/product/viewer/published-view.ts:9-30` and `docs/protocol/mokly-changes-controls.md:7-21`.
- **Reason:** A fix adds a public export to a Mokly package, which the user decides.

- **Source:** Review.
- **Category:** Mockup.
- **Background:**
  - The workspace of the Browse shell shows, for each frame, a view and its fallback, the change status, the comparison band, and the change marks of the view controls. `docs/protocol/mokly-changes-controls.md:7-21` states these rules.
  - No public export of `@mokly/viewer`, `@mokly/model` or `@mokly/ui` gives this presentation for a static depiction.
  - So the cloud mockups restate the rule in `ShownView` of `docs/mockups/src/screens/product/viewer/published-view.ts:9-30`: the scheme, the fallback, the status, `eligible`, and the marks.
  - The review of the cloud mockup work for the Mokly 0.18.0 upgrade found this on 2026-11-02.
- **Problem:** Static mockups restate a rule of the Browse shell, and their copy can drift from it.
- **Impact if no action:** A mockup can show a status, a band or a mark that the shell does not show, and no check finds it.
- **Root question:** How does a static mockup get the workspace presentation of the shell?
- **Options:**
  - **A.** Keep the restated rule in the mockups. Effort: Small.
  - **B.** Export a pure function that gives the presentation of one entry's workspace from the index record and the selection. Use it in the shell and in the mockups. Effort: Medium.
- **Left out:** Draw the live shell inside the mockups. A static mockup has no live viewer.
- **Wider fix:** B. The shell and every drawing then share one rule.
- **Previous examples:** `plans/follow-ups/viewer-data-hides-detail-paths.md` records the same class for the detail path rules.
- **Related:** `plans/follow-ups/viewer-data-hides-detail-paths.md` has the same class of problem, and the same kind of export answers both.
- **Recommendation:** B. One rule then drives the shell and its drawings.
- **Action:** ask the user, because B adds a public export to a Mokly package, which no requirement covers.
