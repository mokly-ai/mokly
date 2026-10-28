# Token Redaction Fixes

Status: Active. Branch `conductor/rust-rebuild-177-token-redaction` has no pull request.

Plan date: 2026-10-28.

Mokly publishes a static catalogue with a bearer token. The CLI must keep that
token out of terminal output. The optional viewer URL from Complete must also
stay safe. The Node sidecar runs consumer code, so it must not expose the
publish token to that code. Parsed CLI values must stay safe when formatted for
diagnostics.

This plan resolves user items 177, 178, 180, and 181 from the post-merge
follow-up in `plans/rust-rebuild.md`. It does not edit that coordinator plan
in this plan-only phase. The implementation ticks those four items in its
last milestone.

The saved audit and reproductions are in
`.context/token-redaction/code-audit.md` and the files it names. The audit
uses `origin/main` at `9ce7585394f36c01aa54cd2a274f2d46fd672d6b`. PR #227 did
not change any affected file.

## Scope and ownership

The publish crate owns token matching and viewer URL filtering. The CLI owns
the clap grammar and terminal redaction. The sidecar crate owns the Node
process environment. New regression tests belong in those Rust crates.

The plan does not edit `crates/mokly-compare/src/manager_environment.rs` or
the item 151 branch. That module keeps the allowlist selected by user
decision 145 B for base installs. The shared security rule is that consumer
build code and base install code cannot read `MOKLY_TOKEN`. Item 180 option A
keeps other sidecar environment variables for compatibility. It does not adopt
the base-install allowlist.

The performance hub owns Serve wiring, render reuse, stylesheet bundling, and
Git reads. This plan does not touch those files. It also does not edit the
Node test files owned by workspace 353.

There is no UI or mockup work. The recommended options add no new gate,
rejection, lint, or stricter token grammar. Item 178 option B adds a new
rejection and item 180 option B removes all non-allowlisted sidecar variables.
Both options need explicit approval.

## Decisions

The coordinator must choose one option for each item before implementation.
Silence does not select an option.

### User item 177: literal percent matching

`SecretMatcher` treats every percent byte as the start of a percent escape.
It therefore misses a literal percent in a malformed or pre-validation
credential. The token grammar rejects percent bytes, but the CLI redactor
collects malformed values before validation.

- **Severity:** Low. **Category:** security. **Effort:** Small (estimate).
- **Location:** `crates/mokly-publish/src/redaction.rs:85`.
- **Background:** The matcher protects publish completion URLs and terminal
  diagnostics. It matches literal bytes and percent-encoded bytes.
- **Problem:** A literal percent cannot match because the matcher always tries
  to decode it as `%HH`.
- **Impact if no action:** An invalid credential that contains `%` can appear
  in terminal diagnostics.
- **Options:**
  - **A.** Match a literal percent byte before trying `%HH` decoding. Keep all
    existing encoded matching. Add regression tests. Effort: Small.
  - **B.** Keep the matcher and document that tokens cannot contain `%`.
    Malformed credentials can still leak. Effort: Small.
- **Wider fix:** A. The matcher handles both literal and encoded forms at one
  shared boundary.
- **Previous examples:** None found. The current matcher came from
  `eea49480`.
- **Recommendation:** A. It protects malformed credentials without changing
  the accepted token grammar.
- **Auto-fix:** no, because the coordinator must select the option.

### User item 178: mixed-case token in viewer host

`Url::parse` lowercases DNS hosts before `completion.rs` checks the serialized
URL. A mixed-case token in the host can therefore print in lower case.

- **Severity:** Low. **Category:** security. **Effort:** Small (estimate).
- **Location:** `crates/mokly-publish/src/completion.rs:69`.
- **Background:** Publish accepts an optional viewer URL from a successful
  Complete response. It normalizes usable HTTP(S) URLs before printing them.
- **Problem:** The token matcher checks the normalized host with case-sensitive
  literal matching. DNS hosts are case-insensitive.
- **Impact if no action:** A successful publish can print a viewer URL that
  contains the token in a lower-case host.
- **Options:**
  - **A.** Match the token in the parsed host with ASCII case-insensitive
    matching, while keeping existing path, query, fragment, and encoded-byte
    checks. Add mixed-case and encoded-host tests. Effort: Small.
  - **B.** Reject a viewer URL whose host contains the token. This adds a new
    rejection to the optional Complete body and needs approval. Effort: Small.
