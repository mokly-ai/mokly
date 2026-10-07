# Repository Gate And Length Audits

Continuation of [CI Verification](./ci-verification.md). The repository suite
starts with the live `npm run dependencies:check` audit, then Prettier, ESLint,
changed source/protocol file-length audit, Rust formatting, workspace Clippy
with warnings denied, Rust tests and the Rust file-length audit. The
[test-timing guard](./ci-test-timing.md) adds elapsed-time and polling-deadline
checks to ESLint in the shared test roots, `tests/` and `packages/viewer/tests/`.
Unit discovery and the guard read `scripts/verification/test-roots.mjs`.
The guard exempts only `tests/helpers/durations.ts`.
The live dependency audit fails before any later gate on an uncovered
Low-or-higher advisory, invalid exception, or registry error.
Reviewed path and expiry rules follow [Dependency Security](./dependency-security.md#reviewed-workspace-exceptions).

The Rust file-length auditor is implemented inside `xtask` rather than as a
subprocess in the command list; it has the same failure semantics as the
listed commands. The source/protocol auditor is an xtask-invoked Node command:
it checks files changed against fetched `origin/main`, plus working-tree and
untracked files. It covers all repository TypeScript/JavaScript extensions
(`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`) and
`docs/protocol` Markdown. There are no directory exclusions beyond
Git-ignored untracked files; tracked files remain in scope. Every xtask
subprocess starts at the workspace root, even when xtask starts elsewhere.
Use `cargo xtask source-file-length-lint --all` to audit every scoped file
instead of only the changed set. Source modules have a 300-line limit;
protocol pages have a 250-line limit or their exact reviewed cap in
`tests/protocol_doc_sizes.test.ts`. The independent ratchets remain
additional gates under [Repository Verification Ratchets](./verification-ratchets.md).
During an uncommitted merge, the changed-file audit uses the resolved tree
against `origin/main`; outside a merge, it uses the branch-point diff and
working-tree changes.
