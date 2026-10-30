# Reduce catalogue-wide owned-proof memory

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 97, review 2 finding 3 of the defaults-engine work.
- **Location:** `crates/mokly-compare/src/owned_styles.rs:24`,
  `crates/mokly-compare/src/owned_styles.rs:115`, and
  `crates/mokly-compare/src/comparison_attribution.rs:35`.
- **Reason:** On 2026-10-21 the user deferred the open review items of PR #199
  until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Performance (estimate).
- **Terms:**
  - **Owned rule:** a CSS rule that a component supplies with its own
    styles, such as CSS-in-JS from the sidecar.
  - **Own-page proof:** the set of pages on which a component's own preview
    matches a changed rule. Comparison needs this set for the whole
    catalogue.
  - **Instance proof:** an `InstanceProof` record in
    `crates/mokly-compare/src/instance_proof.rs`. It says that one placed
    instance of a component changed in one view.
- **Background:** Comparison proves owned instances as follows.
  - Changes attributes each changed CSS rule to the components that its
    matches reach.
  - A user decision of 2026-10-20 set the rule for owned rules. A different
    nested component takes a match only when its own-page proof for that rule
    is not empty.
  - So exact instance proof waits until the comparison has collected every
    view.
  - `owned_styles::compare` keeps the rule matching, two whole-document
    instance indexes, and the candidate proofs of each view.
  - `comparison_attribution::apply` resolves them after the catalogue-wide
    sets are complete.
- **Problem:** Every view with changed owned rules keeps its two document
  indexes and its candidates until all views are collected. An estimate
  gave about 190 MB for 5,850 views at 1,000 elements per side. Nobody has
  measured it.
- **Impact if no action:** Changes on a large catalogue can use much more
  memory than the comparison needs, before any result is ready.
- **Root question:** How should comparison keep exact owned-instance proof
  without holding whole-document data for every view until collection ends?
- **Options:**
  - **A.** Keep the current state, which a fix round of the rebuild
    already changed to pass by value. Effort: Small (estimate).
  - **B.** Keep compact candidates. Keep instance chains without duplicates
    for each owner and rule identity, and candidates only for owners with
    changed rules. Keep one address pair for each view. Effort: Medium.
  - **C.** Add a counted test at two catalogue sizes, and keep the current
    retention. Effort: Medium (estimate).
- **Left out:** A proof that each view resolves alone breaks the decision of
  2026-10-20, because it cannot see the own-page proof of other pages.
  Dropping the candidate proofs loses the owned-instance evidence.
- **Wider fix:** B. Compact candidate records hold no document index, so
  no view keeps document data until collection ends.
- **Previous examples:** The Rust rebuild removed the per-element
  containment-list copies of the CSS matching tree, whose retention grew
  with element count times nesting depth. Shared parent links replaced them.
- **Related:** [nested-own-preview-matches.md](./nested-own-preview-matches.md)
  decides the grain of the same own-page proof: per page, or per stylesheet
  path. Both items change the proof data that `owned_styles::Changes::proofs`
  resolves with `OwnPageMatches`, so decide them in one branch. Their scopes
  differ: that item fixes which matches count as own, and this item fixes
  how long the candidates stay in memory.
- **Recommendation:** B. It removes a memory regression that the
  catalogue-wide wait added, and the counted test of C can be its
  regression test.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user reserved the choice for each open review item of the rebuild.
  Condition 6 also holds, because the item concerns performance.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5878).
