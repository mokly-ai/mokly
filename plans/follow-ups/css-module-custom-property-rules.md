# The module check skips custom-property-like blocks

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 113, from item 28 of the Milestone 14 nesting report and the
  round 7 differential review. An options check on 2026-10-29 added option
  C.
- **Location:** `crates/mokly-css/src/module_checks.rs:30-34`, and
  `Section::custom_property` at
  `crates/mokly-css/src/token_sections.rs:121-124`.
- **Reason:** Option B makes four stylesheets fail that build today, and the
  always-on rules reserve each new rejection for the user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Module check:** `module_checks::check`, which rejects authored `@value`
    with its catalogued message before the renamer runs.
  - **`@value`:** a CSS Modules at-rule that Mokly does not support, so it
    fails the build with a catalogued message.
  - **Custom-property-like statement:** a statement whose first tokens are a
    name that starts with `--` and a colon, such as `--x:{…}`.
  - **Rule list:** a block that holds only rules, such as the stylesheet, an
    `@media` block outside a style rule, a keyframes block, or an
    `@document` block.
  - **Style block:** a block that holds declarations and nested rules, such
    as the block of a style rule.
- **Background:**
  - Mokly scopes each `*.module.css` file before `lightningcss` bundles it.
    Three scanners in `crates/mokly-css` read the authored text: the module
    check, the renamer, and the token check.
  - All three read each statement through one section reader,
    `token_sections::next`. Each scanner walks the blocks on its own.
  - `docs/protocol/mokly-imported-styles-modules.md`, section Composition And
    Exports, requires that authored `@value` fails at every rule level.
  - The `@value` message is
    `CSS Modules @value is unsupported in {stylesheet}:{line}:{column}; use a CSS custom property or JavaScript constant`.
  - At `module_checks.rs:30-34`, the module check enters the block of a
    statement only when the statement does not start with a `--` name and a
    colon.
  - The renamer and the token check enter every block that the section
    reader gives them.
- **Problem:** In a style block, a custom-property-like statement is a custom
  property without a block, so the skip does nothing. In a rule list, the
  section reader reads `--x:{…}` as a rule with a block, and the skip hides
  that block. So an `@value` in that block passes the module check.
  - These four stylesheets build on `main`, and their `@value` passes:
    - `@keyframes k{--x:{@value y: red;}}`
    - `@-webkit-keyframes k{--x:{@value y: red;}}`
    - `@media all{@keyframes k{--x:{@value y: red;}}}`
    - `@document x{--x:{@value y: red;}}`
  - The bundler keeps the `@document` block as text, so that `@value` ships
    in the delivered stylesheet.
  - These two fail on `main` with the `@value` message:
    `@keyframes k{to{@value y: red;}}` and `@document x{.a{@value y: red;}}`.
  - These two fail on `main` with a syntax error, because the bundler rejects
    the qualified rule: `--x:{@value y: red;}` and
    `@media all{--x:{@value y: red;}}`.
  - By design, `.p{--x:{@value y: red;}}` builds, because the `@value` is part
    of a custom property value.
  - Probes on `main` at `c9d402cd` gave these results. A rerun on 2026-11-01
    gave the same results.
- **Impact if no action:** An `@value` passes the module check in a keyframes
  or `@document` block, against the protocol rule. In an `@document` block,
  the `@value` ships.
- **Root question:** How does the module check reject an authored `@value` in
  every block that the other scanners read as rules?
- **Options:**
  - **A.** Keep the skip, and name the exception beside the `@value` rule in
    the protocol page. It changes a requirement. Effort: Small.
  - **B.** Delete the skip. Effort: Small.
    - B is a new rejection for the four stylesheets that build today.
    - The two syntax-error cases get the `@value` message, because the module
      check runs before the bundler.
    - With option D of
      [moz-document-statement-kind.md](moz-document-statement-kind.md),
      `@value` then fails at every rule level.
    - Without that option,
      `@-moz-document url-prefix(){@keyframes k{--x:{@value y: red;}}}` still
      builds. The scanners read that `@-moz-document` block as a style block,
      so its keyframes block reads as declarations.
  - **C.** B, and one shared block walk in `token_sections` for the three
    scanners, so that no scanner chooses its own blocks. C is a new
    rejection. Effort: Medium.
- **Left out:**
  - Delete the skip only in keyframes and `@document` blocks. The skip keeps
    the module check out of a custom property value. A rule list holds no
    custom property, so that reason holds in no rule list.
  - Do the `@value` check in the renamer's walk. It changes which failure
    shows first, because the module check now runs before the renamer.
- **Wider fix:** C. With one shared walk, no scanner chooses its own blocks.
- **Previous examples:** PR #241, commit `c9d402cd`, gave the three scanners
  one statement classification, but each scanner kept its own block walk.
- **Related:**
  - [css-module-bare-wrapper-kind.md](css-module-bare-wrapper-kind.md) came
    from the same differential review. One branch can apply both answers.
  - [moz-document-statement-kind.md](moz-document-statement-kind.md) has the
    other half of the `@value` fix. With its option D, option B here closes
    the last `@value` gap.
- **Recommendation:** B. It removes the only block that one scanner skips,
  and C is a refactor that this item does not need.
- **Action:** ask the user, because B makes four stylesheets fail that build
  today. The always-on rules reserve each new rejection for the user.
- **Design for B:**
  - Delete the condition at `module_checks.rs:30-34`, so that the module
    check enters every block.
  - `Section::custom_property` at `token_sections.rs:121-124` then has no
    caller. Delete it as dead code, and record the search that shows it dead
    in the commit message.
  - Keep `token_grammar::custom_property` in
    `crates/mokly-css/src/token_grammar.rs`. `token_sections::next` and the
    old reader in `crates/mokly-css/src/_tests_/token_differential.rs` call
    it.
  - The deep scanner test
    `module_checks_find_a_deep_value_rule_after_custom_property_blocks`, at
    `crates/mokly-css/src/_tests_/deep_scanner_tests.rs:73`, fails under B.
    Its allowed input puts `--x:{@value y;}` directly in the deep `@media`
    nesting.
  - The test keeps its purpose with `a{--x:{@value y;}}b{color:red}` inside
    the deep `@media` nesting. There the custom property is in a style rule,
    so its value holds no statements.
  - The test also asserts that `--x:{@value y;}` directly in the deep rule
    list fails.
- **Work:**
  - Add the regression tests first, and save their failure on the unfixed
    code:
    - The four stylesheets fail with the `@value` message at their `@value`.
    - The two syntax-error cases get the `@value` message.
    - `.p{--x:{@value y: red;}}` still builds.
  - Delete the skip and the dead `Section::custom_property`.
  - Change the deep scanner test as the design says.
  - Under C, move the three scanners to one shared walk in `token_sections`.
  - Under A, change no code. Name the exception beside the `@value` rule in
    the protocol page, section Composition And Exports.
  - Run `cargo test -p mokly-css` and Clippy.
  - Delete this item in the branch that applies the answer.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5982).
