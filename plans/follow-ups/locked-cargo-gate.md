# Run Cargo checks with the locked dependency graph

- **Severity:** Medium (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of the F18 re-review of 2026-10-20.
- **Location:** the `cargo xtask` alias at `.cargo/config.toml:2`, the gate
  commands at `xtask/src/check/commands.rs:22-28`, `:61`, and `:65-89`, the
  shared `cargo` helper at `:99-101`, and the CI gate steps, for example
  `.github/workflows/ci.yml:106` and `:260`.
- **Reason:** The problem is in gate code outside the reviewed change, and
  options B and C make the gate stricter, which needs the user.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Gate:** `cargo xtask check`, the complete verification. It runs the
    repository, viewer, browser, and native suites that
    `xtask/src/check/commands.rs` defines.
  - **`--locked`:** a Cargo flag. With it, Cargo fails instead of changing
    `Cargo.lock` when the lock file does not match the manifests.
- **Background:**
  - A stale `Cargo.lock` is a lock file that no longer matches a
    `Cargo.toml` change.
  - The release build runs `cargo build --locked` or `cargo zigbuild
--locked`, in `scripts/release/native_build.mjs:22-26`. A stale lock
    file fails it.
  - On 2026-10-20 the review found that the gate runs Cargo without
    `--locked`. So a stale lock file could pass the gate and fail only the
    release build.
  - `.cargo/config.toml:2` defines the `cargo xtask` launcher as
    `run --package xtask --target-dir target/xtask --`, with no `--locked`.
    The launcher resolves the whole workspace before any suite starts. So
    Cargo can update a stale `Cargo.lock` at that moment.
  - The repository suite runs the Rust audit early, at `commands.rs:49`.
    The audit runs `cargo metadata --locked --format-version 1`, in
    `scripts/verification/rust-audit.mjs:30-34`. It runs after the
    launcher, so it can read a lock file that the launcher already updated.
  - CI starts each suite through the same launcher, for example at
    `.github/workflows/ci.yml:106` and `:260`.
- **Problem:** No Cargo command fails on a stale lock file before the
  launcher can update it. `cargo clippy` and `cargo test` in the suites also
  run without `--locked`. So a stale lock file can pass the gate, and the
  audit's locked read does not close this bootstrap hole.
- **Impact if no action:** A stale lock file can pass the complete gate and
  CI, and fail only the release build.
- **Root question:** How does the gate show that `Cargo.lock` matches the
  manifests before a release needs it?
- **Options:**
  - **A.** Change nothing. A stale lock file can still pass the gate.
    Effort: Small.
  - **B.** Add `--locked` to the `cargo xtask` alias in `.cargo/config.toml`
    and to each gate command that resolves dependencies, such as
    `cargo clippy` and `cargo test`. The launcher then fails first, with
    Cargo's own message, in every suite and on every platform. Effort:
    Small.
  - **C.** Add one named lock-file preflight that runs before the resolving
    launcher: a step that runs `cargo metadata --locked --format-version 1`
    before each `cargo xtask check` step in CI. Name the same command as the
    first step of the documented local gate. Keep the other commands. A
    local run that skips the preflight keeps the hole. Effort: Small.
- **Left out:**
  - A lock-file step inside a suite. The launcher resolves the workspace
    first, so the step can read an already-updated lock file.
  - A separate CI job that only checks the lock file. It adds a job and a
    runner, and C gives the same check in the existing jobs.
- **Wider fix:** B. Each Cargo command that can rewrite the lock file then
  checks it, starting with the launcher, so no new command can skip the
  check.
- **Previous examples:** The release build, the `cargo-zigbuild` install in
  `scripts/release/setup-linux.mjs:40-47`, and the audit tool install in
  `scripts/verification/rust-audit-tool.mjs:61-69` already use `--locked`.
  The Rust audit reads the lock file with `--locked` too, but only after the
  launcher.
- **Related:** [rust-audit-tool-yanked-lock.md](rust-audit-tool-yanked-lock.md)
  is about the separate lock file of the `cargo-audit` tool. It shares the
  `--locked` mechanism but not this cause, so each item needs its own fix.
- **Recommendation:** B (estimate). The launcher then fails first on every
  platform, for local and CI runs, at no runtime cost.
- **Action:** ask the user, because condition 3 holds (estimate): B and C
  add stricter validation to the gate, which the always-on rules reserve
  for the user.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4853).
