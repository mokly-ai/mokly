# Mokly CI And Npm Release Contract

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Breaking-change notes: [npm release notes](./npm-release-notes.md).

## Package Set

One release publishes seven packages from one reviewed commit:

| Package                  | Content                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `@mokly/native-<target>` | one `mokly` binary per target: `linux-x64-gnu`, `linux-arm64-gnu`, `darwin-x64`, `darwin-arm64`, `win32-x64-msvc`  |
| `@mokly/viewer`          | the Browse shell: shell assets, the index and detail readers, adapters, React mounting, and the browser entry      |
| `@mokly/mokly`           | the Node shim behind the `mokly` bin, the sidecar entry, the authoring API, the guides, and the protocol documents |

`packages/mokly/package.json` describes the public ESM package `@mokly/mokly`: managed
version, MIT license, Mokly authorship, exact repository metadata, Node range
`>=22.14.0 <24.14.0 || >=24.19.0`, the `mokly` bin, the authoring export with
its types, the configuration JSON Schema at `config.schema.json`, and the file
allowlist. It lists the five platform packages as exact
optional dependencies at its own version and `@mokly/viewer` as an exact
dependency; React and React DOM are peer dependencies for React authoring only.
The shim resolves the platform package for the host, rejects a version other
than its own, and never falls back to a JavaScript implementation. The
[Rust core architecture](../architecture/rust-core.md) owns the process
topology.

Each platform package carries `os`, `cpu`, and on Linux `libc` fields, so npm
installs exactly one, and its version equals the CLI version in every release.
The viewer is an MIT ESM package with no Node-only entry; the
[shell delivery contract](./mokly-shell-delivery.md) owns its runtime boundary.
The CLI package ships `docs/guides` and `docs/protocol` at the exact package
version, so the cloud documentation site and independent upload receivers
implement that release's documented boundaries. Source fixtures, tests, plans,
caches, review artifacts, and build output other than `dist` are not published.

Read the CLI version from `packages/mokly/package.json`; `.release-please-manifest.json`
tracks release-please's version state, and `package-lock.json` mirrors package
metadata. Release pull requests update these together. `publishConfig` targets
the public npm registry with public access.

Runtime dependencies are intentional and minimal: the exact `@mokly/viewer`
dependency, the five exact optional platform packages, and the sidecar's
bundler and its PostCSS orchestration; the binary's own work needs none. CSS parsing,
exclusive directory rename, Git access, and archive encoding are in the Rust
binary and need no npm dependency. Mokly does not depend on React Native,
consumer applications, their component systems, or Playwright. Development and
browser-test packages are development dependencies. Packed dependencies cannot
use `workspace:` or `file:` links. The private workspace root and test consumers
may use local `file:` links. The root links the five platform packages through
optional dependencies; they are outside npm's workspace list, so npm skips
non-host packages. The CLI package keeps exact registry versions.

## Release Build Matrix And Publication Order

The release workflow builds the binary once per target, in one build job per
target on a runner of that operating system and architecture, with Rust 1.95.0
from `rust-toolchain.toml`. Each build job uses `scripts/release/build-native.mjs` with a locked release
build, checks native TLS dependencies, and packs its platform package with npm
11.21.0 and uploads the archive with its integrity, shasum, inventory, and size
report. A target that fails to build stops the release before any publication.

The publish job downloads the five archives, verifies that each archive's
version equals the CLI version and that its inventory holds exactly the binary
for its target, packs the viewer and then the CLI from the release checkout,
validates every packed manifest and inventory plus the runtime license closure,
and smoke-tests clean consumers from those exact archives: the CLI with its
host platform package runs `mokly --version`, `mokly build` of a minimal
catalogue, and `mokly serve`; a React host renders the viewer from every public
viewer entry in a browser bundle; a NodeNext consumer type-checks the authoring
API. The smokes install the archives, not the source tree or a workspace link,
and read protocol documents from the installed package.

