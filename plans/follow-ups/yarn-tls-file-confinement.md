# Base installs read TLS files outside the repository

- **Severity:** High. **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 153, the probe of user decision 145 B.
- **Location:** `crates/mokly-compare/src/manager_yarnrc.rs:15`,
  `crates/mokly-compare/src/manager_plan.rs:139`,
  `crates/mokly-compare/src/manager.rs:66`,
  `crates/mokly-compare/src/inputs.rs:139`,
  `docs/protocol/mokly-base-dependencies.md:10` to line 14, and
  `docs/protocol/mokly-base-dependencies.md:115` to line 123.
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
  - The trust rule of `docs/protocol/mokly-base-dependencies.md:115` to
    line 123 is a decision in force. A base install trusts the base commit
    as the project's own install of that commit does. Mokly adds no
    hardening beyond that install.
  - The local-path rule of `docs/protocol/mokly-base-dependencies.md:91` to
    line 95 sends a package specification or a Yarn patch path outside the
    repository to a typed fallback. It does not cover TLS files. No
    requirement forbids a TLS file outside the repository.
  - Each manager reads the base project configuration and the user
    configuration with its credentials, under
    `docs/protocol/mokly-base-dependencies.md:146`.
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
- **Root question:** How should a base install treat a TLS file that a base
  configuration names outside the repository?
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
  - **E.** Keep the current install, which trusts the base commit as the
    project's own install does. Document next to the trust rule that a base
    configuration can name host TLS files and that the install reads them,
    as the project's own install does. E accepts the existing host-file
    access. It preserves private host TLS setups, such as a company
    certificate authority under `/etc`. E drops the second shared
    assumption below. Effort: Small.
  - **F.** Keep the install, and add a `base-dependencies` warning when a
    base configuration names a TLS file outside the repository. The install
    still reads the file, so the exposure stays. A private host setup gets
    the warning on each base install. Mokly must read the TLS settings of
    every manager, also in the `.npmrc` of an npm-only repository. Effort:
    Medium (estimate).
- **Shared assumptions:** Options A to D share two assumptions.
  - The options act only on the configuration of the base commit. The user
    configuration with its credentials stays trusted, and so do the
    certificate variables of the allowed environment. Sources:
    `docs/protocol/mokly-base-dependencies.md:146`, and the allowed list of
    `docs/protocol/mokly-base-install-processes.md#environment`, which keeps
    `NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE`, and `SSL_CERT_DIR`. Every option
    keeps this assumption.
  - A TLS path in a base configuration that points outside the repository
    is untrusted. No requirement states this. The trust rule says the
    opposite: a base install trusts the base commit as the project's own
    install does, and Mokly adds no hardening. So A to D change the trust
    rule. E drops this assumption. F keeps it in part, because it warns but
    still installs.
- **Left out:** A sandbox that blocks every read outside the private entry.
  It breaks the rule that each manager reads the user configuration with
  its credentials.
- **Wider fix:** D. Path confinement in every manager keeps valid
  repository certificates and blocks host reads.
- **Previous examples:** `RepositoryPath::confine` already confines the
  Berry `cacheFolder` and the Yarn Classic offline mirror.
- **Recommendation:** D. Mokly starts base installs by itself, in Serve,
  build, and publish, also in CI where secrets are present. A project's own
  install is a step that a developer chooses, so the trust rule fits these
  automatic reads less well. D blocks the outside reads that the probes
  found in every manager, and it keeps the certificates that a repository
  holds. E accepts the existing host-file access and preserves private host
  TLS setups.
- **Action:** ask the user, because D adds a stricter check of base
  configurations and changes two decisions in force in
  `docs/protocol/mokly-base-dependencies.md`: the trust rule and the npm
  input rule. The coordinator reserved this choice for the user on
  2026-10-28.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6133).
