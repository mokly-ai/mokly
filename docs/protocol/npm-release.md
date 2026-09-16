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
repository/bugs/homepage metadata for `mokly-ai/mokly`, a Node engine floor,
one `mokly` bin, explicit exports/types, and a restrictive `files` allowlist.

Read the checkout's version from `package.json`; `.release-please-manifest.json`
tracks release-please's version state, and `package-lock.json` mirrors package
metadata. Release PRs update these together. The completed one-time
[registry bootstrap](./npm-bootstrap.md) registered `@mokly/mokly@0.8.0` without
changing those release-managed files. It is the accepted initial `latest`
release and also retains the `bootstrap` tag. Do not repeat the bootstrap
publication; later reviewed releases advance `latest` through the normal
release workflow.

`publishConfig` targets the public npm registry with public access. The package
contains compiled runtime code, declarations, package-owned shell assets,
README, LICENSE, CHANGELOG, package metadata and `docs/protocol`. The protocol
documents ship with the exact package version so independent upload receivers
can implement its documented file boundary. Source fixtures, tests, plans,
caches, review artifacts and generated demo output are not published.

Runtime dependencies are intentional and minimal. Mokly does not take a
runtime dependency on `@firna/ui`, Accounting, Juno, Playwright, or a consumer's
component system. Development and browser-test packages remain development
dependencies.
The exporter's Koffi dependency supplies OS-enforced exclusive directory rename;
its optional platform binaries must remain available for export. The native
bridge is lazy and does not load for build/check/serve or help.
The standalone CSS rule parser uses the production `lightningcss` dependency.
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
- a byte-stable example `check` against committed generated output;
- package-file inspection with `npm pack --dry-run --json`;
- packed-tarball installs in clean ESM, NodeNext, Accounting-shaped, and
  Juno-shaped consumers;
- a production-dependency audit of the freshly resolved packed ESM consumer;
- local-npx and clean-cache npx-style execution from the packed artifact;
- consumer exports from the installed CLI, including custom configs/bases,
  cross-platform renderers, registered pages, and the compiled static client graph;
- the site's build, typecheck, unit tests, static link check and browser smoke
  tests through `npm run site:check`, after `package:smoke` and before `test:browser`;
- installed `publish` uploads with and without comparisons to a local receiver,
  inspecting the gzip tarball, documented metadata and exact exported bytes;
- source-tree ESM, declaration, CLI, workspace-resolution, server, Review, and
  watched-runtime regressions;
- Playwright Browse and Review regressions using Chromium, including isolated
  exact-file exports after source removal and the actual Cloudflare runtime; and
- Rust formatting, Clippy, tests, and file-length audits for `xtask`.

Tests that mutate files use isolated temporary directories and clean up child
processes. Package smokes execute the packed artifact, not the source tree or a
workspace symlink. The temporary real-Accounting parity audit is release
evidence rather than a recurring CI dependency on another repository.

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
superseded validation. Its two independent verification jobs run the complete
gate on Ubuntu:

- the minimum supported Node 22.14.0 with npm 11.7.0; and
- release Node 24 with npm 11.7.0.

Both install Rust 1.95.0, install Chromium, and run `cargo xtask check`.
The minimum-runtime job installs with `npm ci --engine-strict`; the release
job uses `npm ci`. The lockfile engine test checks compatibility with the root
package's declared Node 22.14.0 minimum independently of the running Node version.
Focused macOS and Windows jobs additionally run native export move,
destination-race, and CSS rule parser/diff tests at the minimum Node version.
The Ubuntu complete gates also exercise CSS parsing on Node 22.14 and 24.
The `Required CI` aggregator requires `minimum-runtime`, `release-runtime`,
`export-platforms` (both matrix entries) to succeed and is
the branch-rule status to require. Both complete gates include the public site's
`site:check` through `cargo xtask check`; the root lockfile and dependency audit
cover the site workspace. The separate Ubuntu `site-lighthouse` job uses Node
24, npm 11.7.0, `npm ci` and Playwright-installed Chromium. Only this job installs
the separately locked audit tools with `npm ci --prefix site/lighthouse --engine-strict`,
audits their lockfile at all severities and typechecks their runner. It builds the package,
example catalogue and site in that order, and runs `npm run site:lighthouse`.
It preserves a failing audit's exit status and uploads the text budget report
and diagnostics from `test-results/site-lighthouse/` on failure. This job is
report-only, with `continue-on-error: false` so failures remain visible, and is
excluded from `Required CI`. Deterministic accessibility assertions for every
site route run in both required complete gates instead. The
[site delivery contract](./site-delivery.md) fixes its budget and settings.
CI checks out complete Git history in both full verification jobs so the preview regression
can resolve `origin/main`, and uses `npm ci` with the committed lockfile. Action
revisions are immutable commit hashes with reviewed version comments; runtime
versions are explicit. Fork pull requests receive no release secrets or write
permissions.

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

