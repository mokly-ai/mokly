# Add the missing period to the scripts hint

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 156 (135 B review finding 52): the hint has no
final period. Severity Low. Recommended: A. The 135 B review record
holds the options.

## Decision

- **Source:** Review.
- **Category:** UX wording.
- **Background:** The base-install recovery hint is a complete sentence in terminal output.
- **Problem:** The sentence has no final period.
- **Impact if no action:** The hint remains inconsistent with the product copy rules.
- **Root question:** How should Mokly add the missing period to the scripts hint?
- **Options:**
  - **A.** Add the final period and update exact-message tests. Effort: Small.
  - **B.** Keep the current text. Effort: Small.
- **Left out:** There is no third text location or behavior to change.
- **Wider fix:** None. The existing repository rules already cover this class.
- **Previous examples:** None found.
- **Recommendation:** A. It fixes the copy defect without changing meaning.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6150).
