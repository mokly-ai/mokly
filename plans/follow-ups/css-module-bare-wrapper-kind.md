# Detect statement changes from bare CSS Module wrappers

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 112, from item 27 of the Milestone 14 nesting report and the
  round 7 differential review.
- **Location:** `crates/mokly-css/src/rename_selectors.rs:96-100` and
  `:181-187`, and `crates/mokly-css/src/module_integrity.rs:17-36` and `:62`.
- **Reason:** On 2026-10-21 the user deferred the open review items until
  after the merge, and options B and C reject stylesheets that build today.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **CSS Modules scoper:** the code in `crates/mokly-css` that renames
    local class names. The renamer edits the text, and the token check
    compares fingerprints of the text before and after.
  - **Bare wrapper:** a `:global` or `:local` pseudo-class without
    parentheses, which switches the scope of the selector after it.
- **Background:**
  - The renamer removes a bare wrapper from the text, at
    `rename_selectors.rs:96-100`. It removes a `:global()` or `:local()`
    function wrapper at `:181-187`.
  - The token check, `module_integrity::check`, compares a fingerprint of
    the authored text with one of the scoped text. It fails a rewrite that
    changes the fingerprint.
- **Problem:**
  - Before an at-keyword, removing a bare wrapper turns a rule into an
    at-rule. `:global@media all{}` becomes `@media all{}`.
  - Alone in a statement without a block, it empties the statement.
    `.p{:local}` builds as `.p{}`.
  - Removing a `:global()` wrapper before an at-keyword does the same:
    `:global(@media all){.a{}}` becomes an at-rule. A later review of the
    same round found this case.
  - The token check misses these changes where its two readings agree.
- **Impact if no action:** Mokly can accept CSS whose statement meaning
  changed during scoping.
- **Root question:** How does the scoper refuse a rewrite that changes what
  a statement is?
- **Options:**
  - **A.** Keep the current behaviour. Effort: Small.
  - **B.** Add the kind of each statement to the token check's fingerprint,
    so that any edit that changes a statement fails with the catalogued
    message. Effort: Small.
  - **C.** Keep a bare wrapper that no selector follows, so that
    lightningcss reports the syntax error. This does not cover the
    `:global()` form. Effort: Small.
- **Left out:** A special case for the `:global()` form only. The bare form
  stays unprotected.
- **Wider fix:** B. One guard catches every edit that changes a statement.
- **Previous examples:** None found.
- **Related:** [css-module-custom-property-rules.md](css-module-custom-property-rules.md)
  is another case where the scanners read one statement in different ways.
  Both came from the same differential review, so one branch can settle
  both.
- **Recommendation:** B. One guard catches every edit that changes a
  statement.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user deferred the open review items past the merge to decide each one
  later. B and C also reject stylesheets that build today.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5962).