Publication order is the platform packages, then the viewer, then the CLI. Each
publication completes its registry verification before the next starts, so an
installable CLI always resolves published platform packages and a published
viewer. Before each publication the workflow queries npm: a recognized
missing-version response (`E404` or `ETARGET`) permits the publish; an existing
version must match the checked report byte for byte, or the workflow fails; any
other lookup failure stops the workflow. A package that exists on the registry
with the checked bytes is verified and skipped, so a retry continues where the
earlier run stopped.

Every publication uses npm trusted publishing with OIDC from the GitHub-hosted
publish job, and each package has its own trusted publisher. After each
publish, the workflow downloads the registry artifact and rechecks integrity,
shasum, file inventory, version, optional `gitHead`, the `latest` dist-tag, and
npm signatures and provenance. Registry metadata and tarball endpoints can
become consistent at different times, so recognized missing-version or stale
dist-tag responses retry the complete check after 2, 4, 8, and 16 seconds, then
every 30 seconds until the cumulative delay reaches five minutes. Content,
provenance, and unexpected transport failures fail closed. The
[release management contract](./npm-release-management.md) owns Release Please,
the tags, and the workflow steps; the
[operations contract](./npm-release-operations.md) owns registration,
maintainer setup, and the evidence each release keeps.

## Local Verification

`cargo xtask check` is the complete repository gate. Release verification uses
`cargo xtask check --dependency-audit strict`. Both orchestrate npm, Node, and
Rust commands from the workspace root and include:

- a live audit of all workspace dependency categories: baseline mode fails on
  new issues; strict mode fails on every uncovered Low-or-higher advisory or
  invalid exception; both fail on audit errors. Mode selection and reviewed
  path exceptions follow [dependency security](./dependency-security.md);
- Prettier and ESLint;
- the file-length audits, the export and unused-member ratchets, and the
  public API report check;
- Rust formatting, workspace Clippy with warnings denied, and the Rust tests of
  every crate, which cover discovery, rendering, comparison, Serve, the static
  build, and publish against fixtures and the captured reference scenarios;
- the viewer typecheck and the Node tests of the viewer and the tooling, with a
  100% pass rate; and
- Playwright Browse and Review regressions in Chromium against `mokly serve` of
  the example catalogue, with zero retries.

Tests that mutate files use isolated temporary directories and clean up child
processes, including sidecars. The suite and shard commands, their complete
command mapping, and the fail-closed inventory evidence are defined by the
[CI verification contract](./ci-verification.md). Selected suites and shards
are partial checks; the unqualified command is the complete release gate. The
release workflow's `complete` verification mode always runs the local gate. It
runs in GitHub Actions, where `GITHUB_ACTIONS=true` forbids the remote executor
under the [remote verification contract](./remote-verification.md). Its default
`evidence` mode may instead consume a validated aggregate that proves the same
tree under the
[release verification evidence contract](./npm-release-evidence.md).

Browser assertions that depend on a navigated preview's layout wait for the
expected frame URL and the complete document state together, not only the
outer Browse URL or an iframe `src` attribute. Delayed-stylesheet regressions
exercise this boundary while keeping strict single-preview and control-state
checks. The shared browser example waits for initial `ready` or `unavailable`
Changes before opening test pages.
Loading, watch-update, and startup tests keep their independent fixtures and
exercise pending states and command-to-preview timings under the
[test timing contract](./ci-test-timing.md).

## Continuous Integration

The hosted job graph, trusted runtime profiles, checkout ownership, 30-minute
timeouts, and stable branch-rule status follow the
[CI workflow graph contract](./ci-workflow.md). Suite ownership and report
completeness follow the [CI verification contract](./ci-verification.md).
Release publishing accepts only the dual-runtime profile under the
[release verification evidence contract](./npm-release-evidence.md). The
[dependency cache and security contract](./ci-verification-security.md#dependency-cache-and-security)
owns cache inputs and install guarantees; the
[CI workflow graph contract](./ci-workflow.md) owns checkout history.

## Preview Deployments

Repository catalogue preview publication, Cloudflare Pages delivery, artifact
replacement, and pull-request cleanup follow the separate
[preview deployment contract](./npm-preview-deployments.md).

Release management and registry operations continue in
[npm Release Management](./npm-release-management.md).
