# Align strict-mode warning summaries

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 186 (docs): short summaries still say that
`--strict` makes warnings fail, but `base-dependencies` no longer
counts (183 C). The exception is stated once, in
`mokly-build-warnings.md` Strict Mode. The summaries:
`README.md:155` and `:161`, `docs/guides/start/build.md:52`,
`docs/guides/cli/check.md:16`, `docs/guides/cli/build.md:26`,
`docs/guides/cli/publish.md:33` and `:79`,
`docs/guides/cli/serve.md:66`, `docs/guides/authoring/screens.md:216`,
`docs/protocol/mokly-upload.md:58`,
`docs/architecture/build-pipeline.md:114` (page merged into
`docs/architecture/rust-core.md` on 2026-10-26 without this summary), and
`examples/basic/specs/design/library/README.md:192`. The second delta
review found more: `docs/guides/cli/options-and-exit-status.md:51`,
`docs/protocol/README.md:19`, `docs/protocol/mokly-export.md:37`,
`:129`, and `:235`, `docs/protocol/mokly-runtime.md:91`,
`docs/protocol/mokly-package.md:88`,
`docs/protocol/mokly-terminal-help.md:90`, and the CLI help in
`crates/mokly-cli/src/grammar.rs:97` and `:123` (the `publish` help
says "Fail on every build warning before uploading."). Severity Low,
docs, effort not recorded. Options (estimate): A, name the exception
or link to Strict Mode in each summary that states the rule; B, keep
one home for the exception. Recommended: A.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6438).
