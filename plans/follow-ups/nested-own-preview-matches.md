# Exclude nested matches from own-preview changes

- **Severity:** High. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 108, from finding 3 of the engine round 4 own review.
- **Location:** `crates/mokly-css/src/attribution.rs:19` (`OwnPageMatches`),
  `crates/mokly-compare/src/owned_styles.rs:115`, and
  `crates/mokly-compare/src/owned_style_instances.rs:120`.
- **Reason:** On 2026-10-21 the user deferred the open review items until
  after the merge and kept each choice for a later decision.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Own-page match:** a changed CSS rule that matches an element of a
    component's own preview, as opposed to a copy of it nested inside
    another component.
  - **Reduction:** the comparison step that turns rule matches into the
    records and reasons that Changes shows.
- **Background:**
  - On 2026-10-20 the user chose physical containment to claim CSS matches
    for owned CSS-in-JS, ownerless head styles, and linked CSS. Ownerless
    and linked rules need catalogue-wide own-page proof.
  - After that choice, a component can hold a record for a match inside a
    nested copy of itself. For example, X renders Y, and Y renders another
    X.
  - Option B below is already in the code. A rebuild branch carried it from
    an earlier default, and that branch merged before PR #199. The plan says
    that it stays until the user decides.
  - The rebuild coordinator's review found option B correct.
- **Problem:** A record for a match inside the nested copy made the
  component's own previews show Changed, and it added dependency reasons to
  the component's consumers.
- **Impact if no action:** If the code returns to a page-level rule, Changes
  can show wrong rows and wrong reasons for CSS that matches only nested
  copies.
- **Root question:** How does the comparison tell a component's own matches
  from matches in nested copies of it?
- **Options:**
  - **A.** Add one page-level flag for nested-only matches. A page that mixes
    nested and own sources keeps the wrong result. Effort: Medium
    (estimate).
  - **B.** Carry the stylesheet paths of the kept own-page matches through
    reduction and classification. Details keep the nested record. It
    changes two crates. Effort: Large.
- **Left out:** Drop nested records. It loses valid Details evidence. Fewer
  than three approaches exist, because the choice is the grain of the own
  match evidence: per page or per path.
- **Wider fix:** B. Per-path evidence tells nested and own sources apart in
  mixed pages too.
- **Previous examples:** None found.
- **Related:** [owned-proof-memory.md](owned-proof-memory.md) is about the
  memory of the same own-page proof. Both items change the proof data, so
  decide them in the same branch.
- **Recommendation:** B. It gives classification the exact own-page
  evidence, and it is the code today.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user deferred the open review items past the merge to decide each one
  later.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5938).
