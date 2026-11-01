# Base installs read TLS files outside the repository

- **Severity:** High. **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 153, the probe of user decision 145 B.
- **Location:** `crates/mokly-compare/src/manager_yarnrc.rs:15`,
  `crates/mokly-compare/src/manager_plan.rs:139`,
  `crates/mokly-compare/src/manager.rs:66`,
  `crates/mokly-compare/src/inputs.rs:139`, and
  `docs/protocol/mokly-base-dependencies.md:10` to line 14.
- **Reason:** On 2026-10-28 the coordinator reserved this choice for the
  user, and the user has not answered yet.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Base install:** the private install of the base commit's
    dependencies that Changes runs when the base lockfile differs from the
    working tree.
  - **Dependency tier:** the source of a base side's dependencies. Tier two
    is a private base install. Tier three uses the working tree's
    dependencies with a `base-dependencies` warning.
  - **TLS file setting:** a package manager setting that names a
    certificate authority file, a client certificate file, or a client key
    file for registry connections.
- **Background:**
  - A base install reads the manager configuration of the base commit.
    Yarn Berry reads `.yarnrc.yml`. npm and pnpm read `.npmrc`. Yarn Classic
    reads `.yarnrc` and `.npmrc`.
  - `manager_plan.rs` collects the `.yarnrc.yml` files of the install root
    and its ancestors. A Berry configuration with `plugins`,
    `networkSettings`, or a `defaultProtocol` other than `npm:` uses tier
    three. `manager_yarnrc::validate` checks only the range settings
    `catalog`, `catalogs`, and `packageExtensions`.
  - `RepositoryPath::confine` in `manager.rs` already keeps the Berry
    `cacheFolder` and the Yarn Classic offline mirror inside the repository.
  - `docs/protocol/mokly-base-dependencies.md` adds `pnpm-workspace.yaml`,
    `.yarnrc.yml`, `.yarnrc`, and `.npmrc` to the base input set only with a
    pnpm or Yarn lockfile. Npm-only repositories keep manifest and lockfile
    identity, so Mokly never reads their `.npmrc`. The npm install still
    applies the base `.npmrc`.
  - A user decision of 2026-10-21 made each install start from an allowed
    list of environment variables. The probe for that decision found that
    Yarn can read the TLS files that `httpsCaFilePath`,
    `httpsKeyFilePath`, and `httpsCertFilePath` name.
  - Probes on 2026-10-28 used named pipes outside the project as the TLS
    files, so each read showed up:
    - Yarn Berry 4.18.1, with Mokly's base install arguments and fixed
      variables, opened `ca.pem`, `cert.pem`, and `key.pem`, which a base
      `.yarnrc.yml` named.
    - npm and pnpm 10.34.7 opened `ca.pem`, which `cafile` in a base
      `.npmrc` named. The same `.npmrc` set `certfile` and `keyfile`
      without a registry scope, and neither manager opened those files.
- **Problem:** Mokly checks no TLS file setting of any manager. A base
  configuration can point these settings at any host file, so the package
  manager reads files outside the repository.
- **Impact if no action:** A base dependency install can expose private
  host files, such as a client key, to the package manager and to the
  registry exchange.
- **Root question:** How should a base install keep the TLS file reads of
  every package manager inside the repository?
- **Options:**
  - **A.** Use tier three when a base `.yarnrc.yml` sets
    `httpsCaFilePath`, `httpsKeyFilePath`, or `httpsCertFilePath`. A Berry
    base with a certificate inside the repository also loses tier two. npm,
    pnpm, and Yarn Classic still read outside files. Effort: Small.
  - **B.** Clear those settings before the install. A base that needs its
    own certificate authority or client certificate then fails to install.
    npm, pnpm, and Yarn Classic still read outside files. Effort: Small
    (estimate).
  - **C.** Allow only Yarn Berry TLS files that `RepositoryPath::confine`
    keeps inside the repository, and use tier three for an outside path. npm,
    pnpm, and Yarn Classic still read outside files. Effort: Medium
    (estimate).
  - **D.** Apply C to Yarn Berry, Yarn Classic, pnpm, and npm. Add `.npmrc`
    to the dependency inputs of npm-only repositories, so that Mokly can
    check it before the install. This changes the npm input rule of
    `docs/protocol/mokly-base-dependencies.md`. The npm dependency identity
    and install key then include `.npmrc`. A base whose configuration names a
    system file, such as a company certificate authority under `/etc`, uses
    tier three. Effort: Large (estimate).
- **Left out:** Allowing any absolute path breaks the base-input confinement
  rule of `docs/protocol/mokly-base-dependencies.md`. A sandbox that blocks
  every read outside the private entry breaks the rule that each manager
  reads the user configuration with its credentials.
- **Wider fix:** D. Path confinement in every manager keeps valid
  repository certificates and blocks host reads.
- **Previous examples:** `RepositoryPath::confine` already confines the
  Berry `cacheFolder` and the Yarn Classic offline mirror.
- **Recommendation:** D. It blocks the outside reads that the probes found in
  every manager and keeps the certificates that a repository holds.
- **Action:** ask the user, because on 2026-10-28 the coordinator reserved
  this choice for the user: D adds a stricter check of base configurations,
  and it changes the npm input rule of
  `docs/protocol/mokly-base-dependencies.md`.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6133).
