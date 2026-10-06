# Mokly CI And Npm Release Contract

Breaking-change notes: [npm release notes](./npm-release-notes.md).

## Delivery Status

Package, verification, publishing, and preview boundaries below are implemented.
Local Turbo preparation and forced release builds are implemented under
[CI Task Cache](./ci-remote-cache.md). Remote credentials remain planned.

## Package Metadata

CSS Modules delivery lazily uses the runtime `postcss-modules-local-by-default`,
`postcss-modules-extract-imports`, `postcss-modules-scope` and `icss-utils`
packages with PostCSS; its selector/value parsers are direct runtime
dependencies. Their transitive selector/value parser, `cssesc` and
`util-deprecate` packages join the package license and audit scope. The
selector and value parsers are also direct lazy runtime dependencies for
post-scoping verification; the packed graph retains one copy of each.
Lightning CSS remains a read-only rule and transformer-only inventory parser.
Packed-consumer smoke exercises CSS Modules, binary `url()` assets and a
consumer PostCSS plugin through the URL-loaded `postcss_worker.js`; package
inspection requires that worker file in the archive. See
[dependency security](./dependency-security.md)
and [imported styles](./mokly-imported-styles-modules.md).

`package.json` describes public ESM package `@mokly/mokly`: managed version, MIT
license, Mokly authorship, exact repository metadata, Node range
`>=22.14.0 <24.14.0 || >=24.19.0`, `mokly` bin, exports, types, and file
allowlist.

Read the checkout's version from `package.json`; `.release-please-manifest.json`
tracks release-please's version state, and `package-lock.json` mirrors package
metadata. Release PRs update these together. The completed one-time
[registry bootstrap](./npm-bootstrap.md) registered `@mokly/mokly@0.8.0` without
changing those release-managed files. It is the accepted initial `latest`
release and also retains the `bootstrap` tag. Do not repeat the bootstrap
publication; later reviewed releases advance `latest` through the normal release
workflow.

`publishConfig` targets the public npm registry with public access. The CLI
package contains compiled runtime code, declarations, private host modules,
README, LICENSE, CHANGELOG, package metadata, `docs/guides`, and
`docs/protocol`. The CLI guides and protocol documents ship with the exact
package version so the cloud documentation site and independent upload receivers
can implement that release's documented boundaries. Source fixtures, tests,
plans, caches, review artifacts and generated demo output are not published.

The repository also builds the `@mokly/viewer` workspace, initially version
0.1.0. Its MIT ESM distribution owns shell assets, public data readers,
adapters, React mounting and Node-only SSR. The CLI declares an exact registry
version dependency. Root build, clean, formatting, lint, typecheck and package
gates cover both packages. Pack the viewer first; local smoke and release
fixtures install both tarballs explicitly so an unpublished viewer is never
resolved from the registry. Consumer fixtures exercise every public viewer
entry, SSR of the [public v4 fixture](./fixtures/catalogue-v4.json) in
`scripts/package/viewer.mjs` (`smokeViewer`), browser bundle boundaries and
NodeNext declarations. Both manifests, packed metadata, export targets,
allowlists, licenses, React peers and the exact viewer dependency are checked.
Packed dependencies cannot use `workspace:` or `file:` links; local links exist
only in the test consumer's install manifest. Archive regressions exercise the
checkout version and several later viewer versions; intentionally mismatched
dependencies are derived from each packed viewer's actual version, so future
release PRs cannot invalidate the test.

Runtime dependencies are intentional and minimal. Mokly does not take a runtime
dependency on consumer applications, their component systems, or Playwright.
Development and browser-test packages remain development dependencies. The
exporter's Koffi dependency supplies OS-enforced exclusive directory rename; its
optional platform binaries must remain available for export. The native bridge
is lazy and does not load for build/check/serve or help. The standalone CSS rule
parser uses the production `lightningcss` dependency. Keep its optional native
packages installed: Linux x64 glibc, macOS arm64/x64, and Windows x64 binaries
cover the CI runners. Its Node floor is below Mokly's 22.14 floor. The installed
Node package has no automatic WASM fallback; upstream's separate
`lightningcss-wasm` package is not a Mokly dependency. Publish uses `tar-stream`
to encode finalized export bytes as portable USTAR/PAX without invoking a
platform tar executable or walking the output again.

