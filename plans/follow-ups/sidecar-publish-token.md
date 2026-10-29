# Remove the publish token from the sidecar environment

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-sidecar/src/process_factory.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** security.
- **Background:** The JavaScript sidecar inherits Mokly's environment. Consumer renderer and PostCSS code can inspect that environment.
- **Problem:** The child receives `MOKLY_TOKEN`, even though rendering does not need the publication secret.
- **Impact if no action:** Consumer code from the working or base source can disclose the token.
- **Root question:** How should Mokly remove the publish token from the sidecar environment?
- **Options:**
  - **A.** Remove `MOKLY_TOKEN` from the sidecar environment. Effort: Small.
  - **B.** Start sidecars from an explicit allowed environment list. Effort: Medium.
- **Left out:** Clearing all environment variables can break legitimate consumer PostCSS settings.
- **Wider fix:** B. An allowed list protects every inherited secret class.
- **Previous examples:** User item 151 found the related parent-process exposure for install scripts.
- **Recommendation:** A. It removes the known unused secret. B best protects all inherited secrets.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6384).
