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

To browse the example catalogue, run `npm run dev` from the repository root.
It installs the dependencies and builds Mokly when the install or the build is
missing or out of date with `package-lock.json`, then starts watched Serve.
After you change Mokly's own sources, run `npm run build` first. The
[example README](../../examples/basic/README.md#build-and-serve) gives the
details.

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

`npm run typecheck` checks the five TypeScript projects of the repository with
the TypeScript 6 compiler that `npm ci` installs. The complete gate runs this
standard check. For faster local feedback, run `npm run typecheck:fast`. It
checks the same projects with the native checker of Bun. Bun is optional and is
not an npm dependency. Install the tested version once on each machine, and
build before either check:

```bash
npm install --global bun@1.4.4
npm run build
npm run typecheck:fast
```

The fast command uses Bun 1.4.4 or newer from the PATH. A fresh workspace, such
as a new cloud machine, has no Bun until you install it. Until then, and with
an older Bun, the command prints a warning with the installation command and
runs the standard check.

The two checkers implement different TypeScript versions. Bun 1.4.4 matches
TypeScript 7.0.2, a native implementation of the compiler. The repository
checks and writes its public declarations with TypeScript 6. The two versions
can report different diagnostics for the same code. When the fast and standard
results disagree:

1. Look for the fallback warning. A run with that warning used the standard
   checker.
2. Run `npm run typecheck` on the same sources and build. Its result decides.
3. Fix each error that the standard check reports, also after a fast pass.
4. An error that only the fast check reports does not fail the gate. A change
   for it must also pass the standard check.

The [type check contract](../../docs/protocol/developer-test-commands.md#type-checks)
defines both commands.

The [remote verification contract](../../docs/protocol/remote-verification.md)
defines the Testbox gate, which runs the same suites on Blacksmith boxes:

```bash
cargo xtask check --executor remote
```

It needs `blacksmith`, `rsync`, and `ssh`, and `BLACKSMITH_ORG_TOKEN` or the
current CLI login. The
[executor selection rules](../../docs/protocol/remote-verification.md) define
when the default `auto` executor selects remote mode. The
[base sync](../../docs/protocol/remote-verification-base.md) and
[cleanup](../../docs/protocol/remote-verification-cleanup.md) contracts define
checkout preservation, run identity, and the box lifecycle.

`npm run dependencies:check` runs the strict audit of every workspace
dependency category from the lockfile, and `--baseline` reports issues already
present at the comparison commit as notices. The
[baseline audit](../../docs/protocol/dependency-audit-baseline.md) contract
defines which jobs use each mode. See also the
[dependency update pull request](../../docs/protocol/dependency-audit-update-pr.md)
and [dependency security](../../docs/protocol/dependency-security.md) contracts.

`npm run dependencies:check:rust` installs the pinned Rust advisory tool and
audits `Cargo.lock` against RustSec. The repository suite, daily audit, and
release verification run it alongside the npm audit. Rust vulnerabilities and
audit errors fail in both npm audit modes.

Pull request titles use Conventional Commits and at most 72 Unicode code
points; see the
[title contract](../../docs/protocol/ci-verification.md#pull-request-title-contract).

### Key Code

- [`crates/mokly-model`](../../crates/mokly-model/README.md) — holds every
  shared shape, the prop schema profile, and the source of the generated
  TypeScript types.
- [`crates/mokly-catalogue`](../../crates/mokly-catalogue/README.md) and
  [`crates/mokly-html`](../../crates/mokly-html/README.md) — discover the
  sources, build the catalogue model, and compose HTML screens, components,
  and documents.
- [`crates/mokly-sidecar`](../../crates/mokly-sidecar/README.md),
  [`packages/mokly/src/sidecar.ts`](../../packages/mokly/src/sidecar.ts), and
  [`packages/mokly/src/sidecar`](../../packages/mokly/src/sidecar) — hold the
  render sidecar protocol and the Node process that renders React, pages, and
  stories.
- [`crates/mokly-css`](../../crates/mokly-css/README.md),
  [`crates/mokly-graph`](../../crates/mokly-graph/README.md), and
  [`crates/mokly-compare`](../../crates/mokly-compare/README.md) — handle
  stylesheets and attribution, the render graph and cache, and comparison.
- [`crates/mokly-server`](../../crates/mokly-server/README.md),
  [`crates/mokly-watch`](../../crates/mokly-watch/README.md),
  [`crates/mokly-static`](../../crates/mokly-static/README.md), and
  [`crates/mokly-publish`](../../crates/mokly-publish/README.md) — provide
  Serve, the watcher, the static build, and the upload exchange.
- [`crates/mokly-cli`](../../crates/mokly-cli/README.md) — builds the `mokly`
  binary and its terminal output.
- [`packages/viewer`](../../packages/viewer/README.md) — holds the React shell,
  the index and detail readers, navigation, frames, and inspection.
- [`xtask/src/remote`](../../xtask/src/remote) — runs the Testbox gate, the
  report downloads, the logs, and the interrupt cleanup.
- [`scripts/verification`](../../scripts/verification) — holds the
  verification scripts that CI and the gate share.
- [`scripts/release/inspect-native.mjs`](../../scripts/release/inspect-native.mjs)
  — checks the packed package of one native target and its TLS dependencies.
- [`scripts/verification/process-owner-snapshot.mjs`](../../scripts/verification/process-owner-snapshot.mjs)
  — checks the owner and process records of concurrent cleanup.
- [`scripts/dev.mjs`](../../scripts/dev.mjs) and
  [`scripts/dev-preparation.mjs`](../../scripts/dev-preparation.mjs) — run
  `npm run dev`: install and build when needed, then start the local CLI.
- [`examples/basic`](../../examples/basic/README.md) — is the reference
  consumer and the design catalogue.
