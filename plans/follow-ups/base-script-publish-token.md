# Keep the publish token from base install scripts

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 151, from finding 43 of the 135 B review.
- **Location:** `crates/mokly-cli/src/entry.rs:25`,
  `crates/mokly-cli/src/options.rs:63`, and
  `crates/mokly-compare/src/process.rs:36-45`.
- **Reason:** The plan recorded this item after the user's rule of
  2026-10-21 that new review items wait for the user after the merge. The
  hub asked for a decision before the first npm release.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Base install:** the dependency install that Changes runs for the base
    commit, so that it can render the base side.
  - **Lifecycle scripts:** package scripts such as `postinstall` that npm,
    pnpm, or Yarn run during an install.
- **Background:**
  - On 2026-10-21 the user chose to keep lifecycle scripts off in base
    installs by default. `review.baseInstallScripts`,
    `--base-install-scripts`, and `--no-base-install-scripts` turn them on
    or off. The same decision keeps `MOKLY_TOKEN` out of installs.
  - Each install child starts from an allowed list of environment
    variables, at `process.rs:36-45`, so it does not inherit the token.
  - `mokly publish` reads the publication token from `MOKLY_TOKEN`, at
    `entry.rs:25`. The variable stays in Mokly's own process environment.
- **Problem:** When scripts are on, a dependency script runs as the same
  user. It can read `MOKLY_TOKEN` from Mokly's own `/proc/{pid}/environ`.
- **Impact if no action:** Dependency code of the base commit can read and
  send away the publication token during a build or a publication.
- **Root question:** How does Mokly keep the publication token away from
  dependency scripts that the user turned on?
- **Options:**
  - **A.** Document the risk, and advise `--no-base-install-scripts` for
    publication. Effort: Small.
  - **B.** Keep scripts off when a publication token is present, and emit a
    warning. Effort: Small.
  - **C.** Run dependency scripts in a separate process space that cannot
    read the parent environment. Effort: Large.
- **Left out:** Pass the token to the sidecar or to the package manager
  child. It makes the exposure worse.
- **Wider fix:** C. Process isolation protects every parent secret, not
  only this token.
- **Previous examples:** The sidecar inherited `MOKLY_TOKEN` too. Decision
  180 of 2026-10-28 fixed that path in
  [`crates/mokly-sidecar/src/process_environment.rs`](../../crates/mokly-sidecar/src/process_environment.rs).
  Sidecars and their PostCSS children now receive no inherited `MOKLY_`
  variable.
- **Related:**
  - Sidecar code also runs as the same user. It can still read Mokly's own
    environment, as the
    [token exposure](../../docs/protocol/mokly-upload.md#token-exposure)
    rules state. The two paths share this class, so one branch can protect
    both.
  - The `Debug` form of the publish command held the same secret. Decision
    181 of 2026-10-28 fixed it with the redacting `Secret` type in
    [`crates/mokly-publish/src/redaction.rs`](../../crates/mokly-publish/src/redaction.rs).
    It was a separate fix.
- **Recommendation:** B. It blocks the known path with a small change. C
  best protects all parent secrets.
- **Action:** ask the user, because on 2026-10-21 the user ruled that new review
  items wait for the user after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6118).
