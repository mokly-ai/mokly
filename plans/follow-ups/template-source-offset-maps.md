# Add source offset maps for template diagnostics

- **Severity:** Low. **Effort:** Large.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: the wider fix of round 1 finding 1 and round 2 finding 1 of the decision work review.
- **Location:** `crates/mokly-catalogue/src/templates.rs:71` and
  `crates/mokly-catalogue/src/templates.rs:217`.
- **Reason:** On 2026-10-28 the user chose to build the offset maps on a
  separate branch after PR #199 merges.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Substitution:** a `{{...}}` expression in an HTML template, which
    Mokly replaces with a prop value.
  - **Offset map:** a table from byte offsets in a decoded value to byte
    offsets in the source file.
- **Background:** Catalogue validation checks every substitution in
  template text and attribute values. `templates.rs` reports a failure at
  the token's span start plus the offset inside the decoded value. The
  tokenizer decodes character references and line ends, so a decoded
  offset can differ from its source offset. An attribute's span starts at
  the attribute name, not at its value.
- **Problem:** A failure in an attribute value points at the attribute name
  start, because line 217 passes `value.span.start`. A failure after a
  character reference in text points too early, because line 71 adds the
  decoded offset to the text start. Two earlier findings of the decision
  work review of 2026-10-26 got targeted span fixes, one case at a time.
- **Impact if no action:** A template diagnostic can name the wrong line or
  column, so the author must search for the failing substitution.
- **Root question:** How should every template diagnostic point at its own
  source characters?
- **Options:**
  - **A.** Keep the targeted span fixes. Effort: Small.
  - **B.** Give each text token and attribute value a map from value offsets
    to source offsets, so that every `{{...}}` failure points at its own
    characters. This also covers the attribute value and the character
    reference locations above. Effort: Large.
  - **C.** Build the offset maps of B on a separate branch after PR #199
    merges. Effort: Large.
- **Left out:** A second character-reference decoder that recomputes
  positions can drift from the tokenizer's own decoding.
- **Wider fix:** B. Maps for every value fix the location of each
  substitution at once.
- **Previous examples:** The two targeted span fixes of the decision work
  review, one in each review round.
- **Recommendation:** C. The user chose it on 2026-10-28.
- **Action:** fix after merge, apply C, because the user chose the offset
  maps as separate work after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5569).
