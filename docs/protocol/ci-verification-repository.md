# Repository Gate And Length Audits

Continuation of [CI Verification](./ci-verification.md).

## Repository Boundary

The repository suite runs these checks in this order:

1. The live npm dependency audit, in baseline or strict mode.
2. The root npm lockfile install.
3. The Rust advisory audit.
4. The MIT dependency [boundary check](#dependency-boundary).
5. Whitespace checks on every Git-visible text file.
6. The generated TypeScript byte-identity check.
7. `npm run palette:check`, the drift check of the stylesheets that the
   `@mokly/ui` palette module generates.
8. Prettier and ESLint, once for the whole repository.
9. ast-grep rule tests and the Rust and npm source scan.
10. The unit tests of the npm boundary and cloud skip validator.
11. The changed-file source and protocol [length audit](#length-audits).
12. The four [repository ratchets](./verification-ratchets.md): JavaScript and
    TypeScript file length, protocol document caps, unused internal exports,
    and public package exports.
13. Rust formatting for every crate.
14. Clippy with warnings denied for `mokly-*` and `xtask`.
15. Clippy with warnings denied for the `mokly-cli` `design-matrix` feature.
16. `cargo xtask build-native`, then the `@mokly/ui`, `@mokly/model`,
    `@mokly/frame`, `@mokly/viewer`, and `@mokly/mokly` builds, in that order.
17. The Rust tests of `mokly-*` and `xtask`.
18. The Rust file-length audit of every crate and xtask.

The [cloud suites](./ci-verification.md#cloud-suites) own Clippy and tests for
`mkc-` crates. The whole-repository Markdown link test runs once in Viewer.
Whitespace rejects trailing spaces, trailing tabs, missing final newlines,
and final blank lines. One `git check-attr` call reads the attributes of every
file. `-text` preserves fixture bytes. `whitespace=-blank-at-eol` permits
trailing whitespace, and `-blank-at-eof` permits final blank lines. All other
checks still apply. Binary files are outside the whitespace check.

The suite compiles and lints the feature-gated design matrix target but does
not run it; the nightly
[Design Attribution Matrix](./ci-workflow.md#design-attribution-matrix) runs
it. Leaving that target to the nightly run alone was rejected, because a
compile error then stays hidden until the nightly run fails.

The [baseline audit contract](./dependency-audit-baseline.md#xtask-and-ci-selection)
selects the npm audit mode and defines its comparison rules. Report, input,
and registry errors fail in both modes. Reviewed path and expiry rules follow
[Dependency Security](./dependency-security.md#reviewed-workspace-exceptions).

The Rust audit follows [Dependency Security](./dependency-security.md#rust-advisory-audit).
It fails on vulnerabilities and audit errors in both npm audit modes.

Generated TypeScript must match the Rust-owned types byte for byte. Missing,
changed, or extra generated files fail the repository suite and its CI job.
The check writes no files. Authors regenerate and commit changed output.

The repository and native suites build the host native package and the five
JavaScript packages in the order of item 16 before the Mokly Rust tests. The
real sidecar smoke tests and the `xtask` fixtures that run the workspace
`mokly` command require these fresh outputs on every host, including a clean
checkout.

Every xtask subprocess starts at the workspace root, even when xtask starts
elsewhere.

## Dependency Boundary

No `mokly-*` crate and no `xtask` depends on an `mkc-` crate. The check reads
Cargo metadata and covers normal, dev, build, target-specific, and renamed
dependencies.

No MIT package under `packages/` depends on a cloud npm project: a project
under `apps/`, or `packages/app/`, `packages/desktop/`, or `packages/tokens/`.
The check covers normal, dev, peer, and optional manifest dependencies. It
also checks source imports, exports, dynamic imports, CommonJS requests, and
type imports. Relative paths and TypeScript aliases cannot cross the boundary.
`packages/tokens/` is a cloud package and may use cloud code.

The cloud-owned `stripe-catalogue` binary may depend on cloud crates. Its
xtask entry point starts it as a subprocess. Xtask has no cloud crate dependency.

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
