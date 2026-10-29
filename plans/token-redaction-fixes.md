# Token Redaction Fixes

Status: Active. On branch `conductor/rust-rebuild-177-token-redaction`, no
pull request yet. The plan closes when its PR merges.

Plan date: 2026-10-28.

Mokly publishes a static catalogue with a bearer token. The CLI must keep that
token out of terminal output. The optional viewer URL from Complete must also
stay safe. The Node sidecar runs consumer code, so it must not pass the publish
token to that code. Parsed CLI values must stay safe when formatted for
diagnostics.

This plan resolves user items 177, 178, 180, and 181 from the post-merge
follow-up in `plans/rust-rebuild.md`. Its last milestone ticks those four items
in that coordinator plan. The plan makes no other edit there.

The saved audit and reproductions are in `.context/token-redaction-fixes/`.
`code-audit.md` records the audit at `origin/main`
`9ce7585394f36c01aa54cd2a274f2d46fd672d6b`. PR #227 did not change any
affected file. `probe-publish-main.log` and `probe-cli-main.log` show the
matcher, host, terminal, and `Debug` leaks. The `e2e-*-main.log` files show the
token in consumer environments and in a printed viewer URL. The probes are in
the `probes/` and `e2e/` directories there.

Contract owners:

- [Catalogue upload](../docs/protocol/mokly-upload.md): the token exposure
  rules.
- [Upload exchange](../docs/protocol/mokly-upload-exchange.md): the viewer URL
  rule.
- [CLI terminal output](../docs/protocol/mokly-terminal-output.md): the viewer
  URL line.
- [Render sidecar](../docs/protocol/mokly-sidecar.md): the sidecar security
  rule.
- [Sidecar module sources](../docs/protocol/mokly-sidecar-modules.md): the
  source worker environment.
- The [mokly-publish README](../crates/mokly-publish/README.md), the
  [mokly-sidecar README](../crates/mokly-sidecar/README.md), and the
  [mokly-cli README](../crates/mokly-cli/README.md).
- The [project tokens guide](../docs/guides/ci/project-tokens.md).

## Scope and ownership

The publish crate owns token matching and viewer URL filtering. The CLI owns
the clap grammar and terminal redaction. The sidecar crate owns the Node
process environment. New regression tests belong in those Rust crates.

The plan does not edit `crates/mokly-compare/src/manager_environment.rs` or
the item 151 branch. That module keeps the allowed list of decision 145 B for
base installs. The shared rule below covers both changes.

The performance hub owns Serve wiring, render reuse, stylesheet bundling, and
Git reads. This plan does not touch those files. It renames one variable in
each of three Node tests that workspace 353 ports to Rust. The design section
"Test variables" names them.

There is no UI or mockup work. The chosen options add no new gate, rejection,
lint, or stricter token grammar.

## Decisions

The coordinator answered all four items on 2026-10-28.

Decision 177 (2026-10-28): A. The matcher matches a literal `%` before it
tries a `%HH` escape, with tests. Rejected: B, document that a token cannot
contain `%`, because the CLI redactor collects `--token` and `MOKLY_TOKEN`
before it checks the grammar. A malformed value with `%` therefore printed in
full. Reason: A protects malformed values and keeps the token grammar.

Decision 178 (2026-10-28): A. The viewer URL check matches the parsed host
without regard to ASCII case, with mixed-case and encoded-host tests.
Rejected: B, reject such a viewer URL as a failure, because publication
success never depends on the optional Complete body. Reason: A closes the leak
through host normalization and keeps the body optional.

Decision 180 (2026-10-28): A, widened. The coordinator widened A from "remove
`MOKLY_TOKEN` only" to "remove every inherited `MOKLY_` variable, then set
Mokly's own names". Every other variable stays. Rejected: B, an allowed list
as for base installs, because consumer PostCSS settings and render code read
other variables. Reason: sidecars get the same prefix rule that decision 145 B
gives package managers. Consumer code then no longer receives any inherited
`MOKLY_` variable. The coordinator approved that removal with this decision.

Decision 181 (2026-10-28): B. One redacting secret type holds the raw and the
validated token fields. Rejected: A, a redacting `Debug` for `Publish` only,
because a later token field could leak again. Reason: every token field gets
the same formatting rule. The coordinator's reviewer grades B Medium, not
Large.

