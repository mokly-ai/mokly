# Keep the publish token from base install scripts

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-compare/src/process.rs` and base install process ownership.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** security.
- **Background:** Base dependency scripts run as child processes. A script can read the parent environment through `/proc/{pid}/environ`.
- **Problem:** The parent environment contains `MOKLY_TOKEN`. An opted-in dependency script can read the publication secret.
- **Impact if no action:** Consumer dependency code can disclose the token during a build or publication.
- **Root question:** How should Mokly keep the publish token from base install scripts?
- **Options:**
  - **A.** Document the risk and advise `--no-base-install-scripts`. Effort: Small.
  - **B.** Keep scripts disabled when a publication token is present. Emit a warning. Effort: Small.
  - **C.** Run dependency scripts in a separate process space that cannot inspect the parent environment. Effort: Large.
- **Left out:** Passing the token to the sidecar or manager child makes the exposure worse.
- **Wider fix:** C. Process isolation removes this class for all parent secrets.
- **Previous examples:** User item 151 found the same parent-environment class as the sidecar token item.
- **Recommendation:** B. It blocks the known secret path with a small change. C best protects all parent secrets.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6118).
