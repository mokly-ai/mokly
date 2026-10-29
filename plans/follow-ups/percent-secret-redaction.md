# Redact literal percent signs in secrets

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-publish/src/redaction.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** security.
- **Background:** Publication redacts secrets from receiver output. `SecretMatcher` treats each percent sign as the start of an escape sequence.
- **Problem:** The matcher does not redact the literal form of a secret that contains `%`. Valid Mokly tokens cannot contain that byte.
- **Impact if no action:** Another secret value with a percent sign can appear in diagnostics.
- **Root question:** How should Mokly redact literal percent signs in secrets?
- **Options:**
  - **A.** Match both percent-decoded and literal percent bytes. Effort: Small.
  - **B.** Keep the matcher and document that publication tokens cannot contain `%`. Effort: Small.
- **Left out:** Dropping percent-decoded matching would expose encoded secret forms.
- **Wider fix:** A. Matching both forms removes the escape assumption.
- **Previous examples:** The older redactor matched literal percent bytes.
- **Recommendation:** A. It restores complete matching without changing valid token syntax.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6357).