## Local Verification

`cargo xtask check` is the complete repository and release gate. It orchestrates
npm, Node and Rust commands from the workspace root and includes:

- a live audit of all workspace dependency categories, failing on any uncovered
  Low-or-higher advisory, invalid exception, or registry error; reviewed path
  exceptions follow [dependency security](./dependency-security.md);
- formatting and lint checks;
- TypeScript typechecking with no unexplained source exclusions;
- unit and integration tests with a 100% pass rate;
- production build and declaration generation;
- an example `check` that validates the derived compilation and rejects tracked
  generated output;
- package-file inspection with `npm pack --dry-run --json`;
- packed-tarball installs in clean ESM, NodeNext, and themed consumers;
- a strict production-dependency audit of the freshly resolved packed ESM
  consumer, with no workspace audit exceptions;
- local-npx and clean-cache npx-style execution from the packed artifact;
- consumer exports from the installed CLI, including custom configs/bases,
  cross-platform renderers, registered pages, and the compiled static client
  graph;
- installed `publish` uploads with and without comparisons to a local receiver,
  inspecting the gzip tarball, documented metadata and exact exported bytes;
- source-tree ESM, declaration, CLI, workspace-resolution, server, Review, and
  watched-runtime regressions;
- Playwright Browse and Review regressions using Chromium, including isolated
  exact-file exports after source removal and the actual Cloudflare runtime; and
- Rust formatting, Clippy and tests, plus repository-wide changed-source and
  Rust file-length audits.

Tests that mutate files use isolated temporary directories and clean up child
processes. Package smokes execute the packed artifact, not the source tree or a
workspace symlink. Historical cross-repository parity audits are release
evidence rather than recurring CI dependencies on other repositories. The
independent suite and shard commands, including their complete command mapping
and fail-closed inventory evidence, are defined by the
[CI verification contract](./ci-verification.md). Selected suites and shards are
partial checks; the unqualified command remains the complete release gate. The
release workflow's `complete` verification mode runs this command directly. Its
default `evidence` mode may instead consume a validated aggregate that proves
the same tree under the
[release verification evidence contract](./npm-release-evidence.md).

Task caching does not change evidence selection or exact-artifact checks.
`release.yml` sets `TURBO_FORCE=true`, uses local cache only, and has no Turbo
token and signature variables. Complete-mode preparation and every real
`prepack` must execute; applicable CI reports cannot authorize cached release
build outputs. Hosted telemetry is disabled. Every prepack build keeps stdout
empty so `npm pack --json` parses only the archive report; lifecycle builds run.

Browser assertions that depend on a navigated preview's layout wait for the
expected frame URL and complete document state together, not only the outer
Browse URL or an iframe `src` attribute. Delayed-stylesheet regressions exercise
this boundary while retaining strict single-preview and control-state checks.
The shared browser example waits for initial `ready` or `unavailable` Changes
before opening test pages; completing Usage is not final publication. Loading,
watch-update and startup-performance tests keep their independent fixtures and
must continue to exercise pending states and command-to-preview timings.

## Continuous Integration

The hosted job graph, trusted runtime profiles, checkout ownership, 30-minute
timeouts, and stable branch-rule status follow the
[CI workflow graph contract](./ci-workflow.md). Suite ownership and report
completeness follow the [CI verification contract](./ci-verification.md).
Release publishing accepts only the dual-runtime profile under the
[release verification evidence contract](./npm-release-evidence.md).
The [CI verification contract](./ci-verification-security.md#dependency-cache-and-security)
owns cache inputs and install guarantees; the
[CI workflow graph contract](./ci-workflow.md) owns checkout history.

## Preview Deployments

Repository catalogue preview publication, Cloudflare Pages delivery, artifact
replacement, and pull-request cleanup follow the separate
[preview deployment contract](./npm-preview-deployments.md).

Release management and registry operations continue in
[npm Release Management](./npm-release-management.md).
