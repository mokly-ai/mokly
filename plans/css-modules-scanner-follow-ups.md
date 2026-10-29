# CSS Modules Scanner Follow-Ups

Status: Active. On branch `conductor/rust-rebuild-112-css-modules-follow-ups`,
no pull request yet. The plan closes when its PR merges.

This plan resolves user items 112 and 113 of the
[Rust rebuild plan](./rust-rebuild.md#open-user-items-deferred-by-the-user-on-2026-10-21).
It also resolves the open lines that
[PR #241](https://github.com/mokly-ai/mokly/pull/241) added there for user
decision 111 C:

- the follow-up for the rule-list `;` boundary
- finding 1 of the final review of `rebuild/port-111c`
- the open problem at
  `crates/mokly-css/src/_tests_/token_differential_tests.rs:200`
- the two problems outside that review's scope, at
  `crates/mokly-css/src/token_sections.rs:59` and
  `crates/mokly-css/src/token_grammar.rs:68`

Mokly scopes each `*.module.css` file before `lightningcss` bundles it. The
scoper in `crates/mokly-css` runs three scanners over the authored text. The
module check rejects authored `@value`. The renamer renames local names and
removes the `:global` and `:local` scope wrappers. The token check compares
the authored and the scoped tokens, so that scoping changes only local names
and module syntax. PR #241 made the three scanners read each statement through
one section reader, which takes each statement's start and kind from
cssparser.

The probes on `main` at `c9d402cd` confirm every record. Their summary is
`.context/css-modules-scanner-follow-ups/probe-summary.md`. One result is
stronger than the 112 record. `:global @keyframes spin{…}` ships a global
`@keyframes spin` and a renamed `animation` reference. So the animation never
runs, and no diagnostic shows. The code of options 1 B, 1 D, 4 B, 112 B, and
113 B was tried in a throwaway worktree. Each one scopes all 53 tracked
stylesheets exactly as `main` does.

A change that makes a stylesheet fail that builds today is a new rejection.
The always-on rules reserve each new rejection for Cal. Cal must also approve
each option that removes functionality from `main`.

- New rejections: 1 B, 1 C, 1 D, 4 B, 112 B, 112 C, 112 D, 112 E, 113 B, and
  113 C.
- Removes functionality: 1 E.
- Neither: 1 A, 2 A, 2 B, 3 A, 3 B, 4 A, 4 C, 112 A, and 113 A. Of these, 1 A,
  112 A, and 113 A change a requirement.
- Decided C deletes three fixture list files and replaces them, as its record
  below says.

Not covered:

- the descriptor-block reading, which the protocol page keeps by decision
- the text reading of an unknown keyframes at-rule without a block in a style
  block, which nesting round 8 settled

Contract owners:

- [Imported Stylesheet CSS Modules](../docs/protocol/mokly-imported-styles-modules.md).
- [Imported Stylesheet Diagnostics](../docs/protocol/mokly-imported-styles-errors.md#build-build-invalid):
  under 112 E it gains one row. Every other option reuses its messages.
- The [mokly-css README](../crates/mokly-css/README.md).

## Decisions

### Decided

- Finding 1 of the final review of `rebuild/port-111c` at `b152d0dc`: C, on
  2026-10-28, through the coordinator workspace "rust rebuild - outstanding
  items". Move the differential to an integration test that reads the tracked
  stylesheets at test time, behind a test-support feature. The coordinator's
  reviewer kept the recorded recommendation and added two conditions:
  - The test runs in the gate's `cargo test --workspace`, which
    `xtask/src/check/commands.rs` defines. The gate skips a target with a
    `required-features` entry, so the test has none.
  - The old reader is test code that calls private items:
    `token_grammar::classify`, `token_grammar::custom_property`,
    `token_sections::next`, and the `Tokens` fields. So the feature exposes all
    of them, or both readers move into one module behind the feature. This plan
    moves both readers.
  - Rejected: options A, B, and D to G of that review. The coordinator's
    workspace holds its report, `.context/port-111c/review/review-7.md`. A was
    the first-pass recommendation.
  - Reason: C reads every tracked stylesheet. So a new stylesheet joins the
    differential without an edit, and a moved file cannot break the test
    build.
  - C deletes `token_differential_fixtures_1.rs`, `_2.rs`, and `_3.rs` under
    `crates/mokly-css/src/_tests_/`. The new test reads every stylesheet that
    they list and two more, so no case is lost. The commit message records
    decision C as the approval.

### Options check

The options check ran on 2026-10-29 before the first commit. Its report and
the verification of its claims are in
`.context/css-modules-scanner-follow-ups/options-check.md`. It added options
1 D, 1 E, 2 B, 3 B, 112 D, 112 E, 113 C, and 4 C. It changed the
recommendations of items 1, 2, 3, 112, and 4. It also corrected three
statements of the first draft about 112 B and 113 B.

### Open review items

The terms that several items use:

- **Section reader:** `token_sections::next` in `crates/mokly-css`. It gives
  each statement its start, its kind, and the grammar of its block.
- **Bundler:** the `lightningcss` parser and printer that validate and deliver
  the scoped text.
- **Token check:** the scanner in `module_integrity.rs` that fails a scoping
  result that changes more than local names, with a catalogued message.
- **Rule list:** a block that holds only rules, such as the stylesheet itself,
  an `@media` block outside a style rule, or a keyframes block.
- **Style block:** a block that holds declarations and nested rules, such as
  the block of a style rule. The section reader calls it `Grammar::Style`.

#### 1. `@-moz-document` blocks read as style blocks

- **Severity:** Low. **Effort:** Medium.
- **Category:** Product bug.
- **Location:** `crates/mokly-css/src/token_grammar.rs:68`.
- **Background:** The section reader gives each block a grammar from the
  statement that opens it. The grammar decides which statements are
  declarations, rules, or text. The protocol page requires that the scoper reads
  each statement that the bundler keeps with the same start and kind.
- **Problem:** `lightningcss` parses an `@-moz-document url-prefix()` block
  outside a style rule as it parses `@media`, as a rule list. The section reader
  reads it as a style block. So in
  `@-moz-document url-prefix(){@-khtml-keyframes :local(k);}` the scoper keeps
  `:local(k)`, but in `@media all{@-khtml-keyframes :local(k);}` it scopes `k`.
  Both build. The reader also reads an `@nest` block in a style rule as a
  declarations block, but `lightningcss` parses it as a style block.
- **Impact if no action:** A statement that the bundler keeps scopes
  differently in two blocks that the bundler reads the same way. Only unusual
  stylesheets reach it, and no tracked stylesheet uses `@-moz-document`.
- **Options:**
  - **A.** Keep the reading, and name the `@-moz-document` exception beside the
    parity rule in the protocol page and the crate README. It changes a
    requirement. Effort: Small.
  - **B.** Read an `@-moz-document` block as the reader reads an `@media`
    block. That is a rule list in a rule list, and a style block in a style
    block.
    - This is a new rejection.
      `@-moz-document url-prefix(){@-khtml-keyframes :local();}` then fails with
      the catalogued empty-wrapper message, as it does in `@media`.
    - Effort: Small.
  - **C.** B, and a test that asks `lightningcss`, for each name in
    `rule_list`, whether the block accepts a declaration. The test runs in the
    stylesheet and in a style rule. This is a new rejection, as B is. Effort:
    Small.
  - **D.** B, and read an `@nest` block in a style rule as a style block. Add
    a test that does not take its names from `rule_list`.
    - The names are the at-rules that `lightningcss` 1.0.0-alpha.72 parses,
      `@nest`, and one unknown name.
    - The test runs at the top level, in a rule list, in a style rule, and in
      a keyframes block.
    - It requires the style grammar where `lightningcss` parses declarations
      and rules, and the rule-list grammar where it parses rules only.
    - It requires a lenient or declarations grammar where `lightningcss` keeps
      or drops the text.
    - The `@nest` entry changes only diagnostics of stylesheets that fail
      today. This is a new rejection, as B is.
    - Effort: Medium, because the test needs a new test file.
  - **E.** Read an unknown keyframes at-rule without a block as text in every
    block, as `lightningcss` keeps it.
    - Then `@media all{@-khtml-keyframes :local(k);}` loses its export `k`.
      So E removes functionality from `main`.
    - E does not fix the `@-moz-document` grammar, which 113 B needs.
    - Effort: Small.
- **Wider fix:** D. Its test does not take its names from the table that it
  checks, so it also catches a missing or a misplaced entry.
- **Previous examples:** User item 111, the HTML comment tokens before a
  stylesheet statement, which `c9d402cd` fixed. Finding 1 of the review of
  `3066e47a` on `rebuild/port-111c`, the descriptor-block parity claim. The
  `@nest` entry, which the options check found.
- **Recommendation:** D. It corrects both entries, and its test checks the
  whole grammar table against `lightningcss`. The first pass recommended C.
- **Auto-fix:** no, because B and C are new rejections, and A changes a
  requirement.

Every option keeps the declarations reading of an `@-moz-document` block in a
keyframes or `@document` block. The code gives it because the bundler drops or
keeps that text.

#### 2. The `Statement` doc claims parity in descriptor blocks

- **Severity:** Low. **Effort:** Small.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-css/src/token_sections.rs:59`.
- **Terms:**
  - **Descriptor block:** the block of a declaration-only at-rule, such as
    `@font-face` or `@property`.
- **Background:** The doc comment of the `Statement` enum says that a
  statement reads as `lightningcss` reads the block that holds it. The protocol
  page and the crate README give one rule instead. Outside a descriptor block,
  each statement that `lightningcss` keeps reads with the same start and kind.
- **Problem:** The doc comment does not name the descriptor-block exception.
  The reader reads `@font-face{a{b}c:d;}` as a rule `a` with a block, but the
  bundler keeps the descriptor text up to `;`. The comment also claims parity
  for text that the bundler drops or rejects.
- **Impact if no action:** A reader of the code trusts a parity claim that is
  false in descriptor blocks and at the rule-list `;` boundary.
- **Options:**
  - **A.** Name the descriptor-block exception in the doc comment, and link
    `Grammar::Declarations`. Effort: Small.
  - **B.** Put the one rule of the protocol page in the doc comment.
    - Outside a descriptor block, each statement that `lightningcss` keeps
      reads with the kind that `lightningcss` gives it.
    - Link `Grammar::Declarations` for the descriptor case.
    - Say that text which `lightningcss` drops or rejects can read as other
      statements, for example at the rule-list `;`.
    - Effort: Small.
- **Wider fix:** None, because the `documentation` skill already keeps docs
  aligned with the code.
- **Previous examples:** Finding 1 of the review of `3066e47a` on
  `rebuild/port-111c`, which corrected the same claim in the protocol page and
  the README.
- **Recommendation:** B. On 2026-10-26 the user replaced such lists of
  exceptions with one rule, and A still claims too much. The first pass
  recommended A.
- **Auto-fix:** yes, apply A. Milestone 2 applies the option that the
  coordinator confirms.

#### 3. The differential's non-empty assertion cannot fail

- **Severity:** Low. **Effort:** Small.
- **Category:** Test.
- **Location:** `crates/mokly-css/src/_tests_/token_differential_tests.rs:200`.
- **Background:** The differential test compares the old and the new section
  reader on the repository stylesheets and on five generated stylesheets. It
  asserts that its list of sources is not empty.
- **Problem:** The list always holds the five generated stylesheets, so the
  assertion passes also when the repository list is empty.
- **Impact if no action:** A broken listing of the repository stylesheets
  passes without a failure.
- **Options:**
  - **A.** Assert that the list that Git gives under decided C is not empty.
    Effort: Small.
  - **B.** Assert that the test reads at least one stylesheet after it skips
    the deleted paths. Then a list of only deleted paths fails too. Effort:
    Small.
- **Wider fix:** None, because decided C already replaces the fixture list.
- **Previous examples:** None found.
- **Recommendation:** B. It counts where the comparison runs, at no extra cost.
  The first pass recommended A.
- **Auto-fix:** no, because a finding about a test waits for the user. Decided
  C already includes the assertion.

### Open decisions

#### 112. Removed scope wrappers can change a statement

- **Severity:** Low. **Effort:** Small.
- **Terms:**
  - **Scope wrapper:** `:global` or `:local`, bare or with parentheses, in a
    selector. The renamer removes it after it renames the names inside.
- **Background:** The renamer removes each scope wrapper. The token check
  leaves wrappers out of its comparison, and it does not compare what each
  statement is. The protocol page requires that a result that changes more than
  a local name fails with the catalogued token-check message.
- **Problem:** A removed wrapper can change what a statement is.
  - `:global@media all{}` scopes to `@media all{}`, and
    `:global(@media all){.a{}}` becomes a media rule.
  - `.p{:local}` scopes to `.p{}`, and `.p{:local;}` scopes to `.p{;}`.
  - Eleven probed stylesheets of this kind build on `main`, and `.p{:local;}`
    builds too.
  - As plain CSS, the bundler rejects ten of the eleven. It keeps
    `:global(@media all){…}` as a style rule, which browsers drop.
- **Impact if no action:** Such a stylesheet ships with a changed meaning and
  no diagnostic. With `:global @keyframes spin{…}`, the keyframes stay global,
  but the `animation` reference is renamed, so the animation never runs.
- **Options:**
  - **A.** Keep the behaviour, and name the exception in the protocol page. It
    changes a requirement. Effort: Small.
  - **B.** Compare the kind of each statement in the token check, after the
    token comparison agrees.
    - A changed, dropped, or added statement then fails with the catalogued
      token-check message at the statement start.
    - B misses a statement that a removed wrapper empties when it ends at
      `;`, such as `.p{:local;}`.
    - Every stylesheet that fails the token check today keeps its diagnostic.
      A stylesheet that fails the bundler's syntax check today can get the
      token-check message, such as `:global@media all{.a}`.
    - This is a new rejection for the eleven probed stylesheets. Effort:
      Small.
  - **C.** Keep a bare wrapper that no selector follows, so that the bundler
    reports a syntax error. This is a new rejection. It does not cover the
    `:global()` form. Effort: Small.
  - **D.** B, but a statement with no prelude token and no block gets no kind
    entry, because cssparser reads no statement there. Then `.p{:local;}` fails
    too. This is a new rejection, as B is. Effort: Small.
  - **E.** D, and a kind difference at a statement that starts with a scope
    wrapper fails with a catalogued wrapper message.
    - The message names the wrapper, and it tells the author to put a
      selector after it or to remove it.
    - When the tokens agree, only a wrapper at the statement start can change
      a kind. So the message is true where it shows.
    - E adds one row to the error catalogue and one sentence to the protocol
      page. This is a new rejection, as B is.
    - Effort: Small.
- **Recommendation:** E. It fails every form that B fails and the `;` form
  that B misses, and its message tells the author the fix. The first pass
  recommended B. If the catalogue must not change, D is the smallest
  correction of B.
- **Auto-fix:** no, because condition 3 holds: B and C are new rejections, and
  A changes a requirement.

Every option keeps the bare forms, which the protocol page supports. Every
option but E keeps the catalogue as it is. Its reason is weak here, because the
token-check advice "move this CSS to a plain stylesheet" does not fix these
stylesheets.

#### 113. The module check skips custom-property-like blocks

- **Severity:** Low. **Effort:** Small.
- **Terms:**
  - **Module check:** `module_checks::check`, which rejects authored `@value`
    with its catalogued message before the renamer runs.
  - **Custom-property-like statement:** a statement whose first tokens are a
    name that starts with `--` and a colon, such as `--x:{…}`.
- **Background:** The protocol page requires that authored `@value` fails at
  every rule level. The module check walks every statement through the section
  reader. It does not enter the block of a custom-property-like statement.
- **Problem:** In a style block, such a statement is a custom property without
  a block, so the skip does nothing. In a rule list, the reader reads `--x:{…}`
  as a rule with a block, and the skip hides that block. So
  `@keyframes k{--x:{@value y: red;}}` and `@document x{--x:{@value y: red;}}`
  build on `main`.
- **Impact if no action:** An `@value` passes the module check in a keyframes
  or `@document` block. In an `@document` block the bundler keeps the text, so
  the `@value` ships.
- **Options:**
  - **A.** Keep the skip, and name the exception beside the `@value` rule in
    the protocol page. It changes a requirement. Effort: Small.
  - **B.** Delete the skip, so that the module check enters every block that
    the renamer and the token check enter.
    - This is a new rejection for four probed stylesheets.
    - Two stylesheets that fail today get the `@value` message in place of a
      syntax error.
    - With item 1 B or D, `@value` then fails at every rule level. Under item
      1 A, `@-moz-document url-prefix(){@keyframes k{--x:{@value y: red;}}}`
      still builds, because its keyframes block reads as declarations.
    - Effort: Small.
  - **C.** B, and one shared walk in `token_sections` for the three scanners,
    so that no scanner chooses its own blocks.
    - The walk gives each statement and each block end in authored order, with
      its frames on the heap.
    - It changes three scanners, and the deep nesting tests and the pinned
      positions must still pass. This is a new rejection, as B is.
    - Effort: Medium.
- **Recommendation:** B. It removes the only block that one scanner skips
  today, and C is a refactor that this item does not need.
- **Auto-fix:** no, because condition 3 holds: B is a new rejection, and A
  changes a requirement.

Every option keeps a custom property value in a style block as a value, which
the protocol page and the bundler require. Every option keeps the module check
before the renamer, so `@value` shows before any later failure.

#### 4. The rule-list `;` boundary

- **Source:** the follow-up line from finding 2 of the `rebuild/port-111c`
  review. It has no user item number.
- **Severity:** Low. **Effort:** Small.
- **Background:** In a rule list, the section reader ends a statement at `;`
  or at its `{}` block. cssparser ends a qualified rule in a rule list only at
  its `{}` block. The protocol page states this boundary with a decision in
  force. Aligning it was not chosen, because no realistic stylesheet reaches it
  and diagnostics would change. The user kept a follow-up line open for it.
- **Problem:** The probe confirms the difference. Alignment also changes more
  than diagnostics. `@document x{.c{}.a;.b{composes:c}}` builds today and would
  fail. Before 113 B, alignment would also let
  `@keyframes k{--x:1;to{@value y: red;}}` build, which fails today.
- **Impact if no action:** The scanners keep one documented difference from
  cssparser. No tracked stylesheet reaches it.
- **Options:**
  - **A.** Keep the boundary and the decision in force, and close the
    follow-up line. Effort: Small.
  - **B.** In a rule list, end a statement at `;` only when it starts with an
    at-keyword, as cssparser does. Do it after 113 B.
    - This is a new rejection.
    - It changes the decision in force and the diagnostics of stylesheets that
      fail today.
    - Effort: Small.
  - **C.** A, and complete the reason of the decision in force in the protocol
    page. Alignment would also make stylesheets fail that build today, such as
    a composition after a `;` in an `@document` block. Effort: Small.
- **Recommendation:** C. It keeps the behaviour of A and closes the follow-up,
  and the page then gives the full reason. The first pass recommended A.
- **Auto-fix:** no, because condition 5 holds: the user kept this follow-up
  open for a later choice.

Every option keeps the descriptor-block reading, which the protocol page keeps
by decision. Every option keeps the `;` end of an at-rule in a rule list, as
cssparser reads it.

## Design

### Statement kinds in the token check (112 E)

- `module_integrity::fingerprint` also returns the statement kinds in
  authored order. Each kind entry holds the `Statement` that the section reader
  returns and the statement start.
- A `composes` declaration has no kind entry, as it has no token entries. The
  renamer removes it with its `;`.
- Under D and E, a section with no significant prelude token and no block has
  no kind entry. cssparser skips a lone `;` in a block, so the bundler reads no
  statement there.
- `check` compares the token entries first, as today. Only when they agree, it
  compares the kind lists up to the longer length, as `Statement` values.
- A kind difference points at the start of the authored statement, or at the
  end of the stylesheet when scoping only adds statements there.
- Under E, when that authored statement starts with a scope wrapper, the
  failure uses the wrapper message. Otherwise it uses the token-check message.
- My call (2026-10-28): two passes, not kind entries in the token list. A kind
  entry before the prelude tokens moved the pinned position `1:17` of
  `token_guard_rejects_non_name_changes_with_the_exact_diagnostic` to `1:14`.
  A kind entry after them moved the `a b` to `a b b` case of
  `token_check_failures_point_at_the_first_changed_token` from `1:4` to `1:1`.
  With two passes, every existing test passes unchanged.
- Draft wording under E, my call (2026-10-29), to confirm under the
  `product-ui` copy rules in Milestone 1:
  - A bare form gets a new row:
    `CSS Modules {wrapper} has no selector after it in {stylesheet}:{line}:{column}; add a selector after it or remove it`,
    where `{wrapper}` is `:global` or `:local`.
  - A function form, such as `:global(@media all)`, uses the existing
    empty-wrapper row, because the wrapper holds no selector. The row's
    condition then reads "a CSS Modules selector wrapper without a selector".

### The module check enters every block (113 B)

- Delete the custom-property condition in `module_checks::check`.
- `Section::custom_property` then has no caller, so it goes as dead code.
  `token_grammar::custom_property` stays, because `token_sections::next` and
  the old reader call it.
- The deep scanner test
  `module_checks_find_a_deep_value_rule_after_custom_property_blocks` keeps its
  purpose with the custom property inside a style rule. There its value holds
  no statements: `a{--x:{@value y;}}b{color:red}` inside the deep `@media`
  nesting. The test also asserts that `--x:{@value y;}` directly in the rule
  list fails.

### The grammar table follows `lightningcss` (item 1 D)

- `token_grammar::rule_list` gains `-moz-document`, and `nested` drops its
  special case. So an `@-moz-document` block is a rule list in a rule list and
  a style block in a style block, as for `@media`.
- In a lenient rule list, an `@-moz-document` block stays a declarations block.
- In a style block, `nested` reads an `@nest` block as a style block.
- The old reader's `legacy_nested` changes the same way. My call (2026-10-28):
  the two readers share the grammar table, and the differential allows only
  start differences.
- A new unit test file, `src/_tests_/token_grammar_tests.rs`, checks the table
  against `lightningcss`, as option D says. `lightningcss` is a pure library,
  so a unit test may call it. My call (2026-10-29): a new file, because
  `token_sections_tests.rs` already has 249 of its 300 lines.

### The differential reads every tracked stylesheet (decided C)

- `crates/mokly-css/Cargo.toml` adds the feature `test-support = []`, and the
  dev-dependency `mokly-css = { workspace = true, features = ["test-support"] }`.
  - Cargo then turns the feature on for the unit and the integration tests, in
    `cargo test -p mokly-css` and in `cargo test --workspace`.
  - No `required-features` entry is necessary, and a plain build leaves the
    feature off. `Cargo.lock` gains one line.
  - A probe proved this with Cargo 1.95 and Clippy `-D warnings`.
  - My call (2026-10-28): the self dev-dependency meets both conditions of
    decided C and exposes no private item.
- Both readers move into one module, `src/_tests_/token_differential.rs`.
  - `lib.rs` declares it as `pub mod token_differential` under
    `#[cfg(any(test, feature = "test-support"))]`, with a `#[path]`
    attribute.
  - The module holds the old reader and the parser-backed walk.
  - Its one public function compares the two walks of one source. It returns
    the first unexplained difference.
  - My call (2026-10-28): the module is test code, so it lives in `_tests_`,
    and only the comparison is public.
- The integration test is `crates/mokly-css/tests/token_differential_tests.rs`.
  - It lists `git ls-files -z --cached --others --exclude-standard -- '*.css'`
    at the repository root, as `tests/markdown_links.test.ts` lists its files.
  - It skips a listed path that the working tree deleted, because the remote
    Testbox copies a branch over a `main` checkout.
  - It reads the rest and compares each stylesheet. A failure names the
    stylesheet.
  - It asserts that it read at least one stylesheet (item 3 B).
  - My call (2026-10-28): Git gives the same list in a checkout, a worktree,
    and a Testbox. Integration tests may read files and run processes.
- The five generated stylesheets and the HTML comment prefix test stay unit
  tests in `_tests_/token_differential_tests.rs`, because they read no files.

### Order of work and shared files

- Milestone 2 comes first. Then the differential covers every tracked
  stylesheet before Milestone 5 changes the grammar table.
- Milestone 6 runs only under 4 B, and after Milestone 4. Otherwise alignment
  widens the 113 skip.
- Cal's model rule for this workspace:
  - Docs work goes to `--agent claude --model opus-5-5-1m --effort max`.
  - Other implementation goes to `--agent codex --model gpt-6.1-sol --effort max`.
  - The managing session checks the delegated work.
- Shared files with work in flight, checked on 2026-10-28:
  - Workspace 353, `calummoore/mokly-tests-rust-migration`, no PR: `Cargo.lock`
    and `plans/rust-rebuild.md`. It ports Node tests to Rust. This plan edits
    no Node test and adds its tests to `crates/mokly-css`.
  - Workspace 397, `calummoore/viewer-library-design`: no shared file. It
    changes `xtask/src/check/commands.rs` but keeps `cargo test --workspace`,
    which decided C relies on.
  - Workspace 406, `conductor/rust-rebuild-150-base-install-scripts-and-managers`:
    `plans/rust-rebuild.md`.
  - Workspace 407, `conductor/rust-rebuild-177-token-redaction`: no shared
    file.
  - Workspace 408, `conductor/rust-rebuild-166-windows-paths-and-links`:
    `Cargo.lock`.
  - Workspace 386 merged as PR #240. Workspace 349 merged as PR #241, and its
    branch `rebuild/port-111c` is gone.
  - Perf: `conductor/perf-5-step-b-stylesheet-cache-reuse` has no PR. It is
    step B of `plans/stylesheet-bundle-performance.md`. In this crate it changes
    only `crates/mokly-css/src/compiler.rs`, so it shares no file.
  - PRs #224 and #237 share no file. PRs #212 and #213 share `Cargo.lock` and
    `plans/rust-rebuild.md`. #213 also changes `xtask/src/check/commands.rs`
    and keeps `cargo test --workspace`.
  - Resolve a conflict in `Cargo.lock` or `plans/rust-rebuild.md` path by path,
    under the `git-merge` skill.

## Milestone 1: Documentation and protocol

The protocol pages state the requirements that the chosen options add. Under
the recommended options, only 112 E and 4 C change them. No code changes.

- [ ] Write the 112 text in `docs/protocol/mokly-imported-styles-modules.md`,
      Names.
  - Under 112 B, D, or E: a result that changes, drops, or adds a statement
    changes more than a local name. Give a bare `:global` before an at-rule
    keyword as the example.
  - Under 112 B, D, or E: when every token agrees, the failure points at the
    statement start.
  - Under 112 E: such a failure at a scope wrapper uses the wrapper message.
    Add its row to `docs/protocol/mokly-imported-styles-errors.md`.
  - Under 112 C: a bare wrapper that no selector follows stays as authored.
  - Under 112 A: state the exception.
- [ ] Under 113 A, name the custom-property-like exception beside the `@value`
      rule. Under 113 B, the page needs no change.
- [ ] Under item 1 A, name the `@-moz-document` exception beside the parity
      rule. Under B, C, or D, the page needs no change.
- [ ] Write the item 4 text.
  - Under 4 C: add the new reason to the decision in force on the `;`
    boundary.
  - Under 4 B: replace the `;` example and its decision with the aligned
    boundary.
  - Under 4 A: no change.
- [ ] Add the Status line below the title of each changed page:
      `Status: In progress under the [CSS Modules Scanner Follow-Ups](../../plans/css-modules-scanner-follow-ups.md) plan.`
- [ ] Run `npm run format:check` and `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: The differential reads every tracked stylesheet

Decided C and review items 2 and 3. The behaviour does not change.

- [ ] Add the `test-support` feature and the self dev-dependency to
      `crates/mokly-css/Cargo.toml`.
- [ ] Move both readers into `src/_tests_/token_differential.rs`. Declare it in
      `lib.rs` as the design says.
- [ ] Add `tests/token_differential_tests.rs` as the design says, with the
      item 3 assertion.
- [ ] Keep the generated cases and the HTML comment prefix test as unit tests.
- [ ] Delete the three fixture list files. Record decided C as the approval in
      the commit message.
- [ ] Correct the `Statement` doc comment with the option that the coordinator
      confirms for item 2.
- [ ] Describe the integration test and the feature in the README section
      Development.
- [ ] Prove the test, and save both results under
      `.context/css-modules-scanner-follow-ups/`.
  - Break `legacy_nested` once in a scratch copy. The test must fail and name
    a tracked stylesheet.
  - `cargo test --workspace -- --list` must list the test.
- [ ] Run `cargo test -p mokly-css`, Clippy, `cargo fmt --all -- --check`, and
      `cargo xtask rust-file-length-lint`.

## Milestone 3: The token check compares statement kinds (112)

This milestone needs 112 B, D, or E. Under 112 A, it has no code, and
Milestone 1 closes the item. Under 112 C, change the bare-wrapper edit in
`rename_selectors.rs` instead.

- [ ] Add the regression tests first, and save their failure on the unfixed
      code.
  - The eleven probed stylesheets fail at the statement start.
  - Under D or E, `.p{:local;}` and `.p{color:red;:local;}` fail too.
  - Under E, the failure uses the wrapper message.
- [ ] Add the kind list and the second comparison to `module_integrity.rs`, as
      the design says.
- [ ] Keep every existing diagnostic test unchanged.
- [ ] Say in the README that the token check also compares what each statement
      is.
- [ ] Run `cargo test -p mokly-css` and Clippy.

## Milestone 4: The module check enters every block (113)

This milestone needs 113 B or C. Under 113 A, it has no code, and Milestone 1
closes the item.

- [ ] Add the regression tests first, and save their failure on the unfixed
      code.
  - The four probed stylesheets fail with the `@value` message at their
    `@value`.
  - The two failing ones get the `@value` message.
  - `.p{--x:{@value y: red;}}` still builds.
- [ ] Delete the skip and the dead `Section::custom_property`. Record the
      search that shows it dead in the commit message.
- [ ] Change the deep scanner test as the design says.
- [ ] Under 113 C, move the three scanners to one shared walk in
      `token_sections`.
- [ ] Run `cargo test -p mokly-css` and Clippy.

## Milestone 5: The grammar table follows `lightningcss` (item 1)

This milestone needs item 1 B, C, or D. Under A, it has no code, and
Milestone 1 closes the item.

- [ ] Add the regression tests first, and save their failure on the unfixed
      code.
  - `@-moz-document url-prefix(){@-khtml-keyframes :local(k);}` scopes `k`, as
    in `@media`.
  - Under 113 B,
    `@-moz-document url-prefix(){@keyframes k{--x:{@value y: red;}}}` fails
    with the `@value` message.
- [ ] Change `rule_list` and `nested`, and `legacy_nested` in the differential
      module.
- [ ] Change the two `@-moz-document` rows of
      `blocks_open_the_grammar_that_lightningcss_parses`.
- [ ] Correct the doc comments of `Grammar::Rules`, `Grammar::Style`, `nested`,
      and the wrapper table's `DOCUMENT` level.
- [ ] Under C, add the grammar test of option C to `token_sections_tests.rs`.
- [ ] Under D, add the `@nest` entry and `src/_tests_/token_grammar_tests.rs`.
- [ ] Run `cargo test -p mokly-css` and Clippy.

## Milestone 6: The rule-list `;` boundary (item 4)

This milestone runs only under 4 B, after Milestone 4. Under 4 A or C, it
holds one TODO that records the decision, and Milestone 7 ticks the follow-up
line.

- [ ] Add the regression tests first, and save their failure on the unfixed
      code.
  - `@document x{.c{}.a;.b{composes:c}}` fails with the composition message.
  - `@keyframes k{--x:1;to{@value y: red;}}` still fails with the `@value`
    message.
- [ ] In `token_sections::next`, end a rule-list statement at `;` only when it
      starts with an at-keyword.
- [ ] Change the rule-list rows of
      `statements_are_classified_as_lightningcss_reads_a_block`.
- [ ] Change the README example of the `;` boundary.
- [ ] Run `cargo test -p mokly-css` and Clippy.

## Milestone 7: Verification, commit, review, and pull request

- [ ] Remove the Status lines of Milestone 1 when their requirements are
      implemented.
- [ ] Rerun every probe on the fixed build. Save the results under
      `.context/css-modules-scanner-follow-ups/`.
- [ ] Update `plans/rust-rebuild.md` with the smallest edit.
  - Tick items 112 and 113, the `;` follow-up line, and finding 1 of the final
    review.
  - Give each its decision, its date, and a link to this plan.
  - Under the open problem line and the two lines outside the
    `rebuild/port-111c` review scope, add one line that names this plan.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings, then
      apply the review-fix rule: fix the `Auto-fix: yes` findings, re-review
      once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked. Put its
      link in the status paragraph.