- **Wider fix:** A. A host-aware matcher keeps URL filtering in one boundary
  and preserves successful publication.
- **Previous examples:** None found. The old redactor also had this gap.
- **Recommendation:** A. It keeps the optional body non-fatal and prevents the
  host normalization leak. Option B changes the upload contract.
- **Auto-fix:** no, because option B changes the public failure behavior.

### User item 180: token inherited by sidecars

`NodeFactory` inherits the parent environment and removes only three package
launcher variables. It does not remove `MOKLY_TOKEN`.

- **Severity:** Low. **Category:** security. **Effort:** Small (estimate).
- **Location:** `crates/mokly-sidecar/src/process_factory.rs:91-93`.
- **Background:** The sidecar runs consumer renderers, components, and
  PostCSS. Those programs inherit the sidecar environment.
- **Problem:** Consumer code can read the publish token from
  `process.env.MOKLY_TOKEN` or from a descendant process environment.
- **Impact if no action:** A consumer can copy the token into generated output,
  diagnostics, or a child process.
- **Options:**
  - **A.** Remove `MOKLY_TOKEN` from every sidecar process environment. Keep
    other inherited variables. Update the sidecar environment contract and
    add renderer, component, and PostCSS coverage. Effort: Small.
  - **B.** Start sidecars from an allowlisted environment, using the base
    install model. This protects more inherited secrets but can break consumer
    PostCSS and renderer settings that read other variables. Effort: Medium.
- **Wider fix:** B. An allowlist protects every inherited secret, but it has a
  larger compatibility impact than this item.
- **Previous examples:** User item 151 and
  `crates/mokly-compare/src/manager_environment.rs` use the base-install
  allowlist. No sidecar allowlist exists.
- **Recommendation:** A. It closes the named token path and keeps the current
  sidecar compatibility rule for other variables.
- **Auto-fix:** no, because both options change the sidecar environment
  contract and option B removes additional functionality.

### User item 181: raw token in CLI Debug

`Publish` and `Cli` derive `Debug`, and `Publish.token` stores the raw value.
No current product path formats them, but future diagnostics can do so.

- **Severity:** Low. **Category:** security. **Effort:** Large (estimate).
- **Location:** `crates/mokly-cli/src/grammar.rs:116`.
- **Background:** Clap parses the raw token before `options::validate` creates
  the validated publish settings. The grammar values can be formatted before
  validation.
- **Problem:** Derived `Debug` includes the raw token.
- **Impact if no action:** A diagnostic or test failure can expose a token.
- **Options:**
  - **A.** Implement a redacting `Debug` for `Publish`. This protects one
    command type and allows future token fields to leak. Effort: Small.
  - **B.** Add one secret value type with a redacting `Debug` implementation.
    Use it for raw CLI token fields and the validated publish token while
    keeping explicit accessors for HTTP and validation. Effort: Large.
- **Wider fix:** B. One wrapper gives every token field the same formatting
  rule.
- **Previous examples:** `SecretMatcher` and `mokly_publish::settings::Token`
  already redact their `Debug` values.
- **Recommendation:** B. It prevents the same leak in future token fields and
  keeps raw values available only through explicit accessors.
- **Auto-fix:** no, because the shared type changes two Rust crate APIs.

## Milestone 1: Documentation and contracts

Record the selected requirements before changing code. Do not start this
milestone until the coordinator answers all four items.

- [ ] Record the four selected options and their dates in this plan.
- [ ] Update `docs/protocol/mokly-upload-exchange.md` to state that a viewer
      URL with the token in a DNS host is omitted using ASCII case-insensitive
      host matching. If item 178 B is selected, record its new rejection
      instead of the omission rule.
- [ ] Keep the existing token grammar in `docs/protocol/mokly-upload.md`.
      Confirm that item 177 changes malformed-value redaction only.
- [ ] Update `docs/protocol/mokly-sidecar.md` and
      `docs/protocol/mokly-sidecar-modules.md` for the selected item 180
      environment rule. State the relationship to the base-install allowlist
      without changing the item 151 branch.
- [ ] Update the `### Key Code` or behavior paragraphs in
      `crates/mokly-publish/README.md`, `crates/mokly-sidecar/README.md`, and
      `crates/mokly-cli/README.md` when their entry-point behavior changes.
- [ ] Run the Markdown link and format checks for the changed documents.

