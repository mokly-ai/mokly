# Define saved variant slot element checks

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 128 (F21 decision): saved variant slot element
checks. The F21 record gives no severity or effort. Options: A, keep
the checks and state the rule in `mokly-html-components.md`; B, keep
only the required `html-ignore-attribute` and `html-foster-parented`
warnings. Recommended: A. The rebuild branch records this item as the
line "Item 128" after the F21 record. Keep one line when both reach
the plan.

- Saved slots skip the forbidden and unknown element checks, because a
  new build error needs the user's yes (item 128 is open).

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6018).
