# Develop Mokly

For repository development, use the tested Node.js version in
[`.nvmrc`](../../.nvmrc), npm 11.21.0 (the `packageManager` version in
`package.json`), the Rust toolchain in
[`rust-toolchain.toml`](../../rust-toolchain.toml) (Rust 1.95.0 with rustfmt and
Clippy), and Chromium for the browser suite. With nvm, run `nvm install` in
the repository before the npm commands below. rustup reads the toolchain file
and installs the pinned Rust the first time `cargo` runs in the repository.

```bash
git clone https://github.com/mokly-ai/mokly.git
cd mokly
npm install --global npm@11.21.0
npm ci
npm run build
cargo xtask check
```

The Rust core lives in a Cargo workspace under `crates/`, one crate per
subsystem, with the viewer under `packages/viewer`, the verification task
runner under `xtask/`, and the reference consumer under
[`examples/basic`](../../examples/basic/README.md). The
[Rust core architecture](../../docs/architecture/rust-core.md) is the map of the
crates and the npm packages.

Run the tests that cover a change while you develop:

```bash
npm test -- tests/markdown_links.test.ts
npm run test:browser -- tests/browser/pages.spec.ts -g "retain metadata"
cargo test -p mokly-html
```

Put every npm test argument after `--`. Selected runs are partial
verification; `cargo xtask check` is the complete gate. It runs formatting,
linting, type checks, the Rust and viewer suites, the browser suite,
dependency checks, and the length audits. See
[developer test commands](../../docs/protocol/developer-test-commands.md) for the
argument and report rules, the [xtask README](../../xtask/README.md) for focused
suites, and [CI test timing](../../docs/protocol/ci-test-timing.md) for the rule
that tests never assert elapsed time.

The [remote verification contract](../../docs/protocol/remote-verification.md)
defines the Testbox gate, which runs the same suites on Blacksmith boxes:

```bash
cargo xtask check --executor remote
```

It needs `blacksmith`, `rsync`, and `ssh`, and `BLACKSMITH_ORG_TOKEN` or the
current CLI login. The default `auto` executor selects remote mode when the
token and every availability check pass; `--executor local` and a selected
`--suite` stay local. The
[base sync](../../docs/protocol/remote-verification-base.md) and
[cleanup](../../docs/protocol/remote-verification-cleanup.md) contracts define
checkout preservation, run identity, and the box lifecycle.

`npm run dependencies:check` runs the strict audit of every workspace
dependency category from the lockfile, and `--baseline` reports issues already
present at the comparison commit as notices. Baseline mode is the default for
`cargo xtask check`, ordinary pull requests, and pushes; Release Please,
dependency update pull requests, release publishing, and the daily `main`
audit stay strict. See the
[baseline audit](../../docs/protocol/dependency-audit-baseline.md),
[dependency update pull request](../../docs/protocol/dependency-audit-update-pr.md),
and [dependency security](../../docs/protocol/dependency-security.md) contracts.

`npm run dependencies:check:rust` installs the pinned Rust advisory tool and
audits `Cargo.lock` against RustSec. The repository suite, daily audit, and
release verification run it alongside the npm audit. Rust vulnerabilities and
audit errors fail in both npm audit modes.

Pull request titles use Conventional Commits and at most 72 Unicode code
points; see the
[title contract](../../docs/protocol/ci-verification.md#pull-request-title-contract).

### Key code

- `crates/mokly-model` — every shared shape, the prop schema profile, and the
  generated TypeScript types.
- `crates/mokly-catalogue` and `crates/mokly-html` — discovery, the catalogue
  model, HTML screens and components, and document composition.
- `crates/mokly-sidecar` and `packages/mokly/sidecar` — the render sidecar
  protocol and the Node process that runs React, pages, and stories.
- `crates/mokly-css`, `crates/mokly-graph`, and `crates/mokly-compare` —
  stylesheets and attribution, the render graph and cache, and comparison.
- `crates/mokly-server`, `crates/mokly-watch`, `crates/mokly-static`, and
  `crates/mokly-publish` — Serve, the watcher, the static build, and the
  upload exchange.
- `crates/mokly-cli` — the `mokly` binary and its terminal output.
- [`packages/viewer`](../../packages/viewer/README.md) — the React shell, the
  index and detail readers, navigation, frames, and inspection.
- [`xtask/src/remote`](../../xtask/src/remote) — the Testbox gate, report
  downloads, logs, and interrupt cleanup.
- [`scripts/verification`](../../scripts/verification) — the verification scripts
  that CI and the gate share.
- [`scripts/release/inspect-native.mjs`](../../scripts/release/inspect-native.mjs) —
  verifies the packed target and its TLS dependencies. Packed manifest
  inspection rejects `MOKLY_TEST_` bytes in every native archive. Runtime
  inspection uses `readelf` on Linux, `otool` on macOS, and `dumpbin` on Windows.
- [`examples/basic`](../../examples/basic/README.md) — the reference consumer and
  design catalogue.
