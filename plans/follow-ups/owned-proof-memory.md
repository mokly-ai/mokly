# Reduce catalogue-wide owned-proof memory

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 97, review 2 finding 3 of the defaults-engine work.
- **Location:** `crates/mokly-compare/src/owned_styles.rs:24`,
  `crates/mokly-compare/src/owned_styles.rs:115`, and
  `crates/mokly-compare/src/comparison_attribution.rs:35`.
- **Reason:** On 2026-10-28 the coordinator chose option B for the user,
  with the counted test of option C. Only its implementation waits.

- **Source:** Review.
- **Category:** Performance.
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
  - A view builds its two instance indexes only when an owner's rules
    changed in that view, in `owned_styles::compare`. Each element costs
    32 bytes per side in an index. So 1,000 elements per side give about
    375 MB over 5,850 views, but only when every view has a changed owned
    rule. The estimate under **Problem** gives about 190 MB. Nobody measured
    either estimate.
  - On 2026-10-28, a change of the dark text token of the large React
    fixture changed 1,350 entries, and 0 of 5,850 views held owned state.
    Only the styled-components and Emotion adapters give a style an owner.
  - On 2026-10-28 the coordinator chose option B for the user, with the
    counted test of option C as its regression test. Keep, for each owner
    with changed rules and each rule identity, the deduplicated instance
    chains that the proof needs. Keep candidates only for instances of
    those owners, and one address pair for each view. The proof results
    stay the same.
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
    already changed to pass by value. Effort: Small.
  - **B.** Keep compact candidates. Keep instance chains without duplicates
    for each owner and rule identity, and candidates only for owners with
    changed rules. Keep one address pair for each view. Effort: Medium.
  - **C.** Add a counted test at two catalogue sizes, and keep the current
    retention. Effort: Medium.
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
- **Recommendation:** B, with the counted test of C. It removes the memory
  regression and keeps every proof result.
- **Action:** fix after merge, apply B with the counted test of C, because
  the user's choice of 2026-10-28 settles it and only the implementation
  remains.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5878).
