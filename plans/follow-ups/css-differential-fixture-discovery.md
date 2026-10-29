# Discover CSS differential fixtures from tracked stylesheets

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** test.
- **Background:** The CSS differential test compares Mokly's scanner with repository stylesheets and generated stylesheets.
- **Problem:** Its static repository list missed two stylesheets. A rename can stop the build. The generated sources also make its nonempty assertion unable to fail.
- **Impact if no action:** Repository CSS can leave the differential corpus silently. A moved file can break the test build.
- **Root question:** How should Mokly discover CSS differential fixtures from tracked stylesheets?
- **Options:**
  - **A.** Update the static list for the two missing files. Maintain it by hand. Effort: Small.
  - **B.** Discover workspace styles inside the unit test. This adds repository file access to a unit test. Effort: Medium.
  - **C.** Read tracked styles in an integration test behind a test-support feature. Keep generated cases in the unit test. Effort: Medium.
- **Left out:** Dropping repository styles removes the differential coverage that found the scanner defects.
- **Wider fix:** C.
- **Previous examples:** Final review `b152d0dc` found the missing PR #227 stylesheets and the ineffective nonempty assertion.
- **Recommendation:** C. It follows tracked files and keeps unit tests independent of the repository filesystem.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6701).
