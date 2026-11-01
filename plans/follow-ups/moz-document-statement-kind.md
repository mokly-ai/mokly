# Read `@-moz-document` blocks as the bundler does

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: a
  problem outside the scope of the review of the `rebuild/port-111c` work,
  2026-10-26. The coordinator's record calls this choice item 5, with the
  letters A and D that this file uses. The earlier version of this file
  called D option A, and A option B.
- **Location:** `crates/mokly-css/src/token_grammar.rs:64-83`, `nested`,
  whose line 71 holds the `@-moz-document` case, and `:87-92`, `rule_list`.
  The named exception is at
  `crates/mokly-css/src/_tests_/token_grammar_tests.rs:38-43`.
- **Reason:** Option D makes a stylesheet fail that builds today, and the
  always-on rules reserve each new rejection for the user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **CSS Modules scanners:** the module check, the renamer, and the token
    check in `crates/mokly-css`, which read a `*.module.css` file before
    `lightningcss` bundles it.
  - **Block grammar:** what the scanners expect in a block, rules,
    declarations, or both, as `nested` in
    `crates/mokly-css/src/token_grammar.rs` picks it.
  - **Rule list:** a block that holds only rules, such as the stylesheet or
    an `@media` block outside a style rule.
  - **Style block:** a block that holds declarations and nested rules, such
    as the block of a style rule.
  - **Parity rule:** the protocol rule that the scoper reads each statement
    that the bundler keeps with the same start and kind.
- **Background:**
  - On 2026-10-21 the user chose to make the scanners read each statement
    with the start and kind that cssparser gives it. PR #241, commit
    `c9d402cd`, applied that choice.
  - `docs/protocol/mokly-imported-styles-modules.md`, section Names, states
    the parity rule for every nesting level outside a descriptor block. The
    same section names an `@-moz-document` block outside a style rule as the
    one exception.
  - `nested`, at `token_grammar.rs:64-83`, returns the grammar of the block
    that a statement opens. Its line 71 gives an `@-moz-document` block the
    style grammar in the stylesheet, in a rule list, and in a style block.
  - `rule_list`, at `token_grammar.rs:87-92`, names the at-rules whose blocks
    are rule lists outside a style rule, such as `media`.
  - `lightningcss` 1.0.0-alpha.72 parses an `@-moz-document url-prefix()`
    block as it parses `@media`. Outside a style rule, that is a rule list
    without declarations. Inside a style rule, the block holds declarations
    and rules.
  - The recorded option D of this choice also aligned `@nest` and added a
    table test. On 2026-10-29 the coordinator chose decision F for the user.
    F took those two parts of D, and the documentation of option A. Only the
    `@-moz-document` change of D waits for the user.
  - Decision F is done. Commit `ad739e8b` made `nested` read an `@nest` block
    in a style block as a style block, as `lightningcss` parses it.
  - Decision F also added the table test
    `nested_matches_lightningcss_block_at_rules` in
    `crates/mokly-css/src/_tests_/token_grammar_tests.rs`. It checks each
    block grammar against `lightningcss`.
  - The table test lists `@-moz-document` outside a style rule in
    `PARSER_EXCEPTIONS` as its one exception. It fails when that exception no
    longer differs.
  - The protocol page, `crates/mokly-css/README.md`, and the doc comment of
    `Statement` in `crates/mokly-css/src/token_sections.rs` name the
    exception. Decision F added no rejection.
- **Problem:** Outside a style rule, the scanners read an `@-moz-document`
  block as a style block. `lightningcss` parses it as a rule list there, as
  it parses `@media`. So a statement that the bundler keeps there can scope
  differently than in an `@media` block.
  - In a style block, an at-rule without a block under a keyframes name that
    `lightningcss` does not know, such as `@-khtml-keyframes`, is text. The
    scanners keep text as authored.
  - In a rule list, the same statement is an at-rule, and the renamer scopes
    its keyframes name.
  - So `@-moz-document url-prefix(){@-khtml-keyframes :local(k);}` builds and
    keeps `:local(k)` as authored.
  - `@media all{@-khtml-keyframes :local(k);}` builds, scopes `k`, and
    exports it.
  - `@-moz-document url-prefix(){@-khtml-keyframes :local();}` builds today.
    `@media all{@-khtml-keyframes :local();}` fails at 1:30 with the
    catalogued empty-wrapper message.
  - Probes on `main` at `c9d402cd` gave these results. A rerun on 2026-11-01
    gave the same results.
