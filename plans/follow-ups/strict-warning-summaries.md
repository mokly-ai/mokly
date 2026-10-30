# Align strict-mode warning summaries

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 186, with more lines from the second delta review.
- **Location:** `docs/protocol/mokly-build-warnings.md:165`,
  `crates/mokly-cli/src/grammar.rs:97`,
  `crates/mokly-cli/src/grammar.rs:123`, and `README.md:153`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Strict mode:** the `--strict` option of `build` and `publish`, which
    fails the command when it counts a build warning.
  - **`base-dependencies` warning:** the warning that a base install fell
    back to the working tree, or that governing inputs of dependency
    directories changed.
- **Background:** Strict mode and its one rule are as follows.
  - On 2026-10-23 the user decided that no `base-dependencies` warning fails
    `--strict`, and `421d604d` applied it.
  - The Strict Mode section of `docs/protocol/mokly-build-warnings.md` is the
    one home of that exception. It says that strict mode counts every producer
    except `base-dependencies`.
  - The record also named `docs/architecture/build-pipeline.md:114`. That page
    later merged into `docs/architecture/rust-core.md` without this summary.
- **Problem:** Short summaries elsewhere still say that every warning
  fails. On `main` they are at:
  - `README.md:153` and `:160`, and `docs/guides/start/build.md:52`.
  - `docs/guides/cli/check.md:16`, `docs/guides/cli/build.md:26`, and
    `docs/guides/cli/publish.md:33` and `:80`.
  - `docs/guides/cli/serve.md:70`, `docs/guides/authoring/screens.md:235`,
    and `docs/guides/cli/options-and-exit-status.md:51`.
  - `docs/protocol/mokly-upload.md:63`, `docs/protocol/README.md:19`, and
    `docs/protocol/mokly-export.md:33`, `:124`, and `:223`.
  - `docs/protocol/mokly-runtime.md:99`, `docs/protocol/mokly-package.md:86`,
    and `docs/protocol/mokly-terminal-help.md:84` and `:120`.
  - `examples/basic/specs/design/library/README.md:204`.
  - The CLI help in `grammar.rs`. The `publish` help says "Fail on every
    build warning before uploading.".
- **Impact if no action:** A user can expect a failed exit when only a
  `base-dependencies` warning exists.
- **Root question:** How should each summary of strict mode stay true to
  its one rule?
- **Options:**
  - **A.** Name the exception, or link to Strict Mode, in each summary that
    states the rule. Effort: Small (estimate).
  - **B.** Remove the rule from the summaries, and keep one linked home for
    it. Effort: Small (estimate).
- **Left out:** Changing strict behaviour is a separate product decision.
  Only two distinct approaches exist: correct each summary, or remove it.
- **Wider fix:** None. The `documentation` skill already requires one home
  for a rule and summaries that agree with it.
- **Previous examples:** None found.
- **Recommendation:** A. It keeps the useful summaries and makes each one
  true.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6438).
