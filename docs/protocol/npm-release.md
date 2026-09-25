# Mokly CI And Npm Release Contract

## Breaking Page Upgrade Release Note

The page release intentionally removes `legacy` configuration and its exported
types, automatic `.source` discovery, comment-component expansion, legacy lint
options, and route aliases. Consumers must register complete documents with
`definePage` or nested `page`, import existing render helpers, preserve explicit
routes, and regenerate manifest v5 with `sourceFiles`. Current v2/v3 output is
rejected; historical readers remain available only for Git comparisons. Follow
[the migration procedure](./mokly-page-migration.md) before replacing old
owned artifacts. Screen and use-case authoring remains supported.

The repository preview command now exports the current catalogue by default.
Use `--include-changes` to package a frozen baseline and comparisons. Both
options omit development updates. Release automation must record these changes
as breaking; version numbers and `CHANGELOG.md` remain release-PR owned.

## Package Metadata

`package.json` describes the published, scoped public ESM package `@mokly/mokly`,
with a release-managed version, MIT licensing, Mokly authorship, exact
repository/bugs/homepage metadata for `mokly-ai/mokly`, the Node engine range
`>=22.14.0 <24.14.0 || >=24.19.0`, one `mokly` bin, explicit exports/types, and
a restrictive `files` allowlist.

Read the checkout's version from `package.json`; `.release-please-manifest.json`
tracks release-please's version state, and `package-lock.json` mirrors package
metadata. Release PRs update these together. The completed one-time
[registry bootstrap](./npm-bootstrap.md) registered `@mokly/mokly@0.8.0` without
changing those release-managed files. It is the accepted initial `latest`
release and also retains the `bootstrap` tag. Do not repeat the bootstrap
publication; later reviewed releases advance `latest` through the normal
release workflow.

`publishConfig` targets the public npm registry with public access. The CLI package
contains compiled runtime code, declarations, private host modules,
README, LICENSE, CHANGELOG, package metadata, `docs/guides`, and
`docs/protocol`. The CLI guides and protocol documents ship with the exact
package version so the cloud documentation site and independent upload
receivers can implement that release's documented boundaries. Source fixtures,
tests, plans, caches, review artifacts and generated demo output are not
published.

The repository also builds the `@mokly/viewer` workspace, initially version 0.1.0. Its
MIT ESM distribution owns shell assets, public data readers, adapters, React
mounting and Node-only SSR. The CLI declares an exact registry version dependency.
Root build, clean, formatting, lint, typecheck and package gates cover both
packages. Pack the viewer first; local smoke and release fixtures install both
tarballs explicitly so an unpublished viewer is never resolved from the registry.
Consumer fixtures exercise every public viewer entry, SSR of the public v1
fixture, browser bundle boundaries and NodeNext declarations. Both manifests,
packed metadata, export targets, allowlists, licenses, React peers and the exact
viewer dependency are checked. Packed dependencies cannot use `workspace:` or
`file:` links; local links exist only in the test consumer's install manifest.
Archive regressions exercise the checkout version and several later viewer
versions; intentionally mismatched dependencies are derived from each packed
viewer's actual version, so future release PRs cannot invalidate the test.

Runtime dependencies are intentional and minimal. Mokly does not take a
runtime dependency on consumer applications, their component systems, or
Playwright. Development and browser-test packages remain development
dependencies.
The exporter's Koffi dependency supplies OS-enforced exclusive directory rename;
its optional platform binaries must remain available for export. The native
bridge is lazy and does not load for build/check/serve or help.
The standalone CSS rule parser and imported CSS Modules transformation use the
production `lightningcss` dependency.
Packed-consumer smoke also exercises a CSS Module, its binary `url()` asset,
and a local PostCSS plugin through the URL-loaded `postcss_worker.js`; package
inspection requires that worker file in the published archive.
Keep its optional native packages installed: Linux x64 glibc, macOS arm64/x64,
and Windows x64 binaries cover the CI runners. Its Node floor is below Mokly's
22.14 floor. The installed Node package has no automatic WASM fallback;
upstream's separate `lightningcss-wasm` package is not a Mokly dependency.
Publish uses `tar-stream` to encode finalized export bytes as portable USTAR/PAX
without invoking a platform tar executable or walking the output again.

## Local Verification

`cargo xtask check` is the complete repository and release gate. It delegates
to npm scripts and includes:

- a live audit of all workspace dependency categories, failing on any known
  advisory or registry error;
- formatting and lint checks;
- TypeScript typechecking with no unexplained source exclusions;
- unit and integration tests with a 100% pass rate;
- production build and declaration generation;
- an example `check` that validates the derived compilation and rejects tracked
  generated output;
- package-file inspection with `npm pack --dry-run --json`;
- packed-tarball installs in clean ESM, NodeNext, themed, and alternate-layout
  consumers;
- a production-dependency audit of the freshly resolved packed ESM consumer;
- local-npx and clean-cache npx-style execution from the packed artifact;
- consumer exports from the installed CLI, including custom configs/bases,
  cross-platform renderers, registered pages, and the compiled static client graph;
- installed `publish` uploads with and without comparisons to a local receiver,
  inspecting the gzip tarball, documented metadata and exact exported bytes;
- source-tree ESM, declaration, CLI, workspace-resolution, server, Review, and
  watched-runtime regressions;
- Playwright Browse and Review regressions using Chromium, including isolated
  exact-file exports after source removal and the actual Cloudflare runtime; and
- Rust formatting, Clippy, tests, and file-length audits for `xtask`.

