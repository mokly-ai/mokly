# Detect statement changes from bare CSS Module wrappers

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 112 (M14 nesting report item 27, round 7
differential): removing a bare `:global` or `:local` at
`crates/mokly-css/src/rename_selectors.rs:99` can change a statement.
Before an at-keyword, it turns a rule into an at-rule, for example
`:global@media all{}` into `@media all{}`. Alone in a statement
without a block, it empties the statement, so `.p{:local}` builds as
`.p{}`. The token check misses both where its two readings agree.
Severity Low. Options: A, keep the behaviour, Small; B, add the kind
of each statement to the token check's fingerprint, so that any edit
that changes a statement fails with the catalogued message, Small;
C, keep a bare wrapper that no selector follows, so that lightningcss
reports the syntax error, Small, but not for the `:global()` form.
Recommended: B, because one guard catches every edit that changes a
statement. B and C reject stylesheets that build today, so keep the
behaviour until the user decides.

- `crates/mokly-css/src/rename_selectors.rs:181`: removing a `:global()`
  wrapper before an at-keyword, as in `:global(@media all){.a{}}`, also
  turns a rule into an at-rule. Found by the M14 nesting round 7 review.
  User item 112 covers it.

## Decision

- **Source:** Review.
- **Category:** product bug.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly detect statement changes from bare CSS Module wrappers?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Small.
  - **C.** Use option C from the Task section. Effort: Small.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** B.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** B. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5962).