Evidence: `.context/token-redaction/code-audit.md` and the saved probe logs.

## Milestone 2: Matcher and viewer URL filtering

Fix the publish redaction paths without changing valid token syntax or the
successful Complete status rules.

- [ ] Apply the selected item 177 matcher behavior in
      `crates/mokly-publish/src/redaction.rs`.
- [ ] Add literal-percent and malformed-percent regression cases in
      `crates/mokly-publish/src/_tests_/redaction_tests.rs`.
- [ ] Apply the selected item 178 host check in
      `crates/mokly-publish/src/completion.rs`.
- [ ] Add mixed-case and percent-encoded host cases in
      `crates/mokly-publish/src/_tests_/completion_tests.rs`.
- [ ] Preserve the existing path, query, fragment, and percent-encoding cases.
- [ ] Run `cargo test -p mokly-publish` with 100% pass rate.

## Milestone 3: Sidecar environment boundary

Prevent the publish token from reaching sidecar consumer code while preserving
the selected compatibility rule for other environment values.

- [ ] Apply the selected item 180 environment rule in
      `crates/mokly-sidecar/src/process_factory.rs` and its launch
      documentation.
- [ ] Add a Rust real-process regression test in the sidecar crate. Set
      `MOKLY_TOKEN` in the test parent and prove that a renderer, a component,
      and a PostCSS plugin cannot read it. Prove that an unrelated supported
      environment value remains available under option A.
- [ ] If option B is selected, centralize the allowlist and test its Windows
      name matching. Do not duplicate the base-install rule without recording
      the ownership boundary.
- [ ] Run `cargo test -p mokly-sidecar` and the affected Rust integration test.

## Milestone 4: Shared secret type and CLI Debug safety

Make token formatting safe before and after publish validation.

- [ ] Apply item 181 option A or B in the owning Rust crates. Keep clap value
      parsing, environment fallback precedence, and bearer-token validation
      unchanged.
- [ ] Under option B, place the shared secret wrapper in the publish redaction
      module. Use explicit accessors for `Settings`, HTTP, validation, and the
      CLI redactor. Keep `SecretMatcher` behavior separate from validation.
- [ ] Add tests that format `Publish`, `Cli`, validated `Token`, and
      `Settings` without the raw token. Keep tests for malformed-token terminal
      redaction.
- [ ] Run `cargo test -p mokly-cli` and the affected publish tests.

## Milestone 5: Verification, bookkeeping, and handoff

Prove the selected behavior, update the coordinator plan, and prepare the
implementation branch for review. The coordinator opens the pull request.

- [ ] Run `cargo fmt --all` and `npm run format:check`.
- [ ] Run `cargo xtask check --suite repository` before the long gate.
- [ ] Run the required publish and sidecar smoke commands with a test token.
      Confirm that no terminal line, viewer URL, renderer output, component
      output, PostCSS output, or Debug value contains that token.
- [ ] Run `cargo xtask check` once. Fix failures and rerun the failed suite
      before rerunning the complete gate.
- [ ] Tick user items 177, 178, 180, and 181 in `plans/rust-rebuild.md` with
      the smallest edit after their selected fixes land.
- [ ] Run the `git-commit` deletion audit. Use
      `scripts/audit-deletions.sh` when available, or its documented three
      diff commands when the repository does not provide the script. Then
      commit with a Conventional Commits message. Push only this branch.
- [ ] After the push, run the `implementation-review` validity check against
      `origin/main`. Apply only confirmed `Auto-fix: yes` findings, rerun the
      required checks, commit, push, and re-review once.
      Open review items: 177, literal percent matching, Low, Small, A;
      178, mixed-case viewer host matching, Low, Small, A; 180, sidecar token
      environment, Low, Small, A; 181, shared secret type, Low, Large, B.
- [ ] The coordinator opens the implementation pull request after all earlier
      tasks and decisions are complete. Do not open it in this workspace.

## Open review items

- User item 177. Severity Low. Effort Small. Recommended: A, match literal
  percent bytes.
- User item 178. Severity Low. Effort Small. Recommended: A, match the token
  in DNS hosts without regard to ASCII case.
- User item 180. Severity Low. Effort Small. Recommended: A, remove only
  `MOKLY_TOKEN` from sidecars.
- User item 181. Severity Low. Effort Large. Recommended: B, share one
  redacting secret type.
