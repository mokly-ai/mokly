# Align the Statement doc with descriptor parsing

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of the review of commit `3066e47a` of the
  `rebuild/port-111c` work, 2026-10-28.
- **Location:** `crates/mokly-css/src/token_sections.rs:59-60`.
- **Reason:** The review found the stale comment in code that its change did
  not edit, so the fix needs a separate branch.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Descriptor block:** the block of a declaration-only at-rule, such as
    `@font-face` or `@property`.
  - **Section reader:** the code in `token_sections.rs` that splits one
    block level into statements for the CSS Modules scanners.
- **Background:**
  - The doc comment of the `Statement` enum, at `token_sections.rs:59-60`,
    says that a statement is read as lightningcss reads the block that
    holds it.
  - In a descriptor block, the section reader ends a statement that is not
    a custom property at its first `{}` block, as postcss does. lightningcss
    keeps the descriptor's text up to its `;`.
  - On 2026-10-28 the user chose to name this descriptor-block case in the
    protocol page and the crate README.
    `docs/protocol/mokly-imported-styles-modules.md:72-78` now states it.
- **Problem:** The `Statement` doc comment still claims the lightningcss
  reading for every block, including descriptor blocks.
- **Impact if no action:** A maintainer can trust the comment and change the
  descriptor case by mistake.
- **Root question:** How does the `Statement` doc describe the one block
  kind where the reader follows postcss?
- **Options:**
  - **A.** Name the descriptor-block exception in the doc comment, and link
    it to the protocol section. Effort: Small.
  - **B.** Keep the comment. Effort: Small.
- **Left out:** Change the reader to follow lightningcss in descriptor
  blocks. The user's decision of 2026-10-28 keeps the postcss reading.
  Fewer than three approaches exist, because only the comment can change.
- **Wider fix:** None. The `documentation` skill already requires docs and
  comments to match the code.
- **Previous examples:** The crate README had the same gap until the
  decision of 2026-10-28 pointed its parity sentence at the descriptor
  case.
- **Related:** [moz-document-statement-kind.md](moz-document-statement-kind.md)
  is another difference between the scanner reading and lightningcss from
  the same review series. One branch can settle both.
- **Recommendation:** A. It makes the comment match the code and
  the protocol.
- **Action:** fix after merge, apply A, because the comment
  contradicts the code, and the code is outside the reviewed change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6696).
