# Redact literal percent signs in secrets

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 177, delta review 2.
- **Location:** `crates/mokly-publish/src/redaction.rs:85` and
  `crates/mokly-cli/src/redaction.rs:13`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **`SecretMatcher`:** the matcher in `crates/mokly-publish/src/redaction.rs`
    that finds a secret in literal text and in percent-encoded text.
  - **Redactor:** the CLI type in `crates/mokly-cli/src/redaction.rs` that
    replaces each secret with `[redacted]` before terminal output.
- **Background:** Terminal redaction of the token works as follows.
  - Publication redacts the publish token from all terminal text.
  - `Redactor::collect` takes the `MOKLY_TOKEN` value and each `--token` value
    before parsing, so a rejected value is protected too. It builds one
    `SecretMatcher` for each value.
  - `SecretMatcher::find` compares the text with the secret byte by byte. It
    reads every `%` in the text as the start of a `%HH` escape.
  - A valid token cannot contain `%`, because `Token::new` requires the
    bearer-token grammar. A malformed value can, and the redactor still
    collects it.
- **Problem:** A secret that contains `%` never matches its own literal form,
  because the matcher tries to decode the `%` in the text.
- **Impact if no action:** A mistyped token or another collected secret
  with `%` can appear unredacted in a diagnostic that quotes it.
- **Root question:** How should Mokly find every form of a secret that
  contains a percent sign?
- **Options:**
  - **A.** Also match a literal `%` byte: at each `%`, try the literal
    byte before the `%HH` escape. Add regression tests. Effort: Small.
  - **B.** Keep the matcher, and document that a publish token cannot
    contain `%`. Effort: Small.
- **Left out:** Matching only the literal form exposes encoded forms of the
  secret. Only two distinct approaches exist: match the literal form, or
  rule it out through the token grammar.
- **Wider fix:** A. Matching both forms removes the assumption that every
  `%` starts an escape.
- **Previous examples:** The redactor before the Rust rebuild matched
  literal `%` bytes.
- **Related:** [token-in-viewer-host.md](./token-in-viewer-host.md) is a
  second gap in what `SecretMatcher` and its callers recognize as the
  token. One branch can fix both in the publish crate.
- **Recommendation:** A. It restores complete matching and keeps the token
  grammar unchanged.
- **Action:** ask the user, because the user reserved the choice for each open
  review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6357).
