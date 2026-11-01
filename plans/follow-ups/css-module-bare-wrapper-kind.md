# Removed scope wrappers can change a statement

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 112, from item 27 of the Milestone 14 nesting report and the
  round 7 differential review. An options check on 2026-10-29 added options
  D and E.
- **Location:** `crates/mokly-css/src/rename_selectors.rs:96-100` and
  `:181-187`, and `crates/mokly-css/src/module_integrity.rs:17-36` and
  `:62-160`.
- **Reason:** Each option that fixes the problem makes stylesheets fail that
  build today, and the always-on rules reserve each new rejection for the
  user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Scoper:** the CSS Modules code in `crates/mokly-css` that renames the
    local names of a `*.module.css` file before `lightningcss` bundles it.
  - **Scope wrapper:** a `:global` or `:local` in a selector, bare or as a
    function such as `:global(.a)`.
  - **Section reader:** `token_sections::next`, which splits one block level
    into statements and takes the start and kind of each from cssparser.
  - **Statement kind:** the `Statement` value that the section reader gives a
    statement: a rule, an at-rule, a declaration, or text.
  - **Token check:** `module_integrity::check`, which fails a scoping result
    that changes more than local names.
- **Background:**
  - The scoper runs three scanners over the authored text: the module check,
    the renamer, and the token check. All three read each statement through
    the section reader.
  - `modules::scope` in `crates/mokly-css/src/modules.rs` runs the three
    scanners. Then the bundler checks the syntax of the scoped text.
  - The renamer removes a bare scope wrapper at `rename_selectors.rs:96-100`.
    `remove_wrapper`, at `:181-187`, removes the opener and the closer of a
    `:global()` or `:local()` wrapper.
  - `fingerprint`, at `module_integrity.rs:62`, lists the tokens of a text
    without local-name prefixes, scope wrappers, compositions, whitespace,
    and comments.
  - `check`, at `module_integrity.rs:17`, compares the lists of the authored
    and the scoped text. It fails at the first entry that differs, with the
    catalogued token-check message:
    `CSS Modules scoping would change more than local names in {stylesheet}:{line}:{column}; move this CSS to a plain stylesheet`.
  - `docs/protocol/mokly-imported-styles-modules.md`, section Names, requires
    this failure for a scoping result that would change anything other than
    a local name.
  - The fingerprint depends on the statement kind only in part. A colon
    prints as `:` in a renamed prelude and as `Colon` elsewhere, at
    `module_integrity.rs:81-91` and `:122-143`. So `.p{:global color:red}`
    already fails the token check on `main`. Its authored statement is a
    rule, and its scoped statement is a declaration, so their colons differ.
  - Below, `{h}` stands for the generated prefix: `mokly_`, 12 hex digits,
    and `_`.
- **Problem:** A removed scope wrapper can change the kind of a statement
  while every fingerprint token stays the same. A rule becomes an at-rule, or
  a statement disappears. The token check then passes, and the stylesheet
  builds.
  - These eleven stylesheets build on `main`:
    - `:global@media all{}` scopes to `@media all{}`.
    - `:local@media all{}` scopes to `@media all{}`.
    - `:global @media all{.a{color:red}}` scopes to
      `@media all{.{h}a{color:red}}`, with a leading space.
    - `.p{:local}` and `.p{:global}` scope to `.{h}p{}`.
    - `.p{color:red;:local}` scopes to `.{h}p{color:red;}`.
    - `:global(@media all){.a{color:red}}` scopes to
      `@media all{.{h}a{color:red}}`.
    - `:local@keyframes spin{to{opacity:0}}.a{animation:spin 1s}` scopes to
      `@keyframes spin{to{opacity:0}}.{h}a{animation:{h}spin 1s}`.
    - `:global @keyframes spin{to{opacity:0}}.a{animation:spin 1s}` scopes
      the same way, with a leading space.
    - `:global@font-face{font-family:x;src:url(x.woff2)}` scopes to
      `@font-face{font-family:x;src:url(x.woff2)}`.
    - `:global@layer base;.a{color:red}` scopes to
      `@layer base;.{h}a{color:red}`.
  - As plain CSS, `lightningcss` rejects all eleven except
    `:global(@media all){…}`. It keeps that one as a style rule, which
    browsers drop.
  - `.p{:local;}` scopes to `.{h}p{;}`, and `.p{color:red;:local;}` scopes to
    `.{h}p{color:red;;}`. Both build.
  - Probes on `main` at `c9d402cd` gave these results. A rerun on 2026-11-01
    gave the same results.
- **Impact if no action:** Such a stylesheet ships with a changed meaning and
  no diagnostic. In the two keyframes rows, `@keyframes spin` stays global,
  but the `animation` reference is renamed. So the animation never runs.
- **Root question:** How does scoping fail when it would change what a
  statement is?
