# Exclude nested matches from own-preview changes

- **Severity:** High. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 108 (engine round 4 own review finding 3): nested
matches changed own previews. After decision 96 C, a component can
hold a record for a match inside a nested copy of itself: X renders
Y, and Y renders another X. That record made the component's own
previews show Changed and added dependency reasons on its consumers.
Severity High, effort Large. Options: A, one page-level flag for
nested-only matches, but a page that mixes nested and own sources
keeps the wrong result, Medium (estimate); B, carry the stylesheet
paths of the kept own-page matches through reduction and
classification, while Details keep the nested record, Large because
it changes two crates. Recommended: B. Hub review 3 found B correct.

- Option B is in the code on the unmerged `rebuild/defaults-engine`, in
  `e6b2b99c`, from an earlier default, and it stays until the user
  decides.

## Decision

- **Source:** Review.
- **Category:** product bug.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly exclude nested matches from own-preview changes?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Medium.
  - **B.** Use option B from the Task section. Effort: Large.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** B.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** B. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5938).
