# Repository Gate And Length Audits

Continuation of [CI Verification](./ci-verification.md).

## Repository Boundary

The repository suite
starts with the live npm lockfile audit, Rust advisory audit, and generated
TypeScript byte-identity check, then Prettier, ESLint,
changed source/protocol file-length audit, Rust formatting, workspace Clippy
with warnings denied, viewer and sidecar package builds, Rust tests and the Rust file-length audit. The
[test-timing guard](./ci-test-timing.md) adds elapsed-time and polling-deadline
checks to ESLint under `tests/`. The live
dependency audit defaults to baseline mode for local checks, ordinary pull
requests, and every push. New findings or exception issues fail; inherited
issues print as notices. Report, input, and registry errors always fail.
`--dependency-audit strict` selects strict mode for this suite or the complete
gate. An explicit mode flag with any other suite returns a typed error before
subprocesses start. Release Please and dependency update pull requests select
strict mode; the scheduled `main` audit and read-only release preparation also stay
strict. The [baseline contract](./dependency-audit-baseline.md) defines the
mode selection and comparison rules. Reviewed path and expiry
rules follow [Dependency Security](./dependency-security.md#reviewed-workspace-exceptions).

The Rust audit follows [Dependency Security](./dependency-security.md).
It fails on vulnerabilities and audit errors in both npm audit modes.

Generated TypeScript must match the Rust-owned types byte for byte. Missing,
changed, or extra generated files fail the repository suite and its CI job.
The check writes no files. Authors regenerate and commit changed output.

The repository and native suites build `@mokly/viewer` then `@mokly/mokly`
before `cargo test --workspace`. The real sidecar smoke tests require these
fresh package outputs on every host, including a clean checkout.

The Rust file-length auditor runs inside `xtask` rather than as a
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
`xtask/protocol-document-caps.json`. The independent ratchets are
additional gates under [Repository Verification Ratchets](./verification-ratchets.md).
During an uncommitted merge, the changed-file audit uses the resolved tree
against `origin/main`; outside a merge, it uses the branch-point diff and
working-tree changes.

ESLint carries the repository's source-level rules beyond style. The local
`mokly` plugin provides `no-directory-literals` for Mokly-owned directory
names, `no-artifact-path-literals` for comparison artifact paths under the
[artifact path contract](./mokly-artifact-paths.md), and
`no-late-fixture-teardown` and `no-eager-fixture-setup` for test fixture
ownership under [CI suite evidence](./ci-suite-evidence.md). The PostCSS
access restrictions and the test-timing guard are also ESLint rules. A rule
that must scan every file belongs here, in `npm run lint`, not in a Node test.