- **Options:**
  - **A.** Keep the behaviour, and name the exception in the protocol page.
    It changes a requirement. Effort: Small.
  - **B.** Compare the kind of each statement in the token check, after the
    token comparison agrees. Effort: Small.
    - A changed, dropped, or added statement then fails with the token-check
      message at the statement start.
    - B is a new rejection for the eleven stylesheets.
    - B misses `.p{:local;}` and `.p{color:red;:local;}`. The lone `;` that
      is left reads as an empty rule, so the kinds still agree.
    - Every stylesheet that fails the token check today keeps its diagnostic.
    - A stylesheet that fails the bundler's syntax check today can get the
      token-check message instead. `:global@media all{.a}` fails today at
      1:21 with a syntax error, and under B at 1:1 with the token-check
      message.
  - **C.** Keep a bare wrapper that no selector follows, so that
    `lightningcss` reports a syntax error. C does not cover the `:global()`
    form. C is a new rejection. Effort: Small.
  - **D.** B, but a statement with no prelude token and no block gets no kind
    entry. Effort: Medium.
    - cssparser reads no statement at a lone `;` in a block, so the bundler
      sees no statement there.
    - Then `.p{:local;}` and `.p{color:red;:local;}` fail too.
    - D is a new rejection.
    - A trial of D changed 31 lines in `module_integrity.rs`.
  - **E.** D, and a kind difference at a statement that starts with a scope
    wrapper fails with a catalogued wrapper message. Effort: Medium.
    - The message names the wrapper. It tells the author to put a selector
      after the wrapper or to remove it.
    - When the tokens agree, only a wrapper at the statement start can change
      a kind. So the message is true where it shows.
    - E adds one row to `docs/protocol/mokly-imported-styles-errors.md` and
      one sentence to the protocol page.
    - E is a new rejection.
- **Left out:**
  - Parse the authored text with the bundler. Supported module syntax such as
    `@keyframes :local(spin)` fails that parse, and `:global(@media all){…}`
    passes it.
  - A renamer check for each wrapper shape. That check must know each shape,
    but the kind comparison finds every shape at the statement start.
  - Kind entries inside the token list. They moved two pinned diagnostic
    positions, so two existing tests failed:
    - In `token_guard_rejects_non_name_changes_with_the_exact_diagnostic`, at
      `crates/mokly-css/src/_tests_/modules_tests.rs:18`, 1:17 became 1:14.
    - In `token_check_failures_point_at_the_first_changed_token`, at
      `crates/mokly-css/src/_tests_/module_diagnostics_tests.rs:106`, the
      `a b` to `a b b` case moved from 1:4 to 1:1.
- **Wider fix:** E. It compares what each statement is, so each wrapper shape
  that changes a statement fails, and its message names the fix.
- **Previous examples:** PR #241, commit `c9d402cd`, made the three scanners
  take the start and kind of each statement from cssparser.
- **Related:** [css-module-custom-property-rules.md](css-module-custom-property-rules.md)
  is another place where one scanner reads statements in its own way. Both
  items came from the same differential review, so one branch can apply both
  answers.
- **Recommendation:** E. It catches every form, also the `;` form that B
  misses, and its message tells the author the fix. If the error catalogue
  must not change, D is the smallest correction of B.
- **Action:** ask the user, because every fixing option makes stylesheets
  fail that build today. The always-on rules reserve each new rejection for
  the user.
- **Design for E:**
  - `fingerprint` also returns the statement kinds in authored order. Each
    kind entry holds the `Statement` that the section reader returns and the
    statement start.
  - A `composes` declaration has no kind entry, because the renamer removes
    it with its `;`.
  - A section with no significant prelude token and no block has no kind
    entry.
  - `check` compares the token entries first, as today. Only when they agree,
    it compares the kind lists up to the longer length, as `Statement`
    values.
  - A kind difference points at the authored statement start. When scoping
    only adds statements, it points at the end of the stylesheet.
  - When that statement starts with a scope wrapper, the failure uses the
    wrapper message. Otherwise it uses the token-check message.
  - A bare form gets a new row. Its draft wording follows, where `{wrapper}`
    is `:global` or `:local`:
    `CSS Modules {wrapper} has no selector after it in {stylesheet}:{line}:{column}; add a selector after it or remove it`.
    Confirm the wording under the copy rules of the `product-ui` skill.
  - A function form, such as `:global(@media all)`, uses the existing
    empty-wrapper row. That row's condition then reads "a CSS Modules
    selector wrapper without a selector".
  - B and D use the same two comparisons. Under B, an empty section keeps its
    kind entry. Under B and D, every kind difference uses the token-check
    message.
- **Work:**
  - Write the protocol sentences in
    `docs/protocol/mokly-imported-styles-modules.md`, section Names:
    - A result that changes, drops, or adds a statement changes more than a
      local name. An example is a bare `:global` before an at-keyword.
    - When every token agrees, the failure points at the statement start.
    - Under E, a failure at a scope wrapper uses the wrapper message.
  - Under E, add the new row to the Build section of
    `docs/protocol/mokly-imported-styles-errors.md`. Reword the condition of
    the empty-wrapper row as the design says.
  - Add the regression tests first, and save their failure on the unfixed
    code:
    - The eleven stylesheets fail at the statement start.
    - Under D and E, `.p{:local;}` and `.p{color:red;:local;}` fail too.
    - Under E, each failure uses the wrapper message.
  - Add the kind list and the second comparison to `module_integrity.rs`.
  - Keep every existing diagnostic test unchanged.
  - Say in `crates/mokly-css/README.md` that the token check also compares
    what each statement is.
  - Under A, change no code. State the exception in the protocol page,
    section Names.
  - Under C, change the bare-wrapper removal at `rename_selectors.rs:96-100`
    instead.
  - Run `cargo test -p mokly-css` and Clippy.
  - Delete this item in the branch that applies the answer.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5962).