Tests that mutate files use isolated temporary directories and clean up child
processes. Package smokes execute the packed artifact, not the source tree or a
workspace symlink. Historical cross-repository parity audits are release
evidence rather than recurring CI dependencies on other repositories.
The independent suite and shard commands, including their complete command
mapping and fail-closed inventory evidence, are defined by the
[CI verification contract](./ci-verification.md). Selected suites and shards
are partial checks; the unqualified command remains the complete release gate.
The release workflow's `complete` verification mode runs this command directly.
Its default `evidence` mode may instead consume a validated aggregate that
proves the same tree under the
[release verification evidence contract](./npm-release-evidence.md).

Browser assertions that depend on a navigated preview's layout wait for the
expected frame URL and complete document state together, not only the outer
Browse URL or an iframe `src` attribute. Delayed-stylesheet regressions exercise
this boundary while retaining strict single-preview and control-state checks.
The shared browser example waits for initial `ready` or `unavailable` Changes
before opening test pages; completing Usage is not final publication. Loading,
watch-update and startup-performance tests keep their independent fixtures and
must continue to exercise pending states and command-to-preview timings.

## Continuous Integration

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`, with
read-only repository contents permission and concurrency cancellation for
superseded validation. An audit-first repository job gates independent package
jobs, four unit shards, four browser shards, and focused macOS/Windows native
jobs. Ordinary pull requests and `main` pushes run the functional suites on the
minimum supported Node 22.14 runtime. Same-repository Release Please pull
requests add Node 24 to every functional suite, while the shared repository job
resolves the latest Node 24 patch for every event. An explicit capture step
passes that exact patch to every selected Node 24 job. Chromium is installed
only by browser jobs. Every npm-running job installs npm 11.7.0 and runs
`npm ci`. CI caches only npm downloads and includes the merge-base lockfile in
cache keys for jobs that build historical baselines.

The stable `Required CI` branch-rule status fails unless every prerequisite
result is exactly successful and the event-selected eight or sixteen
unit/browser reports prove the expected commit, runtimes, shards, and complete
test inventories. Only a same-repository branch with the Release Please prefix
or autorelease label can select the dual-runtime profile. Stable report artifact
names support failed-job and whole-workflow reruns by replacing each shard's
evidence; browser traces remain attempt-specific. Full Git history is available
where baseline resolution requires `origin/main`. Action revisions are
immutable commit hashes with reviewed version comments, runtime versions are
explicit, and fork pull requests receive no release secrets or write
permissions. The [CI verification contract](./ci-verification.md) defines the
complete graph, evidence, caching, and failure semantics.

## Preview Deployments

The [publication option](./mokly-publication.md) is implemented. The main
job publishes the current catalogue with `npm run preview:build`; PR previews
use `npm run preview:build -- --include-changes --base origin/main`.

The [consumer static exporter](./mokly-export.md) provides shared output safety and static
delivery. This section describes the repository's deployment adapter;
consumer `mokly export` produces files without deploying or publishing npm.

`.github/workflows/preview.yml` deploys a browsable copy of the synthetic basic
consumer to the existing direct-upload Cloudflare Pages project `mokabook`. The
infrastructure identifier remains unchanged during the npm rename. A `main`
push updates the production deployment at `https://mokabook.pages.dev`.
Same-repository pull requests, except Release Please pull requests, deploy to a
stable `pr-<number>` branch alias and receive one updated sticky comment with
the deployment result, URL, commit, and workflow run. Fork pull requests never
receive Cloudflare credentials or write-capable execution.

`npm run preview:build` first rebuilds Mokly and its derived basic consumer.
The repository-only preview builder starts the real Browse server on
an ephemeral loopback port and snapshots the home, not-found, current catalogue
routes, plus removed-entry routes only when Changes is included. It copies the shell stylesheet, browser and
shared navigation modules, fonts, id redirects, and every validated public
consumer asset into `.context/mokly-preview`. HTML copies pass through the
same manifest/header-aware logical-link adapter as served Browse; unowned
reserved metadata is removed and invalid trusted output fails the build.
Preview shell links use Cloudflare
Pages' canonical extensionless HTML routes, and static shell HTML omits the
watched server's live-update entrypoint. The parent client validates one optional
`fragment` query and applies its encoded hash to every applicable current and
light/dark frame source, with first-step-only use-case scope. Default capture needs no Git or comparison provider and omits review controls,
counts, removed routes, and baseline artifacts. Explicit Changes capture pins
one merge-base commit for impact and screen and saved component comparisons and rejects any input
mutation during capture. It packages comparison JSON and isolated resources
under an immutable generation path; visitors fetch them only after selecting a
diff. Refresh loads that same published result. Unavailable requested baselines
or invalid comparisons abort the build without replacing previous output.
Both options omit the live-update entrypoint, watch-only modules, event routes,
and stale comparison directories. Full history remains available in both jobs.
Static shell metadata addresses an included comparison generation directly;
the stable comparison redirect remains available when Changes is enabled.
Eligible shown views offer comparison controls; known unchanged views show
Unmodified. Missing per-view evidence uses route-level status and eligibility;
absent change evidence never invents a status. Pages retain Changes membership
but never offer visual comparisons.
The [Changes contract](./mokly-changes.md) owns the shared interaction and
snapshot rules. Artifact
replacement uses the shared exclusive reservation, ownership inventory, and
rollback transaction. Only this adapter can migrate a valid legacy
`.mokly-preview-artifact` directory; consumer export cannot claim it.

Closing a same-repository pull request marks its sticky comment inactive and
attempts to delete all Cloudflare deployments carrying that PR branch alias.
Cleanup failures retain the deployment and report why rather than hiding the
failure. Superseded runs for the same main ref or pull request are cancelled.
All workflow actions use immutable commit hashes and Wrangler is lockfile-pinned.
The [dependency security contract](./dependency-security.md) owns the audit
gate and scoped Miniflare overrides, including their removal conditions.

The remaining contract is continued in [Release Management And Evidence](./npm-release-management.md).
