# Bring the shell README under its length target

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `packages/viewer/src/shell/README.md`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** repository rule.
- **Background:** The shell README documents a large flat directory. It now has more than 500 lines and passes the repository's 300-line target.
- **Problem:** The page mixes entry points, standalone mechanics, and subject details under too few headings.
- **Impact if no action:** Readers must scan one long page, and the repository length rule stays unresolved.
- **Root question:** How should Mokly bring the shell README under its length target?
- **Options:**
  - **A.** Keep one page, add subject headings, and record a length exception. Effort: Small.
  - **B.** Move standalone paragraphs to `src/standalone/README.md` and record an exception for the rest. Effort: Small.
  - **C.** Split subject pages under a shell docs directory. Effort: Small.
  - **D.** Move mechanics into module comments and keep a short entry-point index. Effort: Large.
- **Left out:** Deleting the mechanics loses the only current explanation of those entry points.
- **Wider fix:** D. Code comments keep mechanics beside their owners and leave a short index.
- **Previous examples:** User item 95 records the earlier 494-line count. The file has grown since then.
- **Recommendation:** A. It improves navigation with the smallest change. D best protects long-term ownership.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5863).
