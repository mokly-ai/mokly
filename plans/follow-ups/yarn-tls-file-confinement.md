# Confine Yarn TLS file settings

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** Yarn configuration handling in the base dependency installer.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** security.
- **Background:** Yarn can read TLS certificate, key, and CA files named in `.yarnrc.yml`. Those paths can leave the repository.
- **Problem:** A base configuration can make the package manager read unconfined host files.
- **Impact if no action:** Base dependency installation can expose private filesystem content to Yarn.
- **Root question:** How should Mokly confine Yarn TLS file settings?
- **Options:**
  - **A.** Use tier three when a base config sets `httpsCaFilePath`, `httpsKeyFilePath`, or `httpsCertFilePath`. Effort: Small.
  - **B.** Clear those settings before the install. Effort: Small.
  - **C.** Allow only TLS files confined to the repository. Effort: Medium.
- **Left out:** Allowing arbitrary absolute paths breaks the base-input confinement rule.
- **Wider fix:** C. Path confinement preserves valid repository certificates and blocks host reads.
- **Previous examples:** The 145 B probe found all three Yarn settings.
- **Recommendation:** A. It closes the read immediately with the established fallback tier. C best preserves confined use.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6133).
