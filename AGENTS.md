# A guide for agents

This file holds the rules that apply in every session. Detailed procedures
live under [`docs/dev`](./docs/dev). Each entry below says what the doc covers
and when to read it. Read the doc at that point instead of guessing the rule.

## Detailed rule docs

- [Review](./docs/dev/review.md): the post-push implementation review. It
  holds the review-fix rule, the flaky-test rule, the `Auto-fix: yes` and
  `Auto-fix: no` conditions, effort grades, the numbered finding format, the fix-round
  limit, and how to report fixed and open findings. Read it after you push,
  before you run or apply a review.
- [Plans](./docs/dev/plans.md): plan files under `plans/`. It holds the
  status paragraph, milestone and TODO rules, `ui` and `mockup` tags, the
  PR-merge completion boundary, post-merge follow-up sections, and where
  evidence logs go. Read it before you create, edit, or tick a plan.
- [Documentation](./docs/dev/documentation.md): README structure, Rust crate
  README sections, rules for `docs/`, protocol docs, and mockups including
  screen components and user flows. Read it before you edit a README, a doc,
  a protocol doc, or a mockup.
- [Rust](./docs/dev/rust.md): the full Rust conventions with examples. It
  holds crate layout, traits and `dyn` dispatch, file size limits, imports,
  test layout, visibility and modules, explicit drops, typing, panics,
  unsafe code, and the error-handling contract. Read it before you edit Rust
  under `xtask/` or any crate.
- [Databases](./docs/dev/databases.md): query separation, migration naming
  and freezing, the migration lock, and `*-store-pg` crate boundaries. Read
  it before you touch migrations, Diesel, or store crates.
- [Git](./docs/dev/git.md): Conventional Commits, title limits, commit
  examples, and the mainline feature preservation procedure with its merge
  audit commands. Read it before you commit, merge, rebase, or open a PR.
- [Product UI](./docs/dev/product-ui.md): where screens live, component
  reuse, forbidden visual patterns, environment labels, real data, and
  user-facing copy. Read it before you implement or change a user-facing
  screen or copy.

## General

- When adding new packages or services, always attempt to build them to check for errors
- Everything must be fully tested
- During development, run only tests that cover the change. Require a 100% pass
  rate. Follow the commands and rebuild rules in
  [developer test commands](./docs/protocol/developer-test-commands.md).
- Tests must not assert elapsed wall-clock time. Use operation counts, captured inputs, event order or fake-clock time.
  Follow [CI Test Timing](./docs/protocol/ci-test-timing.md).
- Run `cargo xtask check --suite repository` early. Leave complete unit and
  browser suite runs to the complete gate.
- Run the complete `cargo xtask check` once before saying work is complete.
  A local run stops at the first failed suite. A remote run reports every
  failed suite. After a failure, fix it. Rerun only the
  failing tests or the failed repository or package suite. Then rerun the
  complete gate. If it cannot run, explain the blocker and the checks already run.
  If a test that the diff does not touch fails and then passes on the rerun,
  it is an unrelated flaky test. Do not fix it in this branch. Report it under
  the flaky-test rule in [`docs/dev/review.md`](./docs/dev/review.md).
- After tests and `cargo xtask check` pass, run `git add -A`, commit the
  completed work using Conventional Commits, and push the branch; newly created
  files must be tracked and included in the commit, push, and review diff
- After the push, review the complete local diff against `origin/main` with
  [`docs/implementation-review-prompt.md`](./docs/implementation-review-prompt.md),
  then apply the review-fix rule in [`docs/dev/review.md`](./docs/dev/review.md):
  fix only the findings tagged `Auto-fix: yes`, re-review once, and report
  the rest. The review itself stays read-only
- A flaky test that the diff adds or changes may be fixed without asking only
  under the flaky-test rule in [`docs/dev/review.md`](./docs/dev/review.md):
  reproduce the flake, name the nondeterminism source, make the test
  deterministic, keep every assertion, and add no retry, sleep, repeat, skip,
  quarantine, or longer time limit. Do not fix a flaky test that the diff does
  not touch;
  report it with its name, failure text, rerun outcome, and suspected source.
  Slow, custom, or low-value tests, gates, lints, and checks stay
  `Auto-fix: no`; ask the user whether to fix or remove each one, and state
  what it protects and how long it runs
- Keep review reports, verification evidence, measurements, and other scratch
  output under the git-ignored `.context/` directory. Do not create review
  records or evidence files in the repository
- Write agent responses to the user, including summaries, plans, and review
  output, in Simplified Technical English (STE, ASD-STE100): short sentences,
  one instruction per sentence, active voice, and simple, consistent words
- Documentation-only or plan-only changes, including initial plan creation, do not require `cargo xtask check`; validate the changed Markdown and review the diff instead
- This project is not currently in production/live, so breaking changes are
  acceptable when they improve correctness, architecture, or product quality
- Prefer graceful handling. When input is recoverable, warn and continue; fail
  only when the output would be wrong or unsafe. Do not add a new build error,
  rejection, gate, or stricter validation without asking the user
- Read the README.md for the relevant section of code you are working on, and
  update it with any new useful context. Keep every README.md up to date with
  the code you change, and follow
  [`docs/dev/documentation.md`](./docs/dev/documentation.md) for the required
  structure
- Docs under `docs/`, protocol docs, and mockups are part of the spec. Keep
  them aligned with the implementation in the same change, and follow
  [`docs/dev/documentation.md`](./docs/dev/documentation.md)
