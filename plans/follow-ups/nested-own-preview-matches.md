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

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5938).
