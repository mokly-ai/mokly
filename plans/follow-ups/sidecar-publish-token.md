# Remove the publish token from the sidecar environment

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 180, delta review 5.
- **Location:** `crates/mokly-sidecar/src/process_factory.rs:85`.
- **Reason:** Option A changes the documented rule that the sidecar inherits the
  consumer environment, and no user decision covers that change.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Sidecar:** the Node process that runs consumer JavaScript for
    rendering: the renderer, React components, and PostCSS.
  - **Publish token:** the bearer credential in `MOKLY_TOKEN` or `--token`
    that `mokly publish` sends to the catalogue service.
- **Background:** Sidecars start as follows.
  - `process_factory.rs` starts each sidecar with `Command::new`, which
    inherits Mokly's environment.
  - It sets `PWD` and `MOKLY_POSTCSS_PHASES` and removes three npm variables.
    It does not remove `MOKLY_TOKEN`.
  - Consumer renderer, component, and PostCSS code from the working tree and
    from the base commit runs in that process.
  - The review found this older than the change it reviewed: `main` before the
    Rust rebuild ran that code with the same environment.
  - Base installs already start from an allowed list of variables, under a
    user decision of 2026-10-21.
  - On 2026-10-28 the user chose to document the same-user limit for base
    installs. A base install passes no inherited `MOKLY_` variable to a
    package manager or a lifecycle script. Code that runs as the same user
    can still read the environment of Mokly and of its launcher.
    `docs/protocol/mokly-base-install-processes.md#environment` and
    `docs/guides/cli/publish.md` state this limit.
- **Problem:** The sidecar receives `MOKLY_TOKEN`, although rendering does
  not need the publish secret.
- **Impact if no action:** Consumer code from the repository or from the
  base commit can read and disclose the token during `mokly publish`.
- **Root question:** How should Mokly keep its secrets out of the processes
  that run consumer code?
- **Options:**
  - **A.** Remove `MOKLY_TOKEN` from the sidecar environment. Effort: Small.
  - **B.** Start sidecars from an allowed list of variables, as base installs
    do. Effort: Medium.
- **Left out:** Clearing every variable breaks consumer PostCSS settings
  that read the environment.
- **Wider fix:** B. An allowed list protects every inherited secret, not
  only the token.
- **Previous examples:** The rebuild found that a lifecycle script of a base
  install can read `MOKLY_TOKEN` from Mokly's own `/proc/{pid}/environ`.
- **Recommendation:** A. It removes the known unused secret, while an
  allowed list can break consumer PostCSS settings. B best protects all
  inherited secrets.
- **Action:** ask the user, because A removes `MOKLY_TOKEN` from the environment
  that `docs/protocol/mokly-sidecar.md:233` says the sidecar inherits, and no
  user decision covers that change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6384).