- **Impact if no action:** A statement that the bundler keeps scopes
  differently in two blocks that the bundler reads the same way. The
  documented exception stays in the protocol page, the crate README, the
  `Statement` doc comment, and the table test. No tracked stylesheet uses
  `@-moz-document`.
- **Root question:** How should the scanners read the statements of an
  `@-moz-document` block outside a style rule?
- **Options:**
  - **A.** Keep the scanner grammar and the documented exception. Effort:
    Small.
  - **D.** Align: outside a style rule, read an `@-moz-document` block as a
    rule list, as for `@media`. Remove the exception from the table test and
    the docs. Effort: Small.
    - D is a new rejection.
      `@-moz-document url-prefix(){@-khtml-keyframes :local();}` builds
      today. Under D it fails with
      `CSS Modules :local() has no keyframes name in {stylesheet}:1:47; add the name inside it or remove it`,
      as the `@media` form already fails at 1:30.
    - With option B of
      [css-module-custom-property-rules.md](css-module-custom-property-rules.md),
      D also closes the last `@value` gap of that item.
- **Left out:** Reject `@-moz-document` in CSS Modules. It makes stylesheets
  fail that build today, and it gains nothing.
- **Wider fix:** None needed. The table test of decision F already checks
  every grammar entry against `lightningcss`.
- **Previous examples:** Decision F aligned the `@nest` entry of the same
  grammar table in commit `ad739e8b`.
- **Related:** [css-module-custom-property-rules.md](css-module-custom-property-rules.md)
  has the other half of the `@value` fix. With its option B, option D here
  closes the last `@value` gap. Without D,
  `@-moz-document url-prefix(){@keyframes k{--x:{@value y: red;}}}` still
  builds under that option B.
- **Recommendation:** D. It removes the last named exception, and the table
  test then holds without one.
- **Action:** ask the user, because D makes a stylesheet fail that builds
  today. The always-on rules reserve each new rejection for the user.
- **Design for D:**
  - `rule_list` gains `-moz-document`, and `nested` drops its special case.
    So an `@-moz-document` block is a rule list in the stylesheet and in a
    rule list, as for `@media`. In a style block, it stays a style block.
  - In a keyframes or `@document` block, which `lightningcss` does not parse
    as rules, an `@-moz-document` block stays a declarations block.
  - `legacy_nested` in `crates/mokly-css/src/_tests_/token_differential.rs`
    changes the same way.
  - Remove the exception from `PARSER_EXCEPTIONS`.
  - In `blocks_open_the_grammar_that_lightningcss_parses`, in
    `crates/mokly-css/src/_tests_/token_sections_tests.rs`, change the two
    `@-moz-document` rows of the stylesheet and the rule list. Correct the
    doc comment of that test too.
  - Correct the doc comments of `Grammar::Rules`, `Grammar::Style`, `nested`,
    and `Statement`. Correct the doc comment of the `DOCUMENT` level in
    `crates/mokly-css/src/_tests_/wrapper_table_tests.rs`.
  - Remove the exception from the protocol page and the crate README.
- **Work:**
  - Add the regression tests first, and save their failure on the unfixed
    code:
    - `@-moz-document url-prefix(){@-khtml-keyframes :local(k);}` scopes `k`,
      as in `@media`.
    - `@-moz-document url-prefix(){@-khtml-keyframes :local();}` fails at
      1:47 with the empty-wrapper message.
    - With option B of the custom-property item,
      `@-moz-document url-prefix(){@keyframes k{--x:{@value y: red;}}}`
      fails with the `@value` message.
  - Apply the design.
  - Run `cargo test -p mokly-css` and Clippy.
  - Delete this item in the branch that applies the answer.
  - Under A, change no code or doc. Delete this item, and keep the
    documented exception.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6675).
