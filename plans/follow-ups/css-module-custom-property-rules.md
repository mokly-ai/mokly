# Align CSS Module checks for custom-property-like rules

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 113, from item 28 of the Milestone 14 nesting report and the
  round 7 differential review.
- **Location:** `crates/mokly-css/src/module_checks.rs:30-34`.
- **Reason:** Option B rejects stylesheets that build today, and it touches the
  statement boundary that `css-module-semicolon-boundary.md` keeps open for the
  user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **CSS Modules scanners:** the three readers of one CSS Module in
    `crates/mokly-css`: the module check, the renamer, and the token check.
  - **`@value`:** a CSS Modules at-rule that Mokly does not support. It
    fails with a catalogued message that suggests a CSS custom property.
- **Background:**
  - The module check fails an `@value` statement with the catalogued
    message, at `module_checks.rs:26`.
  - In a rule list, the check skips the block of a statement that starts
    like a custom property, such as `--x:{…}`. This is at lines 30-34.
  - The renamer and the token check read the same statement as a rule with
    a block.
- **Problem:** An `@value` inside such a block passes the module check. In
  keyframes and `@document` blocks, such a stylesheet builds today.
- **Impact if no action:** An unsupported `@value` passes at rule level in
  these blocks, and one scanner keeps its own statement rule.
- **Root question:** How do all three scanners read a custom-property-like
  statement in a rule list the same way?
- **Options:**
  - **A.** Keep the skip. Effort: Small.
  - **B.** Delete the skip, so that an `@value` there fails with its
    catalogued message. Effort: Small.
- **Left out:** A fourth classification for this case. It keeps the
  disagreement between the scanners. Fewer than three approaches exist,
  because the module check either enters the block or skips it.
- **Wider fix:** B. Every scanner then uses the same statement
  classification.
- **Previous examples:** None found.
- **Related:**
  - [css-module-bare-wrapper-kind.md](css-module-bare-wrapper-kind.md) came
    from the same differential review. One branch can settle both.
  - [css-module-semicolon-boundary.md](css-module-semicolon-boundary.md)
    changes where a rule-list statement ends. That change touches this
    case, so decide the two together.
- **Recommendation:** B. It removes the last statement that one scanner
  reads on its own, and `@value` then fails at every rule level.
- **Action:** ask the user, because B makes keyframes and `@document`
  stylesheets that build today fail, and the always-on rules reserve a new
  rejection for the user.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5982).
