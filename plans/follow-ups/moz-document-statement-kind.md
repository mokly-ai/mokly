# Classify moz-document blocks consistently

- **Severity:** Low (estimate). **Likelihood:** Rare (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of the review of the `rebuild/port-111c`
  work, 2026-10-26.
- **Location:** `crates/mokly-css/src/token_grammar.rs:60-72`.
- **Reason:** The review found the difference in scanner code that its
  change did not edit, so the fix needs a separate branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **CSS Modules scanners:** the three readers of one CSS Module in
    `crates/mokly-css`: the module check, the renamer, and the token check.
  - **Block grammar:** what the scanners expect inside a block: rules,
    declarations, or both, as in a style rule.
- **Background:**
  - On 2026-10-21 the user chose to make the scanners read each statement
    with the start and kind that lightningcss gives it.
  - `docs/protocol/mokly-imported-styles-modules.md:61-62` states the rule:
    outside a descriptor block, the scoper reads each statement that the
    bundler keeps with the same start and kind.
  - `nested` in `token_grammar.rs:60-72` returns the grammar of the block
    that a statement opens. It gives an `@-moz-document` block the grammar
    of a style rule's block at every level, so a keyframes block in it holds
    declarations.
- **Problem:** Outside a style rule, the scanners read an `@-moz-document`
  block as a style block, but lightningcss parses it as an `@media` block.
  The two then classify the statements inside it in different ways.
- **Impact if no action:** In this rare at-rule, the scoper can scope or
  reject text that the bundler reads differently, against the protocol's
  same-start-and-kind rule.
- **Root question:** What grammar should the scanners give an
  `@-moz-document` block outside a style rule?
- **Options:**
  - **A.** Outside a style rule, give an `@-moz-document` block the rule
    list grammar of an `@media` block. Keep the style grammar inside a
    style rule. Effort: Small.
  - **B.** Keep the current grammar, and state the exception in the
    protocol page. Effort: Small.
- **Left out:** Reject `@-moz-document` in CSS Modules. It adds a failure for
  stylesheets that build today. Fewer than three approaches exist, because
  the block either follows lightningcss or is a stated exception.
- **Wider fix:** None. The rule that every scanner reads one statement
  classification is already in force, and A applies it to this case.
- **Previous examples:** The same review series aligned the `;` boundary and
  the `@font-face` descriptor case by documenting each difference.
- **Related:** [font-face-statement-doc.md](font-face-statement-doc.md) is
  another difference between the scanner reading and lightningcss from the
  same review series. One branch can settle both.
- **Recommendation:** A (estimate). It applies the protocol rule to this
  at-rule.
- **Action:** fix after merge, apply A (estimate), because it aligns the
  code with the protocol rule, and the code is outside the reviewed change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6675).
