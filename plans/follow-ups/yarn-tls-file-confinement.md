# Confine Yarn TLS file settings

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 153, the probe of user decision 145 B.
- **Location:** `crates/mokly-compare/src/manager_yarnrc.rs:15`,
  `crates/mokly-compare/src/manager_plan.rs:142`, and
  `crates/mokly-compare/src/manager.rs:66`.
- **Reason:** Each option hardens base installs beyond the project's own
  install, which a decision of the base dependencies contract rejects.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Base install:** the private install of the base commit's
    dependencies that Changes runs when the base lockfile differs from the
    working tree.
  - **Dependency tier:** the source of a base side's dependencies. Tier
    three uses the working tree's dependencies with a warning.
- **Background:** A base install reads the base commit's `.yarnrc.yml`
  files. `manager_plan.rs` collects them from the root and its ancestors.
  `manager_yarnrc::validate` checks only the range settings `catalog`,
  `catalogs`, and `packageExtensions`. A user decision of 2026-10-21 made
  each install start from an allowed list of environment variables. The
  probe for that decision found that Yarn can read TLS files that
  `httpsCaFilePath`, `httpsKeyFilePath`, and `httpsCertFilePath` name.
- **Problem:** Mokly checks none of those three settings. A base
  configuration can point them at any host file, so the package manager
  reads files outside the repository.
- **Impact if no action:** A base dependency install can expose private
  host files, such as a key, to Yarn and to the registry exchange.
- **Root question:** How should a base install keep Yarn's TLS file reads
  inside the repository?
- **Options:**
  - **A.** Use tier three when a base `.yarnrc.yml` sets
    `httpsCaFilePath`, `httpsKeyFilePath`, or `httpsCertFilePath`.
    Effort: Small.
  - **B.** Clear those settings before the install. Effort: Small.
  - **C.** Allow only TLS files that `RepositoryPath::confine` keeps inside
    the repository. Effort: Medium.
- **Left out:** Allowing any absolute path breaks the base-input
  confinement rule of `docs/protocol/mokly-base-dependencies.md`.
- **Wider fix:** C. Path confinement keeps valid repository certificates
  and blocks host reads.
- **Previous examples:** None found.
- **Recommendation:** A. It closes the read at once with the existing
  fallback tier. C best keeps the confined use. The rebuild asked for a
  decision before the first npm release of the new core.
- **Action:** ask the user, because each option adds a stricter check of Yarn
  TLS settings, and `docs/protocol/mokly-base-dependencies.md:116-123` says that
  base installs add no hardening beyond the project's own install.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6133).