The orchestrator raised four follow-up decisions. The coordinator answered them
on 2026-10-28.

Follow-up decision 1 (2026-10-28): A. Restart the brief of Milestones 2 to 4
on the same model and effort. Stop that part if it fails again with a 429 or a
usage limit. Result: the orchestrator restarted it on 2026-10-28. The session
failed again with five stream resets and then `429 Too Many Requests`,
"exceeded retry limit". The orchestrator cancelled it. Three sessions on
`gpt-6.1-sol` failed this way on 2026-10-28. They changed no file. Milestones 2
to 4 are therefore blocked. The brief
`.context/token-redaction-fixes/briefs/rust-1.md` is ready to run again.
Rejected: B, another Codex model, because the user's rule names `gpt-6.1-sol`.

Follow-up decision 2 (2026-10-28): A, refined. Workspace 353 renames the three
variables to the `FIXTURE_` names in its ports now:
`crates/mokly-cli/tests/sidecar_rendering/postcss_reads_tests.rs` and
`postcss_inputs_tests.rs`. The `FIXTURE_` names reach PostCSS before and after
decision 180, so this branch does not edit those ports. This branch renames the
variables in the three Node tests as planned. If 353 merges first, the merge of
`main` keeps 353's deletion of those Node tests. Then
`cargo test -p mokly-cli --test sidecar_rendering_tests` runs on the merged
tree. Rejected: B, keep `MOKLY_TEST_` variables in the sidecar environment,
because it weakens decision 180.

Follow-up decision 3 (2026-10-28): A. Git commands and the Serve browser opener
stay outside the rule, because they run the user's own tools. One sentence in
the token exposure section states the exception. Rejected: B, remove inherited
`MOKLY_` variables from Git children and the opener. B changes the rule of
`docs/protocol/mokly-git.md`, section `## Child Environment`, that other
environment values stay inherited, so it needs the user's decision.

Follow-up decision 4 (2026-10-28): C, a new option. The one of workspaces 406
and 407 that merges second leaves one home for the same-user limit,
`docs/protocol/mokly-upload.md#token-exposure`. It also leaves one copy of the
user advice in the guides. Workspace 407 is this one. Workspace 406 already
states the limit in `docs/protocol/mokly-base-install-processes.md#environment`.
It states the user advice in the "Keep the token safe" section of
`docs/guides/cli/publish.md`. Neither page is on `main` yet. If this branch
merges second, its merge of `main` does three things:

- It replaces the limit sentence of 406 with a link to the token exposure
  section.
- It points the two base-install links in `mokly-upload.md` and
  `mokly-sidecar-modules.md` at `mokly-base-install-processes.md#environment`.
- It keeps one copy of the advice. It drops the planned copy in
  `docs/guides/ci/project-tokens.md`, or links to the first copy.

Rejected: A, 406 links to this branch, and B, 406 copies these words, because
neither branch can link to a page that is not on `main` yet. Reason: only the
branch that merges second sees both pages on `main`.

Retry instruction (2026-10-28), after follow-up decision 1: restart the same
brief on `gpt-6.1-sol` every 30 minutes, at most four more times, with no
other model. Result: tries 4 and 5, at 22:33 and 23:03 UTC, failed with the
same 429. Try 6 started at 23:33 UTC and ran. As Codex session `fc013a21`, it
finished Milestones 2 to 4 on 2026-10-29. Rejected: another model, for the
reason of follow-up decision 1.

## Shared rule with item 151

The coordinator set one rule for this plan and for item 151 of workspace 406.
Item 151 changes base installs. Mokly passes no inherited `MOKLY_` variable to
package managers and their lifecycle scripts, under decision 145 B, which is
already in force. Mokly passes no inherited `MOKLY_` variable to sidecars and
their PostCSS children, under decision 180.

Mokly cannot stop code that runs as the same user from reading the environment
of Mokly itself, or of the shell and launcher that started it. Such code can
read it through `/proc/{pid}/environ`, `ps -E`, or the Windows process
environment block. The protocol text therefore says that such code "does not
receive" the token. It never says that such code "cannot read" the token, and
it states the limit. It advises `MOKLY_TOKEN` over `--token`, because
`/proc/{pid}/cmdline` shows the arguments to every user.

