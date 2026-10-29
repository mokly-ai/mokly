# Keep delegated commits buildable

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** None. This item changes the shared delegation process.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** process.
- **Background:** A delegated branch had five intermediate commits that did not compile. Two commit messages also misdescribed their changes.
- **Problem:** The merged history keeps those commits. The shared process does not require every delegated commit to build.
- **Impact if no action:** Later agents can bisect or stack work on a broken intermediate commit.
- **Root question:** How should Mokly keep delegated commits buildable?
- **Options:**
  - **A.** Keep the history and its recorded broken range. Effort: Small.
  - **C.** Require delegate briefs to build each commit before handoff. Effort: Medium.
- **Left out:** Option B rewrites already merged history. It cannot protect later delegated work.
- **Wider fix:** C. The handoff rule prevents new broken intermediate commits.
- **Previous examples:** User item 130 lists the affected commit range.
- **Recommendation:** A. The completed branch cannot safely rewrite its history. C best protects later branches.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6043).
