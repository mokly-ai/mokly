# Repository Gate And Length Audits

Continuation of [CI Verification](./ci-verification.md).

## Repository Boundary

The repository suite runs these checks in this order:

1. The live npm dependency audit, in baseline or strict mode.
2. The Rust advisory audit.
3. The generated TypeScript byte-identity check.
4. Prettier.
5. ESLint.
6. The changed-file source and protocol [length audit](#length-audits).
7. The four [repository ratchets](./verification-ratchets.md): JavaScript and
   TypeScript file length, protocol document caps, unused internal exports,
   and public package exports.
8. Rust formatting.
9. Workspace Clippy with warnings denied.
10. The `@mokly/viewer` build, then the `@mokly/mokly` build.
11. The Rust tests of every crate.
12. The Rust file-length audit.

The [baseline audit contract](./dependency-audit-baseline.md#xtask-and-ci-selection)
selects the npm audit mode and defines its comparison rules. Report, input,
and registry errors fail in both modes. Reviewed path and expiry rules follow
[Dependency Security](./dependency-security.md#reviewed-workspace-exceptions).

The Rust audit follows [Dependency Security](./dependency-security.md#rust-advisory-audit).
It fails on vulnerabilities and audit errors in both npm audit modes.

Generated TypeScript must match the Rust-owned types byte for byte. Missing,
changed, or extra generated files fail the repository suite and its CI job.
The check writes no files. Authors regenerate and commit changed output.

The repository and native suites build `@mokly/viewer` then `@mokly/mokly`
before `cargo test --workspace`. The real sidecar smoke tests require these
fresh package outputs on every host, including a clean checkout.

Every xtask subprocess starts at the workspace root, even when xtask starts
elsewhere.

## Length Audits

The changed-file length audit checks the files changed against fetched
`origin/main`, plus working-tree and untracked files. It covers every
repository TypeScript and JavaScript file (`.ts`, `.tsx`, `.js`, `.jsx`,
`.mjs`, `.cjs`, `.mts`, `.cts`) and the Markdown under `docs/protocol`. There
are no directory exclusions beyond Git-ignored untracked files. Tracked files
remain in scope. During an uncommitted merge, the audit compares the resolved
tree with `origin/main`. Outside a merge, it uses the branch-point diff and the
working-tree changes.

Source modules have a 300-line limit. Protocol pages have a 250-line limit or
their exact reviewed cap in `xtask/protocol-document-caps.json`. When that file
is absent, every protocol page has the 250-line limit. The
[protocol document cap ratchet](./verification-ratchets.md#protocol-document-caps)
defines the cap table. `cargo xtask source-file-length-lint` runs this audit
alone. Use `--all` to audit every scoped file instead of only the changed set.

The Rust file-length audit checks every Rust file under `xtask/` and `crates/`
on every run. Each file has a 300-line limit, with no ratchet and no override.
`cargo xtask rust-file-length-lint` runs it alone. A finding fails the suite
like a failed command.

## ESLint Rules

ESLint carries the repository's source-level rules beyond style. The local
`mokly` plugin provides `no-directory-literals` for Mokly-owned directory
names, `no-artifact-path-literals` for comparison artifact paths under the
[artifact path contract](./mokly-artifact-paths.md), and
`no-late-fixture-teardown` and `no-eager-fixture-setup` for test fixture
ownership under [CI suite evidence](./ci-suite-evidence.md). The
[test-timing guard](./ci-test-timing.md#eslint-guard) is also an ESLint rule.
A rule that must scan every file belongs here, in `npm run lint`, not in a Node
test.
