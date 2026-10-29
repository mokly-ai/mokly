# Redact publish tokens from Debug output

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-cli/src/grammar.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** security.
- **Background:** The CLI `Publish` argument type derives `Debug` and stores the raw `--token` value. Current code does not format that value.
- **Problem:** A future debug log or error can print the secret because the type permits it.
- **Impact if no action:** A diagnostic change can expose the publication token.
- **Root question:** How should Mokly redact publish tokens from Debug output?
- **Options:**
  - **A.** Implement a redacting `Debug` for `Publish`. Effort: Small.
  - **B.** Use one secret type with redacting `Debug` for every token field. Effort: Medium.
- **Left out:** Relying on callers to avoid `Debug` keeps the unsafe representation.
- **Wider fix:** B. A secret type makes raw debug output unavailable to every caller.
- **Previous examples:** Delta review 6 found the raw field. The HTTP redactor already protects receiver text.
- **Recommendation:** B. It protects all token-bearing types, not only the current CLI struct.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6395).
