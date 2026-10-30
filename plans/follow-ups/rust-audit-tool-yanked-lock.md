# Avoid yanked packages in the cargo-audit tool lock

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #225 and its completed plan, which put the
  problem outside the scope of its review.
- **Location:** `.cargo/audit-tool/Cargo.lock:3248`,
  `scripts/verification/rust-audit-tool.mjs:17`, and line 65.
- **Reason:** The tool lock is older than PR #225, and the review found the
  problem outside the diff of that change.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Audit tool:** the `cargo-audit` binary that the repository suite
    builds to check the Rust dependencies for advisories.
  - **Yanked release:** a crate version that its authors withdrew from
    crates.io. Cargo still builds it from an existing lock.
- **Background:**
  - `scripts/verification/rust-audit-tool.mjs:17` pins `cargo-audit` 0.22.2
    with its checksum.
  - The script builds it with the reviewed lock
    `.cargo/audit-tool/Cargo.lock` and `cargo install --locked`, at line 65.
  - That lock pins `tokio` 1.54.0, at `.cargo/audit-tool/Cargo.lock:3248`.
    The review of PR #225 found on 2026-10-28 that this release is yanked.
- **Problem:** The repository suite builds its audit tool with a yanked
  Tokio release.
- **Impact if no action:** The audit tool keeps a dependency that its authors
  withdrew. A defect that caused the yank stays in the tool that checks the
  other dependencies.
- **Root question:** How does the audit tool build from a lock without
  withdrawn releases?
- **Options:**
  - **A.** Update `tokio` in `.cargo/audit-tool/Cargo.lock` to a release that
    is not yanked, and review the lock diff. Effort: Small.
  - **B.** Move to a newer `cargo-audit` release, with its checksum and a new
    reviewed lock. Effort: Small (estimate).
  - **C.** Change nothing. Effort: Small.
- **Left out:** A check that fails when the tool lock holds a yanked
  release. It needs the crates.io index during the gate, and a new gate
  needs the user.
- **Wider fix:** B (estimate). A current tool release brings a lock that its
  authors maintain.
- **Previous examples:** PR #230 updated `pulldown-cmark` on 2026-10-28,
  after a new advisory failed the Rust dependency audit on every branch.
- **Related:** [locked-cargo-gate.md](./locked-cargo-gate.md) asks the gate to
  run Cargo with `--locked`, so that a stale `Cargo.lock` of the workspace
  fails the gate. This item concerns the separate reviewed lock of the audit
  tool, which already builds with `--locked`. The items share the
  `--locked` mechanism, but their causes and fixes differ.
- **Recommendation:** A (estimate). It removes the yanked release with the
  smallest reviewed change.
- **Action:** ask the user, because condition 6 holds (estimate): this is a
  process finding about the verification tooling.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L392).