The words of the rule and its limit have one home:
[token exposure](../docs/protocol/mokly-upload.md#token-exposure). Under
follow-up decision 4, the one of workspaces 406 and 407 that merges second
leaves that section as the only home of the limit. It also leaves one copy of
the user advice in the guides.

Boundary: Git commands and the Serve browser opener are child processes that
run the user's own tools, not project code. They still inherit `MOKLY_`
variables. Under follow-up decision 3, they stay outside the rule, and the
token exposure section states the exception. This plan does not change them.

## Design

### Matcher (177)

- Each byte of a secret matches the same input byte, or a `%HH` escape in
  either hex case that decodes to it.
- An input `%` matches a literal `%` in the secret first. It can also start a
  `%HH` escape.
- The matcher follows both readings together, as a set of input positions for
  each secret position. No reading needs backtracking.
- When both readings match from one start, the longer match wins. From one
  start, the reading of the matcher on `main`, which reads every `%` as an
  escape, always gives the longest match.
- A secret without `%`, which includes every valid token, therefore keeps the
  exact match spans of `main`. A literal `%` now matches too.
- For a secret with `%`, a literal match can start before the match that
  `main` finds. The leftmost match wins, as on `main`.
- The work stays linear in the text length for a secret without `%`. It uses
  no recursion and allocates no buffer for each start position.

### Viewer host (178)

- `SecretMatcher::contains_url` stays the one URL check.
- It keeps the check of the serialized URL. It adds a check of the parsed host
  without regard to ASCII case.
- The parser already decodes `%HH` in a host and maps it to lower case. The
  encoded and mixed-case forms therefore reach the same host check.
- Terminal redaction keeps exact matching.

### Sidecar environment (180)

- A pure function builds the sidecar command environment from the inherited
  variable names.
- It removes every inherited name that starts with `MOKLY_`, matched without
  case on Windows only. It also removes `INIT_CWD`, `npm_package_json`, and
  `npm_config_local_prefix`.
- Then it sets `PWD` and Mokly's own `MOKLY_POSTCSS_PHASES=1`.
- PostCSS children inherit that environment.
- Every other variable stays.
- The rule has the same effect as decision 145 B for package managers. It is a
  removal rule, not an allowed list.

### Test variables (180)

Three Node tests on `main` pass a `MOKLY_TEST_` variable to consumer PostCSS
code. The new rule removes these variables, so the tests rename them:

- `tests/static_postcss_ranges.test.ts`: `MOKLY_TEST_RANGE_EDIT` becomes
  `FIXTURE_RANGE_EDIT`.
- `tests/static_postcss_identity.test.ts`: `MOKLY_TEST_RETARGET` becomes
  `FIXTURE_RETARGET`.
- `tests/static_postcss_base_evidence.test.ts`: `MOKLY_TEST_POSTCSS_BASE_EDIT`
  becomes `FIXTURE_POSTCSS_BASE_EDIT`.
- The test logic and every assertion stay.
- Workspace 353 ports these three tests to Rust on its branch with the old
  names. Under follow-up decision 2, it renames them to the same `FIXTURE_`
  names in its ports. This branch does not edit those ports.

### Secret type (181)

- `mokly_publish::redaction::Secret` holds a credential value as supplied,
  valid or not.
- Its `Debug` prints `Secret([redacted])`.
- It has no `Display`, `Deref`, `AsRef`, or serde support.
- Only `expose()` returns the value, for validation, matching, and the HTTP
  header.
- `Token` wraps a `Secret` after the grammar check. `SecretMatcher` holds a
  `Secret`.
- `Publish.token` in `crates/mokly-cli/src/grammar.rs` and `Environment.token`
  in `crates/mokly-cli/src/options.rs` hold `Option<Secret>`.
- The CLI grammar check calls `Token::new`, so the bearer-token grammar has
  one implementation.
- Clap parsing, the help text, environment precedence, and the error codes do
  not change.

### Orchestrator's design calls (2026-10-29)

The orchestrator made these calls when it reviewed Milestones 2 to 4. They
are its own calls, not decisions of the coordinator.

- Sidecar environment: the removal predicate runs in unit tests with both host
  rules. Reason: CI runs the tests on Windows, where `Command` treats names
  without case.
- Sidecar environment: the three npm launcher names are removed
  unconditionally, as before. The predicate also matches them without case on
  Windows. Reason: the removal of `main` stays, and Windows treats names
  without case.
- Real-process test: the parent asserts that the child reports `1 passed`.
  Reason: a test filter that matches no test then cannot pass.
- Viewer host: the host cases run through `Completion::parse`, the real viewer
  path, not through a direct `contains_url` test. Reason: the tests then cover
  the path that prints the URL.
- Token exposure wording, from pass 2a: the exception sentence says "still
  receive inherited `MOKLY_` variables" and names the `o` key. Reason: Git
  commands do not keep the whole environment, and the `o` key starts the same
  browser opener as `--open`.

## Milestone 1: Documentation and protocol

Write the dated decisions and the design into this plan. Write the
requirements and the decisions in force into the protocol docs. A page whose
own text the code does not implement yet gets a status line. Milestone 5
removes these lines.

- [x] Record the four dated decisions, the shared rule, and the design in this
      plan.
- [x] Add the `Token Exposure` section to `docs/protocol/mokly-upload.md`: the
      redaction rule, decision 177, the process rule, and its limit.
- [x] Add the exception of follow-up decision 3 to that section: Git commands
      and the Serve browser opener still receive inherited `MOKLY_` variables.
- [x] State the viewer URL rule and decision 178 in
      `docs/protocol/mokly-upload-exchange.md`.
- [x] Link the viewer URL line of `docs/protocol/mokly-terminal-output.md` to
      the viewer URL rule.
- [x] State the source worker environment and decision 180 in
      `docs/protocol/mokly-sidecar-modules.md`.
- [x] State the sidecar environment exception in the security section of
      `docs/protocol/mokly-sidecar.md`.
- [x] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

Evidence: `.context/token-redaction-fixes/docs-1/`, with the matcher check
and the Markdown check logs.

Evidence for the exception sentence: `.context/token-redaction-fixes/docs-2a/`.

## Milestone 2: Matcher and viewer host (177, 178)

Redact a literal `%`, and omit a viewer URL whose host holds the token in any
ASCII case. Valid token syntax and the Complete status rules do not change.

Blocked on 2026-10-28: three Codex sessions on `gpt-6.1-sol` failed with
`429 Too Many Requests`. The brief
`.context/token-redaction-fixes/briefs/rust-1.md` is ready to run again.

On 2026-10-29 the sixth try, Codex session `fc013a21`, ran and finished
Milestones 2 to 4.

- [x] Add tests that fail first in
      `crates/mokly-publish/src/_tests_/redaction_tests.rs`. Cover literal and
      malformed `%` values, and both readings from one start.
- [x] Add mixed-case and percent-encoded host cases that fail first in
      `crates/mokly-publish/src/_tests_/completion_tests.rs`. Keep the path,
      query, fragment, and percent-encoding cases.
- [x] Add a malformed `%` value case that fails first in
      `crates/mokly-cli/src/_tests_/redaction_tests.rs`, for `--token` and
      `MOKLY_TOKEN`.
- [x] Implement the matcher of the design in
      `crates/mokly-publish/src/redaction.rs`.
- [x] Add the host check to `SecretMatcher::contains_url`.
- [x] Run `cargo test -p mokly-publish` and
      `cargo test -p mokly-cli redaction`.

Evidence: `.context/token-redaction-fixes/m2-tests-before.log` and
`m2-tests-after.log`.

## Milestone 3: Sidecar environment (180)

Sidecars and their PostCSS children get no inherited `MOKLY_` variable. They
keep every other variable and see Mokly's own names.

- [x] Add a unit test that fails first for the pure environment function. Use
      captured `Command::get_envs()` values. Cover the Windows case rule.
- [x] Add a real-process test in `crates/mokly-sidecar/tests/`. It starts the
      test binary again with `MOKLY_TOKEN`, `MOKLY_ENDPOINT`, a spoofed
      `MOKLY_POSTCSS_PHASES`, and a plain variable.
  - [x] Prove that a renderer, a component, and a PostCSS plugin do not
        receive the `MOKLY_` values.
  - [x] Prove that they keep the plain variable and see
        `MOKLY_POSTCSS_PHASES=1`.
- [x] Implement the pure function and use it in the sidecar process factory.
- [x] Rename the three test variables of the design in the Node tests.
  - Workspace 353 renames the same variables in its Rust ports, so this
    branch does not edit those ports.
- [x] Run `npm run build`, then `cargo test -p mokly-sidecar` and the three
      Node tests.

Evidence: `.context/token-redaction-fixes/m3-tests-before.log`,
`m3-node-before-rename.log`, `m3-tests-after.log`, and
`m3-changes-tests.log`.

## Milestone 4: Secret type (181)

One redacting secret type holds every token value, before and after the
grammar check.

- [x] Add tests that fail first for `Debug` of `Cli`, `Publish`, `Secret`,
      `Token`, `Settings`, and `SecretMatcher`. No output holds the token.
- [x] Add `Secret` to `mokly_publish::redaction`. Use it in `Token`,
      `SecretMatcher`, `Publish.token`, and `Environment.token`.
- [x] Make the CLI grammar check call `Token::new`.
- [x] Keep clap parsing, the help text, environment precedence, the error
      codes, and the malformed-token terminal redaction tests.
- [x] Run `cargo test -p mokly-publish` and `cargo test -p mokly-cli`.

Evidence: `.context/token-redaction-fixes/m4-tests-before.log`,
`m4-tests-after.log`, `repository-check.log`, and
`orchestrator-crate-tests.log`.

## Milestone 5: READMEs, guide, and status lines

The READMEs and the guide describe the implemented behaviour. The protocol
pages lose their status lines.

- [x] Update the behaviour paragraphs and `### Key Code` of the
      `crates/mokly-publish`, `crates/mokly-sidecar`, and `crates/mokly-cli`
      READMEs.
- [x] Update `docs/guides/ci/project-tokens.md` in user words, under
      follow-up decision 4:
  - [x] The processes that render the catalogue do not receive the token.
  - [x] When `main` has no copy of the user advice yet, write it here. Code
        that runs as the same user can still read the environment of Mokly
        and of the shell that started it. Prefer `MOKLY_TOKEN`, because every
        user can see a command line.
  - [x] When `main` has the "Keep the token safe" section of workspace 406 in
        `docs/guides/cli/publish.md`, link to that section instead.
    - Not needed: `main` had no such section on 2026-10-29.
- [x] Remove the status lines that Milestone 1 adds to
      `docs/protocol/mokly-upload.md`, `mokly-upload-exchange.md`,
      `mokly-sidecar.md`, and `mokly-sidecar-modules.md`.
- [x] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

Evidence: `.context/token-redaction-fixes/docs-3/`, with the Markdown and
guide check logs.

## Milestone 6: Verification, commit, review, and handoff

Prove the behaviour on the final branch, tick the coordinator items, and hand
the branch to the coordinator.

- [ ] Merge `origin/main` under the `git-merge` skill.
  - [ ] When workspace 353 merged first, keep its deletion of the three Node
        tests. Run `cargo test -p mokly-cli --test sidecar_rendering_tests` on
        the merged tree.
  - [ ] When workspace 406 merged first, replace its limit sentence in
        `docs/protocol/mokly-base-install-processes.md#environment` with a
        link to the token exposure section.
  - [ ] When workspace 406 merged first, point the two base-install links in
        `docs/protocol/mokly-upload.md` and
        `docs/protocol/mokly-sidecar-modules.md` at
        `mokly-base-install-processes.md#environment`.
  - [ ] When workspace 406 merged first, keep one copy of the user advice in
        the guides. Drop the planned copy in
        `docs/guides/ci/project-tokens.md`, or link to the first copy.
- [ ] Smoke test: rerun the saved probes of
      `.context/token-redaction-fixes/probes/` and `e2e/` on the branch build.
      Confirm that no terminal line, viewer URL, renderer output, component
      output, PostCSS output, or `Debug` value holds the test token.
- [ ] Run `cargo xtask check --suite repository`.
- [ ] Run the complete gate `cargo xtask check` once on the final commit.
- [x] Tick user items 177, 178, 180, and 181 in `plans/rust-rebuild.md` with
      the smallest edit.
- [ ] Run the deletion audit of the `git-commit` skill. Commit and push this
      branch.
- [ ] Review the diff against `origin/main` with the `implementation-review`
      skill after the push. Apply its review-fix rule: fix the
      `Auto-fix: yes` findings, re-review once, and report the rest.
- [ ] Handoff: the coordinator opens the pull request. Then put its link in
      the status paragraph.