`npm run preview:build` first rebuilds Mokly and its committed basic
consumer. The repository-only preview builder starts the real Browse server on
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
Eligible changed views offer comparison controls; known unchanged views show
Unmodified, while unknown evidence has no invented status. Pages retain Changes
membership but never offer visual comparisons.
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

### Website

`.github/workflows/site.yml` independently deploys the public website from
`site/dist` to the direct-upload Pages project `mokly-site`. Both deploy jobs
use Node 24, npm 11.7.0 and `npm ci`, build Mokly and the example catalogue
before the site, then use lockfile-pinned `npx --no-install wrangler pages deploy`.
They reuse repository variable `CLOUDFLARE_ACCOUNT_ID` and secret
`CLOUDFLARE_PAGES_API_TOKEN` or its fallback `CLOUDFLARE_API_TOKEN`, through
step environments only. Missing deployment configuration fails explicitly.

Pushes to `main` deploy production using repository variables `SITE_ORIGIN`
and `SITE_APP_ORIGIN`. Same-repository, non-release PRs deploy their head commit
to `https://pr-<number>.mokly-site.pages.dev`, also used as their build's
`SITE_ORIGIN`. Both use repository variable `SITE_STAGE_PR` or the documented
fallback `71` from `CHANGELOG.md`; PRs keep the configured app origin.
Forks and Release Please branches/labels are excluded from deploy and close.
Superseded runs share a `site-<PR number or ref>` cancellation group.

