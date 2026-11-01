# CSS Modules Scanner Follow-Ups

Status: Active. On branch `conductor/rust-rebuild-112-css-modules-follow-ups`,
no pull request yet. On 2026-11-01 Cal asked that the pull request of this work
delete this plan before it merges, and that the work that waits for him move to
follow-up items. So the first pull request deletes this plan. The follow-up
items `css-module-bare-wrapper-kind.md`, `css-module-custom-property-rules.md`,
and `moz-document-statement-kind.md` under `plans/follow-ups/` hold the work of
Milestones 5 to 8.

This plan resolves user items 112 and 113 of the
[Rust rebuild plan](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md#open-user-items-deferred-by-the-user-on-2026-10-21).
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
runs, and no diagnostic shows.

A change that makes a stylesheet fail that builds today is a new rejection.
The always-on rules reserve each new rejection for Cal. Cal must also approve
each option that removes functionality from `main`. The three parts that wait
for Cal each add a new rejection. The decided parts add none.

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

The coordinator workspace "rust rebuild - outstanding items" answered on
2026-10-29, after an independent Opus 5.5 reviewer checked the items at
`c9d402cd` and tried several options in a scratch copy.

- Finding 1 of the final review of `rebuild/port-111c` at `b152d0dc`: C, on
  2026-10-28, confirmed on 2026-10-29. Move the differential to an
  integration test that reads the tracked stylesheets at test time, behind a
  test-support feature. The coordinator's reviewer added two conditions:
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
- Item 1, `@-moz-document` blocks read as style blocks: F, a new option, on
  2026-10-29.
  - Apply the `@nest` entry of D: in a style block, `nested` reads an `@nest`
    block as a style block, as `lightningcss` parses it.
  - Apply the table test of D against the bundler, with `@-moz-document`
    outside a style rule as the one named exception.
  - Apply the documentation of A: the protocol page and the crate README name
    the `@-moz-document` exception beside the parity rule.
  - F adds no rejection. The reviewer's trial left all 53 tracked stylesheets
    unchanged. The `@nest` entry changes only the diagnostics of stylesheets
    that fail today.
  - The `@-moz-document` change of D waits for Cal. If Cal approves it, the
    exception goes. If Cal declines it, the exception stays, and the item 2
    comment names it.
  - Rejected: A alone, which keeps the `@nest` difference; B and C, which
    miss `@nest`; E, which removes functionality from `main`.
- Item 2, the `Statement` doc: B, on 2026-10-29. State Cal's one rule and the
  caveat for dropped text. Rejected: A, which names one exception and still
  claims too much.
  - The example of the first draft was wrong. `lightningcss` drops
    `@font-face{a{b}c:d;}` and prints `@font-face { }`, so that is dropped text.
  - A kept example is `@font-face{c:d{x}e;}`. The bundler keeps `c: d{x}e;`
    through its custom-descriptor fallback, `src/rules/font_face.rs:480-484`
    in `lightningcss`. The reader reads a rule `c:d` with a block, then the
    text `e`.
  - My call (2026-10-29): the comment also names the `@-moz-document`
    exception while it stays in the code, so that the comment matches the
    code. A later change removes that sentence if Cal approves the
    `@-moz-document` change.
- Item 3, the differential's non-empty assertion: B, on 2026-10-29. Count the
  stylesheets that the comparison really reads, after the test skips deleted
  paths. Rejected: A, which counts the Git list before that skip.
- Item 4, the rule-list `;` boundary: C, on 2026-10-29. Keep the boundary and
  the decision in force. Record in the protocol page that alignment would also
  reject stylesheets that build today. Rejected: A, which keeps the shorter
  reason, and B, which is a new rejection.

### Waiting for Cal

On 2026-10-29 the coordinator said that items 112 and 113 and the
`@-moz-document` change of item 1 wait for Cal. The reviewer confirms 112 E,
graded Medium, and 113 B. The second pull request applies the answers.

### Options check

The options check ran on 2026-10-29 before the first commit. Its report and
the verification of its claims are in
`.context/css-modules-scanner-follow-ups/options-check.md`. It added options
1 D, 1 E, 2 B, 3 B, 112 D, 112 E, 113 C, and 4 C. It changed the
recommendations of items 1, 2, 3, 112, and 4. It also corrected three
statements of the first draft about 112 B and 113 B.

### Open decisions

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

#### 112. Removed scope wrappers can change a statement

- **Severity:** Low. **Effort:** Medium.
- **Terms:**
  - **Scope wrapper:** `:global` or `:local`, bare or with parentheses, in a
    selector. The renamer removes it after it renames the names inside.
- **Background:** The renamer removes each scope wrapper. The token check
  leaves wrappers out of its comparison. Its fingerprint depends on the kind
  only in part: a colon prints as `:` in a renamed prelude and as `Colon`
  elsewhere, in `module_integrity.rs:81-91` and `:122-143`. So
  `.p{:global color:red}` already fails on `main`. The protocol page requires
  that a result that changes more than a local name fails with the catalogued
  token-check message.
- **Problem:** The gap is a kind change with equal tokens: a rule that becomes
  an at-rule, or a dropped statement.
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
    too. This is a new rejection, as B is. The reviewer's trial of D changed
    31 lines in `module_integrity.rs`. Effort: Medium.
  - **E.** D, and a kind difference at a statement that starts with a scope
    wrapper fails with a catalogued wrapper message.
    - The message names the wrapper, and it tells the author to put a
      selector after it or to remove it.
    - When the tokens agree, only a wrapper at the statement start can change
      a kind. So the message is true where it shows.
    - E adds one row to the error catalogue and one sentence to the protocol
      page. This is a new rejection, as B is.
    - Effort: Medium.
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
    - With the `@-moz-document` change of item 1, `@value` then fails at every
      rule level. Without it,
      `@-moz-document url-prefix(){@keyframes k{--x:{@value y: red;}}}` still
      builds, because its keyframes block reads as declarations.
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

#### 1. The `@-moz-document` change of item 1

- **Severity:** Low. **Effort:** Small.
- **Background:** Decided F aligns the `@nest` entry and checks the grammar
  table against the bundler. It lists `@-moz-document` outside a style rule as
  the one named exception, and the docs name it.
- **Problem:** `lightningcss` parses an `@-moz-document url-prefix()` block
  outside a style rule as it parses `@media`, as a rule list. The section
  reader reads it as a style block. So in
  `@-moz-document url-prefix(){@-khtml-keyframes :local(k);}` the scoper keeps
  `:local(k)`, but in `@media all{@-khtml-keyframes :local(k);}` it scopes `k`.
  Both build.
- **Impact if no action:** A statement that the bundler keeps scopes
  differently in two blocks that the bundler reads the same way. The
  documented exception stays. No tracked stylesheet uses `@-moz-document`.
- **Options:**
  - **A.** Decline: keep the reading and the documented exception. The item 2
    comment keeps its `@-moz-document` sentence. Effort: Small.
  - **D.** Approve: read an `@-moz-document` block as the reader reads an
    `@media` block, and remove the exception from the test and the docs.
    - This is a new rejection.
      `@-moz-document url-prefix(){@-khtml-keyframes :local();}` then fails
      with the catalogued empty-wrapper message, as it does in `@media`.
    - With 113 B, it also closes the last `@value` gap of item 113.
    - Effort: Small.
- **Recommendation:** D. It removes the last named exception, and the table
  test then holds without one.
- **Auto-fix:** no, because condition 3 holds: D is a new rejection.

## Design

### The `Statement` doc comment (item 2 B)

The comment states one rule and its caveats:

- Outside a descriptor block, each statement that `lightningcss` keeps reads
  with the start and the kind that `lightningcss` gives it.
- The exception: an `@-moz-document` block outside a style rule reads as a
  style block, but `lightningcss` parses it as a rule list.
- In a descriptor block, a statement that is not a custom property ends at its
  first `{}` block, as postcss reads it, and links `Grammar::Declarations`. The
  example is `@font-face{c:d{x}e;}`.
- Text that `lightningcss` drops or rejects can read as other statements, for
  example a rule-list statement that a `;` ends.

### The grammar table follows `lightningcss` (item 1 F)

- In a style block, `token_grammar::nested` reads an `@nest` block as a style
  block. The old reader's `legacy_nested` changes the same way. My call
  (2026-10-28): the two readers share the grammar table, and the differential
  allows only start differences.
- A new unit test file, `src/_tests_/token_grammar_tests.rs`, checks `nested`
  against `lightningcss`. `lightningcss` is a pure library, so a unit test may
  call it. My call (2026-10-29): a new file, because `token_sections_tests.rs`
  already has 249 of its 300 lines.
  - Names: every block at-rule that `lightningcss` 1.0.0-alpha.72 parses, with
    a valid prelude, and one unknown name. These are `media`, `supports`,
    `container`, `layer`, `scope`, `starting-style`, `-moz-document`,
    `font-face`, `font-feature-values`, `font-palette-values`,
    `counter-style`, `viewport`, `-ms-viewport`, the five `keyframes` names,
    `page`, `view-transition`, `property`, `position-try`, and `nest`.
  - Contexts: the top level, inside `@media all{…}`, inside `.p{…}`, and
    inside `@keyframes k{…}`. They read as `Grammar::Stylesheet`,
    `Grammar::Rules`, `Grammar::Style`, and `Grammar::Lenient`.
  - Two probes for each name and context: a body `color:red` and a body
    `.a{color:red}`. The declaration counts as parsed when the stylesheet parses
    and prints `color: red;`. The rule counts as parsed when it parses and
    prints `.a {`. Kept text prints as written, such as `color:red`.
  - Expected grammar: `Grammar::Style` when both parse, and `Grammar::Rules`
    when only the rule parses. Any other result keeps, drops, or rejects the
    text, and allows `Grammar::Lenient` or `Grammar::Declarations`.
  - The one named exception is `-moz-document` in the top-level and rule-list
    contexts. The test asserts that it still differs, so the exception list
    cannot go stale.
- Research on `main`: `.context/css-modules-scanner-follow-ups/research/lightningcss-blocks.log`.
  Before F, the test fails only for `@nest` in a style rule and for the named
  exception.

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
  - It asserts that it compared at least one stylesheet (item 3 B).
  - My call (2026-10-28): Git gives the same list in a checkout, a worktree,
    and a Testbox. Integration tests may read files and run processes.
- The five generated stylesheets and the HTML comment prefix test stay unit
  tests in `_tests_/token_differential_tests.rs`, because they read no files.

### Statement kinds in the token check (112 E, waits for Cal)

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
  `product-ui` copy rules:
  - A bare form gets a new row:
    `CSS Modules {wrapper} has no selector after it in {stylesheet}:{line}:{column}; add a selector after it or remove it`,
    where `{wrapper}` is `:global` or `:local`.
  - A function form, such as `:global(@media all)`, uses the existing
    empty-wrapper row, because the wrapper holds no selector. The row's
    condition then reads "a CSS Modules selector wrapper without a selector".

### The module check enters every block (113 B, waits for Cal)

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

### The `@-moz-document` change (item 1 D, waits for Cal)

- `token_grammar::rule_list` gains `-moz-document`, and `nested` drops its
  special case. So an `@-moz-document` block is a rule list in a rule list and
  a style block in a style block, as for `@media`.
- In a lenient rule list, an `@-moz-document` block stays a declarations block.
- `legacy_nested` changes the same way, the table test loses its exception,
  and the docs and the item 2 comment lose the exception sentence.

### Order of work and shared files

- Cal's rule, word for word: "impl all plan milestones, delegate docs / ui
  impl to opus 5.5 max thinking, delegate non-ui to sol 6.1 max thinking,
  check delegated work, request changes as needed".
  - Docs work goes to `--agent claude --model opus-5-5-1m --effort max`.
  - Other implementation goes to `--agent codex --model gpt-6.1-sol --effort max`.
  - The delegates share this working tree, so they run one at a time. The
    managing session checks each diff and runs the tests.
- Milestone 2 comes before Milestone 3, so that the differential covers every
  tracked stylesheet before Milestone 3 changes the grammar table.
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

First pull request. The protocol page and the crate README state the decided
reason of item 4 and the `@-moz-document` exception of item 1 F. Both describe
the current behaviour, so no page needs a Status line. No code changes.

- [x] In `docs/protocol/mokly-imported-styles-modules.md`, add to the decision
      in force on the `;` boundary that alignment would also make stylesheets
      fail that build today (item 4 C).
  - The example is a composition after a `;` in an `@document` block.
- [x] Name the `@-moz-document` exception beside the parity rule (item 1 F).
  - In the protocol page and in the crate README, say that the scoper reads
    an `@-moz-document` block outside a style rule as a style block, but the
    bundler reads it as a rule list, as for `@media`.
- [x] Run `npm run format:check` and the Markdown link test.

## Milestone 2: The differential reads every tracked stylesheet

First pull request. Decided C and items 2 B and 3 B. The behaviour does not
change.

- [x] Add the `test-support` feature and the self dev-dependency to
      `crates/mokly-css/Cargo.toml`.
- [x] Move both readers into `src/_tests_/token_differential.rs`. Declare it in
      `lib.rs` as the design says.
- [x] Add `tests/token_differential_tests.rs` as the design says, with the
      item 3 B assertion.
- [x] Keep the generated cases and the HTML comment prefix test as unit tests.
- [x] Delete the three fixture list files. Record decided C as the approval in
      the commit message.
- [x] Write the `Statement` doc comment as the design says (item 2 B).
- [x] Prove the test, and save both results under
      `.context/css-modules-scanner-follow-ups/`.
  - Break `legacy_nested` once in a scratch copy. The test must fail and name
    a tracked stylesheet.
  - `cargo test --workspace -- --list` must list the test.
- [x] Run `cargo test -p mokly-css`, Clippy, `cargo fmt --all -- --check`, and
      `cargo xtask rust-file-length-lint`.

## Milestone 3: The grammar table follows `lightningcss` (item 1 F)

First pull request. The behaviour changes only for stylesheets that fail today.

- [x] Add `src/_tests_/token_grammar_tests.rs` first, and save its failure on
      the unfixed code. It must fail only for `@nest` in a style rule.
- [x] Read an `@nest` block in a style block as a style block, in `nested` and
      in `legacy_nested`.
- [x] Add a scoping test: `.p{@nest &{:local()}}` fails with the empty-wrapper
      message, and `.p{@nest &{.a{color:red}}}` scopes `a`.
- [x] Correct the doc comments of `Grammar::Style` and `nested` for `@nest`.
- [x] Run `cargo test -p mokly-css` and Clippy.

## Milestone 4: Verification, commit, review, and the first pull request

Merge notes: `.context/css-modules-scanner-follow-ups/main-sync-2026-11-01.md`.

- [x] Describe the integration test and the `test-support` feature in the
      README section Development.
- [x] Rerun the probes on the build. Save the results under
      `.context/css-modules-scanner-follow-ups/`.
- [x] Delete the follow-up items that this work resolves, and rewrite the
      open ones as complete records. Cal asked for this on 2026-11-01, in
      place of the record notes that this TODO first named.
  - Deleted: `css-module-semicolon-boundary.md` by 4 C,
    `css-differential-fixture-discovery.md` by C and 3 B, and
    `font-face-statement-doc.md` by 2 B.
  - Rewritten with every fact, the design, and the work list:
    `css-module-bare-wrapper-kind.md` for 112,
    `css-module-custom-property-rules.md` for 113, and
    `moz-document-statement-kind.md` for the `@-moz-document` change, which
    keeps the coordinator's letters A and D of item 5.
- [ ] Merge `origin/main`. Run the targeted tests and the complete gate
      `cargo xtask check --executor local`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings, then
      apply the review-fix rule: fix the `Auto-fix: yes` findings, re-review
      once, and report the rest.
- [ ] Delete this plan in the last commit before the pull request. Name it in
      the commit message. The pull request description keeps each dated
      decision and design call, with a permalink to this plan.
- [ ] Open the pull request, and send one completion message to the
      coordinator.

## Milestone 5: Statement kinds in the token check (112)

Moved on 2026-11-01 to `plans/follow-ups/css-module-bare-wrapper-kind.md`.

Second pull request. This milestone waits for Cal. Under 112 A, it has no
code: state the exception in the protocol page. Under 112 C, change the
bare-wrapper edit in `rename_selectors.rs` instead.

- [ ] Write the protocol text in `docs/protocol/mokly-imported-styles-modules.md`,
      Names.
  - A result that changes, drops, or adds a statement changes more than a
    local name. The example is a bare `:global` before an at-rule keyword.
  - When every token agrees, the failure points at the statement start.
  - Under E, a failure at a scope wrapper uses the wrapper message. Add its
    row to `docs/protocol/mokly-imported-styles-errors.md`.
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

## Milestone 6: The module check enters every block (113)

Moved on 2026-11-01 to `plans/follow-ups/css-module-custom-property-rules.md`.

Second pull request. This milestone waits for Cal. Under 113 A, it has no
code: name the exception beside the `@value` rule in the protocol page.

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

## Milestone 7: The `@-moz-document` change (item 1 D)

Moved on 2026-11-01 to `plans/follow-ups/moz-document-statement-kind.md`.

Second pull request. This milestone waits for Cal. If Cal declines, it has no
code, and the documented exception stays.

- [ ] Add the regression tests first, and save their failure on the unfixed
      code.
  - `@-moz-document url-prefix(){@-khtml-keyframes :local(k);}` scopes `k`, as
    in `@media`.
  - Under 113 B,
    `@-moz-document url-prefix(){@keyframes k{--x:{@value y: red;}}}` fails
    with the `@value` message.
- [ ] Change `rule_list` and `nested`, and `legacy_nested` in the differential
      module.
- [ ] Remove the named exception from the table test, and change the two
      `@-moz-document` rows of `blocks_open_the_grammar_that_lightningcss_parses`.
- [ ] Correct the doc comments of `Grammar::Rules`, `Grammar::Style`, `nested`,
      `Statement`, and the wrapper table's `DOCUMENT` level.
- [ ] Remove the exception from the protocol page and the crate README.
- [ ] Run `cargo test -p mokly-css` and Clippy.

## Milestone 8: Verification, commit, review, and the second pull request

Moved on 2026-11-01: each of the three follow-up items holds its own work list
and checks.

- [ ] Rerun every probe on the fixed build. Save the results under
      `.context/css-modules-scanner-follow-ups/`.
- [ ] In `plans/follow-ups/css-module-bare-wrapper-kind.md` and
      `plans/follow-ups/css-module-custom-property-rules.md`, record the
      outcomes of items 112 and 113 with their decisions, their dates, and a
      link to this plan. Use the smallest edit.
- [ ] Merge `origin/main`. Run the targeted tests and the complete gate named
      in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings, then
      apply the review-fix rule: fix the `Auto-fix: yes` findings, re-review
      once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked, or give
      its text to the coordinator. Put its link in the status paragraph.
