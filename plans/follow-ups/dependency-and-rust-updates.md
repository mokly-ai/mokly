# Redo dependency updates and the Rust toolchain move

- **Severity:** Low (estimate). **Effort:** Medium (estimate).
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user decision 65 A of 2026-10-21.
- **Location:** `rust-toolchain.toml:2`, `Cargo.toml:8`, `Cargo.lock`,
  `package-lock.json`, and the Rust version text in
  `docs/development/README.md:6`, `docs/protocol/npm-release.md:87`,
  `docs/protocol/ci-workflow.md:89`, and
  `docs/protocol/remote-verification-testbox.md:34`.
- **Reason:** On 2026-10-21 the user chose to close pull request #197 and
  redo its updates after the Rust rebuild merged.

- **Terms:**
  - **In-range update:** a dependency update that stays inside the version
    range that `package.json` or `Cargo.toml` already declares, so only the
    lock file changes.
- **Background:**
  - Pull request #197 was a housekeeping change against the old TypeScript
    backend. It held in-range dependency updates and a move from Rust 1.95.0
    to Rust 1.99.0.
  - On 2026-10-21 the user had three choices. The first closed #197 and
    redid the work after the merge. The second redid it on the rebuild
    branch first. The third merged #197 at once. The user chose the first,
    and #197 was closed unmerged that day.
  - The plan does not list the packages that #197 updated.
  - The Rust rebuild merged as PR #199 on 2026-10-25. Rust is still pinned
    at 1.95.0 in `rust-toolchain.toml:2` and `rust-version = "1.95"` in
    `Cargo.toml:8`.
  - Later pull requests updated single packages only, for example #200 for
    audit findings and #230 for `pulldown-cmark`.
  - `docs/protocol/dependency-security.md:152-235` holds the update policy
    and the holds that every update must keep.
- **Task:**
  1. Run `npm ci` with the npm version that `packageManager` pins.
  2. Run `npm update` for the in-range updates. Keep every hold in
     `docs/protocol/dependency-security.md`, such as the exact
     `@playwright/test`, `wrangler`, and `release-please` pins.
  3. Run `cargo update` for the in-range Rust updates.
  4. Move Rust to 1.99.0 in `rust-toolchain.toml` and `Cargo.toml`. Fix each
     new Clippy or compiler warning. A release newer than 1.99.0 needs the
     user's agreement, because the decision names 1.99.0.
  5. Update the Rust version text in the four docs that the Location names.
  6. Review the lock file diffs for removals, engines, and native optional
     packages, as the update policy requires.
  7. Run the complete gate, `cargo xtask check`, from a clean `npm ci`.
- **Impact if no action:** The dependencies and the toolchain fall further
  behind, and a later update has a larger diff and more risk.
- **Needs:** Nothing beyond normal repository access.
- **Done when:** A merged pull request holds the in-range npm and Cargo
  updates and Rust 1.99.0, with the docs updated and the complete gate
  passing.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5445).