The bot's separate `<!-- mokly-site -->` comment reports status, target URL,
commit and run, including failures. Close marks it inactive and reports
cleanup results. The ported `scripts/site/cleanup.sh` follows the catalogue's
retained/deleted reporting, traverses every deployment page before deletion,
checks API success as well as HTTP status, and deletes only the PR's branch
deployments. No cleanup error is presented as successful deletion.
The [site setup](./site-delivery.md#maintainer-setup) records the project creation
command and domain attachment. A merge to `main` releases the site immediately;
it has no separate version or npm publication.

## Release Management

Conventional Commits feed release-please's Node release strategy through
`release-please-config.json` and `.release-please-manifest.json`. A push to
`main` creates or updates a release PR; an ordinary push with no release does
not publish. The release PR owns `CHANGELOG.md`, `package.json`,
`package-lock.json`, and the release-please manifest. A maintainer reviews and
merges it after required checks pass to create the immutable
`vX.Y.Z` tag and GitHub release.

The release workflow then:

1. Selects only the release-please tag, or an explicitly supplied manual tag.
2. Checks out that tag with history on a GitHub-hosted runner.
3. Installs Node 24, npm 11.7.0, Rust 1.95.0, and Chromium without a package
   cache.
4. Verifies the local and remote tag identify `HEAD`, the tree is clean, and
   the tag exactly matches the package version.
5. Runs `npm ci` and the complete `cargo xtask check` gate.
6. Creates one exact tarball, validates its allowlist and license closure, and
   records its integrity, shasum, file inventory, and size report.
7. Queries npm. A recognized missing-version response (`E404` or `ETARGET`)
   permits a publish; any other lookup failure stops the workflow. An existing
   version must byte-for-byte match the checked report and commit or the
   workflow fails.
8. Uploads the exact checked artifact, then publishes that same path publicly
   with npm trusted publishing when it is not already present.
9. Downloads the registry artifact and rechecks integrity, shasum, file
   inventory, version, optional `gitHead`, the `latest` dist-tag, and npm
   signatures/provenance. Because npm metadata and tarball endpoints may become
   consistent at different times, recognized missing-version or stale dist-tag
   responses retry the complete check with bounded backoff; content,
   provenance, and unexpected transport failures remain fail-closed.

Publishing occurs in the same workflow invocation that creates the GitHub
release. A manual `publish_ref` dispatch from workflow ref `main` may retry an existing `vX.Y.Z` tag and
runs the identical verification path. Concurrency never cancels an in-progress
publish.

The publish job alone receives `id-token: write`, plus read-only contents, and
runs in the protected GitHub environment named `npm`. Release-please receives
only contents, pull-request, and issue write permissions. Prefer a
repository-owned fine-grained token or GitHub App credential in the
`RELEASE_PLEASE_TOKEN` secret so release PR events trigger normal checks. The
workflow falls back to `GITHUB_TOKEN`; GitHub suppresses most follow-on workflow
events created with that token, so maintainers must verify the release PR's
required checks when using the fallback.

## Mokly Registry Bootstrap

The repository and release history moved from `futex-ai/mokabook` to
`mokly-ai/mokly`, but npm package names do not move with GitHub repositories.
The former unscoped `mokabook` package remains reserved at `0.8.0`; it is not a
runtime alias or a second publication target. Because npm trusted publishing can
only be configured after a package exists, the scoped `@mokly/mokly` package
required one reviewed bootstrap publication before normal releases could use OIDC.
The attempted unscoped `mokly` registration was rejected by npm's name-similarity
policy; it was never published. The scope change does not reset release history
or rename the `mokly` executable.

Registration completed on 14 September 2026 as `@mokly/mokly@0.8.0`. npm assigned
both `bootstrap` and `latest` despite the explicit bootstrap tag, and the
maintainer accepted that initial `latest`. Keep `bootstrap` on `0.8.0`; do not
remove `latest` or republish to undo registration. The
[bootstrap record](./npm-bootstrap.md) retains the reviewed source and archive
procedure. Its dedicated `scripts/release/bootstrap.mjs` command builds a fresh
isolated checkout of an explicit reviewed full commit SHA and records source
identity beside the archive hashes; ordinary `pack.mjs` does not supply this
bootstrap source proof.

The bootstrap used interactive maintainer authentication, not OIDC. Trusted
publishing is configured, but GitHub release-token permissions and publishing
protections still need verification, followed by a successful automated release
and its provenance verification. Accepting initial `latest` does not waive any
of those requirements or reset release-please state.

## Maintainer Setup

Before enabling publish, maintainers must configure and verify:

- repository Actions may create pull requests, and the default workflow token
  has only the permissions declared in each workflow;
- the branch rule requires the exact `Required CI` status;
- the direct-upload Cloudflare Pages project `mokabook` exists with production
  branch `main`, repository variable `CLOUDFLARE_ACCOUNT_ID` is set, and
  repository secret `CLOUDFLARE_PAGES_API_TOKEN` or `CLOUDFLARE_API_TOKEN`
  holds a least-privilege token with Pages write access;
- the protected `npm` environment allows only the workflow's `main` branch,
  requires an approved reviewer, and disables administrator bypass, without
  storing an npm token. Checking out a release tag does not change the workflow
  deployment ref; manual retries must also dispatch from `main`;
- the `RELEASE_PLEASE_TOKEN` credential owner, least-privilege repository
  access, expiry/rotation, and fallback behavior;
- approved Mokly npm maintainer accounts and teams, enforced 2FA, public
  scoped-package access, and the intended initial owner list;
- the trusted-publisher repository, workflow filename, environment, and publish
  action exactly match the values above; and
- immutable `v*` tag update/deletion protection and who may invoke the manual retry.

No long-lived npm write token is stored in GitHub Actions.
See [GitHub publishing protections](./npm-github-protections.md) for exact setup,
read-back verification, sole-maintainer approval policy, and credential blockers.

## Release Evidence

Each release records the checked commit, package version, uploaded tarball and
pack report, verification result, GitHub release, npm URL, provenance/signature
result, and smoke-test result. A failed publish never changes the tag or
rebuilds from a branch; the manual retry accepts only the existing immutable
`vX.Y.Z` tag and repeats the identical path.

## Current External Requirements

Implementation must re-check these primary references because release tooling
changes over time:

- [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/)
- [npm scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [npm package executables](https://docs.npmjs.com/cli/npm-exec/)
- [npm package metadata](https://docs.npmjs.com/files/package.json/)
- [release-please action](https://github.com/googleapis/release-please-action)

As rechecked on 20 July 2026, npm trusted publishing requires Node 22.14 or
newer and npm 11.5.1 or newer; the `npm trust` management command requires npm
11.15 or newer.
The package must already exist before a trust relationship can be configured.
The workflow's npm 11.7.0 satisfies publishing; use npm 11.15 or newer only for
the separate interactive trust-management command. Trusted publishing creates
provenance automatically on supported GitHub-hosted runners.

## Related Docs

- [Package and authoring contract](./mokly-package.md)
- [Build, Browse, and Review runtime](./mokly-runtime.md)
