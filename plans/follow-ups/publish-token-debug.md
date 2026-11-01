# Redact publish tokens from Debug output

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 181, delta review 6.
- **Location:** `crates/mokly-cli/src/grammar.rs:107`,
  `crates/mokly-cli/src/grammar.rs:116`, and
  `crates/mokly-cli/src/options.rs:19`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Publish token:** the bearer credential that `mokly publish` reads from
    `--token` or `MOKLY_TOKEN` and sends to the catalogue service.
- **Background:** The clap grammar type `Publish` in
  `crates/mokly-cli/src/grammar.rs` derives `Debug` and holds the raw
  `--token` value as an optional string. `Environment` in
  `crates/mokly-cli/src/options.rs:10-19` holds the `MOKLY_TOKEN` fallback
  as a raw string, but it derives only `Default`, so it has no `Debug`
  output. `Cli` and `Verb`, at `grammar.rs:8-31` and `:132-140`, derive
  `Debug` and contain `Publish`, so a debug print of either also prints the
  token. After validation, `mokly_publish::settings::Token` holds the token,
  and its `Debug` output is `Token([redacted])`. The review found this older
  than the change it reviewed. No current code formats `Publish` with
  `Debug`.
- **Problem:** The type permits a debug print of the raw secret. A later
  debug log, panic message, or error that formats `Publish` prints the
  token.
- **Impact if no action:** A diagnostic change can expose the publish
  token in a log.
- **Root question:** How should Mokly make every value that holds the
  publish token safe to format?
- **Options:**
  - **A.** Implement a redacting `Debug` for `Publish`. Effort: Small.
  - **B.** Use one secret type with a redacting `Debug` for every token
    field, the raw ones and the validated one. Effort: Medium.
- **Left out:** Relying on callers to avoid `Debug` keeps a raw secret in a
  printable type. Only two distinct approaches exist: redact in each type
  that holds the token, or redact in the type of the token itself.
- **Wider fix:** B. A secret type makes a raw debug print impossible for
  every caller and every later token field.
- **Previous examples:** A final review of the rebuild found that
  `SecretMatcher` derived `Debug` and printed the bearer token. Its fix in
  `035b94bb` gave it the output `SecretMatcher([redacted])`.
- **Related:** [base-script-publish-token.md](./base-script-publish-token.md)
  concerns the same publish token on another path: a base install script can
  read it from Mokly's own process environment. The code and the fix differ,
  so each item needs its own change.
- **Recommendation:** B. It protects every type that holds the token, not
  only the current CLI struct.
- **Action:** ask the user, because the user reserved the choice for each open
  review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6395).