- Plans live under `plans/`. Create one only with the user's consent and
  follow [`docs/dev/plans.md`](./docs/dev/plans.md). Tick TODOs as you
  complete them, and add any TODO you discover under the relevant milestone
- If you get compile errors, keep working to fix them until you no longer have errors
- If you get a command error, like invalid parameter error, don't give up immediately, try at least once again
- Keep files short - around 300 lines is an ideal length, split up the file if
  longer. The repository gate caps changed TypeScript/JavaScript at 300 lines
  and protocol Markdown at 250 lines
- Take as long as you need
- Be careful; think carefully about the best impl
- Use best practises
- Code quality is important
- Keep this file limited to general repo-wide rules that apply in every
  session. Put detailed procedures under `docs/dev` and list them above.
  Application-specific, crate-specific, or feature-specific rules should live
  in the relevant README.md, docs, or protocol files near the code they
  describe.
- Whenever adding new features, run smoke tests (i.e. start the server, try commands, etc)
- Whenever you find bugs like this ensure you add a test first to capture the failure, and then fix it
- Data displayed to the user must never be faked, stubbed, hardcoded, or
  mocked in product code; render an explicit empty, loading, or error state
  until the real source is wired. User-facing copy must read as product
  language, never as engineer-facing build or status output. Follow
  [`docs/dev/product-ui.md`](./docs/dev/product-ui.md) for UI and copy work

## Rust

The full conventions with examples are in [`docs/dev/rust.md`](./docs/dev/rust.md).
These rules apply to every Rust edit:

- Use a workspace with multiple crates to split up the code into concrete units; every crate has its own README.md
- Run `cargo fmt --all -- --check` after Rust changes; if it fails, run `cargo fmt --all` and re-run the check. Run `cargo clippy` after making any changes
- Add **external** dependencies with `cargo add` without a version; add **workspace internal crates** manually with `dependency = { workspace = true }`
- Model all non-pure behavior behind traits and consume it through `dyn Trait`, with `Arc<dyn Trait + Send + Sync>` for shared runtime dependencies. Prefer `dyn` dispatch over parametric generics. Only small pure free functions and pure value types are exempt
- Use `unimock` to mock trait boundaries in unit tests, including same-crate traits with one implementation; unit tests must not use real disk IO, databases, Docker, subprocesses, clocks, or network calls
- Use `tracing` for diagnostics in libraries, servers, and workers; never `println!`, `eprintln!`, or `dbg!` there. Direct terminal output is only for CLI results, prompts, raw data output, REPL messages, build-script directives, tests, examples, and `xtask` output
- Every Rust module has a module-level doc comment and every public item has a doc comment; avoid inline comments
- Rust files under `crates/` and `xtask/` have a 300-line hard cap enforced by `cargo xtask rust-file-length-lint`; target 200 lines, split into modules, and never use `include!` to get around it
- Order imports std, external crates, `crate::`, then `self::`/`super::`. Declare them at the top of the file, never rename with `as`, and prefer imports over inline `crate::` paths
- Keep tests out of production files. Put them in a `_tests_` directory beside the source and declare them with `#[cfg(test)] #[path = "_tests_/<name>_tests.rs"]`. Use file-based `insta` snapshots only
- Use the narrowest visibility that works, keep `lib.rs`, `mod.rs`, and `bin.rs` as thin module roots, use `#[path]` only for test modules, and use `#[expect(dead_code, reason = "...")]` rather than a silent `allow`
- Do not call `drop` unless absolutely necessary; end a borrow with a scope instead
- Prefer enums and structs over raw strings and `serde_json::Value`; fully type domain, service, and interface code
- **NEVER** use `panic!()`, `unwrap()`, or `expect()` in production code; test code may use them
- Avoid `unsafe` except for FFI, keep it minimal, and add a safety comment
- Define errors as `thiserror` enums per crate or module with `[crate/mod]` message prefixes, typed variants that callers branch on, and `Internal(#[from] InternalError)` as the fallback. Propagate with `?`. Never use `anyhow`, `eyre`, `#[error(transparent)]`, `Other(String)`, string matching on errors, or `map_err` in production code

## Git

The full rules, commit examples, and the mainline preservation procedure are in
[`docs/dev/git.md`](./docs/dev/git.md). These rules apply to every commit:

- Use the **Conventional Commits** format for every commit message and pull request title. Commit titles use at most 50 characters; pull request titles and their squash commit titles use at most 72 Unicode code points. A commit may hold multiple entries separated by blank lines, ordered by type priority
- Do not delete or override anything already on `origin/main`, including code, APIs, tests, docs, mockups, plans, migrations, and schema, without explicit user approval
- Before you merge or rebase, and before and after you commit, run the mainline preservation audit in [`docs/dev/git.md`](./docs/dev/git.md); resolve conflicts path-by-path, and verify the worktree before saying a merge is complete
- When a change removes or renames a feature, test, fixture, scenario, command,
  or file, search the active plans, `docs/`, and every `README.md` for its name
  and update each stale reference in the same change, and record each plan
  edit in the commit or PR description. Leave completed plans unchanged; they
  record history

## Bash Tool Timeout Configuration

**CRITICAL**: Claude Code's environment variable timeout configuration has known issues. Every Bash **tool call** (not command) MUST include an explicit `timeout` parameter in milliseconds:

- **Default commands**: 600000ms (10 minutes)
- **Long operations** (cargo check, yarn install): 900000ms (15 minutes)
- **Very long operations** (full workspace builds): 1800000ms (30 minutes)

If a command times out but shows progress, retry it. Monitor command output for progress indicators before you retry, and use longer timeouts for workspace operations.
