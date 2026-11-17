# Repository Verification

This is the verification and CI sub-contract of
[Repository layout](./repository-layout.md).

## Verification: `cargo xtask check`

`cargo xtask check` runs the 25 stages below in order and fails on the first
failure. Every stage is active. Activation is a code change in `xtask`, not
runtime detection, so a stage can never be skipped by accident. Each stage is
also runnable on its own as a named `xtask` subcommand, and every checker
rejects a violation that a failing fixture in its tests reproduces.

1. Toolchain pins: `rust-toolchain.toml`, `.nvmrc`, `engines`,
   `packageManager` and the fixture packer's `devDependencies.tar` agree with
   the [pin table](./repository-layout.md#pinned-toolchains)
2. `npm ci` (installs Prettier, ESLint, ast-grep, TypeScript,
   Playwright, Astro, Lighthouse, and `@mokly/mokly` from the lockfile)
3. `cargo fmt --all -- --check`
4. `cargo clippy --workspace --all-targets -- -D warnings`
5. `cargo test --workspace`
6. Rust file-length lint (300-line cap; changed files by default, `--all`
   for the whole tree)
7. ast-grep rules under `rules/` against `crates/`, `xtask/`, and `apps/app/src`
8. Untracked whitespace check (trailing whitespace, missing final newline)
9. Markdown link check: every local link in `*.md` resolves, including the
   root-relative routes between legal-site Markdown documents, and every
   `#fragment` on a link to a Markdown document names one of its heading
   anchors
10. Prettier check on the repository
11. ESLint on the repository's JavaScript and TypeScript, with the
    exclusions that [Repository TypeScript layout](./repository-typescript.md#tooling)
    names
12. Migration immutability against `crates/mkc-db/migration-lock.txt`
13. `npm run typecheck`
14. `npm test --workspace @mokly-cloud/app` (app logic tests, the
    web build, then the browser tests, which start the real API and skip aloud
    only when Postgres is unreachable; stage 15 runs the mockup suites)
15. Mockups: `npm run mockups:build`, `npm run mockups:check`,
    `npm run mockups:test`, then `npm run mockups:typecheck`. Two independent
    builds must have identical paths and bytes; a difference fails with the
    differing paths.
16. Site: `npm run mockups:build`, then `npm run site:check`.
    `site:check` runs site build, typecheck, unit, link and browser checks.
    Missing or stale site output fails. The stage builds the mockups itself,
    including on its own fresh CI runner; it never depends on stage 15's
    filesystem.
17. OpenAPI drift: `cargo xtask openapi --check` regenerates the OpenAPI
    document from Rust and the TypeScript client from that document. Both
    must equal the committed `docs/api/openapi.json` and the committed client
    under `apps/app/src/api/generated/`; the check reports the first differing
    line in either file
18. Contract fixtures: `cargo xtask mokly-fixtures --check` proves the
    committed fixtures match the pinned `@mokly/mokly` output and parses the
    frozen synthetic catalogue tarball through the Rust consumer; regenerate with
    `cargo xtask mokly-fixtures` per [compatibility](./mokly-artifact-compatibility.md)
19. Email templates: `cargo xtask email-templates --check` compares the six
    committed files with the mockup definitions and runs the generator's
    mutation test; `cargo xtask email-templates` regenerates them
20. OpenAPI lint: check the generated JSON document's `x-reasons` against the
    REST reason catalogue, reserved and deferred reason rules, backtick reason
    mentions, and GitHub subscription delivery fixtures
21. Terraform: recursive format check, backend-free initialization, provider
    validation and `terraform test` for every root and module
22. Origin router: TypeScript check and Workers test-pool tests from
    `apps/worker` after the locked install in stage 2
23. Helm: strict lint, full environment golden renders, rejected typed settings
    and workload-setting parity with `docs/ops/environment.md`
24. Infrastructure tests: HTTP smoke, input and cleanup tests, Dockerfile
    contracts, a bounded BuildKit storage comparison, and the
    API/catalogue/app image builds with pinned BuildKit when installed
25. Desktop: `@mokly-cloud/desktop` logic tests, the web export it bundles,
    then its Electron smoke test against that export and the real API, under
    `xvfb-run` on Linux

The shared route inventory is enforced by Rust route-reservation tests (stage
5), site generation/build drift checks (stage 16), Worker tests (stage 22) and
cross-source infrastructure tests (stage 24). These compare the site route
table, built outputs, generated Worker module and reserved workspace names.

File discovery includes existing tracked and untracked files and respects Git
ignores. [Repository generated files](./repository-generated-files.md) owns the
rules that exclude derived mockup output and baseline caches; the contract
golden files, OpenAPI document and TypeScript client stay tracked.
Stage 6 uses paths changed against `origin/main` plus untracked paths;
`--all` audits all Rust files. Stage 8 checks all Git-visible text files for
trailing spaces/tabs and missing final newlines, skips binary data (NUL bytes
or invalid UTF-8), and permits empty files. Stage 9 parses CommonMark inline,
reference, and image links, resolving URL-decoded file and directory paths
relative to the source document (leading `/` means repository root). It
excludes queries, external URLs, and code examples. Under
`apps/site/src/content/legal/`, a one-segment root route resolves to its sibling
Markdown source (`/privacy/` → `privacy.md`) so both source ownership and the
published destination remain explicit. A `#fragment` on a link to a Markdown
document must name a heading anchor of that document as GitHub derives it from
the heading text, and a fragment alone names a heading of the same document; a
fragment on any other destination is not checked. The checker does not fetch
remote links. Explicit undefined references fail. Stage 7
tests rule acceptance/rejection fixtures before scanning Rust.

The CLI and all stage subcommands are documented in [xtask](../../../xtask/README.md).

The infrastructure stages never require credentials. `terraform` runs
recursive format checking, initialization without a backend, provider
validation and `terraform test` for all roots and modules; `helm` runs strict
lint, full environment golden renders, typed-value rejection cases and
bidirectional runtime-setting documentation parity; `infrastructure-tests`
runs HTTP smoke/input/cleanup and Dockerfile contracts, compares bounded
BuildKit storage, then builds the API, catalogue, and app images with pinned
standalone BuildKit when installed. CI installs and starts BuildKit; local
absence prints the install command. CI runs a separate real read-only plan
only on trusted main pushes with both workload-identity names configured and
prints an explicit skip reason otherwise. The deploy workflow separately plans
and applies each exact saved stable-environment plan after merge. An
unauthenticated mock plan is never reported as a cloud deployment.

Stage 22, `origin-router`, runs the `@mokly-cloud/worker` typecheck and
Workers test-pool tests. It belongs to the hosted `workspace-check` partition
and needs no cloud credential.

Stage 25: `desktop` runs the
`@mokly-cloud/desktop` logic tests and its Electron smoke test, which starts
the real API through the application harness and needs Postgres, the
Playwright system dependencies and `xvfb`. It belongs to the hosted
`desktop-check` partition and needs no cloud credential. Every other
partition sets `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, so the locked install never
downloads Electron where nothing runs it.

## CI

`.github/workflows/ci.yml` derives six fresh-runner partitions from the same
canonical contract that `cargo xtask check` runs locally. An eight-entry matrix
runs `workspace-check` (stages 1–13 and 17–23 plus non-image infrastructure
contracts), `app-check` (stage 14) as four [App shards](#app-shards),
`mockups-check` (stage 15), `site-check` (stage 16) and `desktop-check`
(stage 25) concurrently. `workload-images`
owns the bounded storage smoke and all three real image builds from stage 24.
The desktop partition provides Postgres, Playwright system dependencies and
`xvfb`. Every canonical task belongs to
exactly one hosted partition. Each partition runs as one CI job, except
`app-check`, which runs as four shard jobs. The aggregate `required` job
depends on the image partition, the credential gate and the complete matrix,
which includes all four App shard jobs. It rejects failure, cancellation or
skip from any of them. Superseded runs for the same
pull request or ref are cancelled. Pinned action SHAs apply on pull requests
and `main`; deploy, foundation and preview workflows are documented under
`docs/ops/`.
The separate desktop release workflow packages pull requests without secrets
and signed pre-releases from `desktop-v*` tags. Stage 5 tests its triggers,
platforms, permissions, action pins, tag/version check and deployment-owned
origins. Stage 16 includes its actions in the reviewed allowlist. Its packaged
launch smoke and artifacts are defined in
[Desktop distribution](./desktop-distribution.md).
The npm cache is keyed on the npm workspace's single lockfile,
`package-lock.json`, and each Rust-heavy partition restores dependency
build output through a reviewed, immutable cache action pin keyed on its own
partition command. The four App shard jobs share the `app-check` key, because
they build the same output. Workflow fixture tests reject a missing or
incorrect cache dependency path.

CI installs npm dependencies and the locked Playwright Chromium with
`--with-deps` before the desktop, app, mockup and site partitions and the Site
Lighthouse job. These jobs share cached system package downloads. The cache
separates the runner OS, architecture and locked Playwright version. Each job
still runs the complete dependency install. Missing or changed packages
download normally. Cache failures do not bypass checks or fail verification.
Workflow fixtures reject an unlocked npm install, missing browser dependencies,
or browser setup after verification.

CI provisions native Postgres 16 for the `workspace-check` and `app-check` partitions before
verification and sets
`MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test`.
The API smoke also needs Python 3 and `psql`. An unreachable database fails if
`MKC_TEST_DATABASE_URL` or `CI` is set. Only an unconfigured developer machine
may skip the unavailable default database, with a printed reason. Reachable
databases must pass migrations and every assertion.
Every Postgres-backed test suite runs in its own database schema, never the
shared default schema, so data left by earlier runs cannot change its results.
A suite creates its schema, migrates and queries only through a URL scoped to
it, and drops the schema when the suite ends; the Python smokes create one
disposable schema per run.
Stage 20 reads the generated JSON document. Every implemented operation
requires an `x-reasons` inventory matching the REST catalogue. Reserved and
deferred reasons remain limited to deferred operations and the full error
inventory. Quoted reasons in API descriptions and marked protocol prose are
checked too; unknown, malformed and duplicate reasons fail. The GitHub
subscription list must have a delivery fixture for every event, per
[GitHub App](./github-app.md).
The Rust tests check operation coverage, anonymous-read security agreement,
reason catalogue agreement, required nullable fields and response schemas.
Stage 17 checks both generated files for drift.

### App Shards

CI runs the `app-check` partition as four jobs. Job `n` runs `app-check` for
shard `n/4`, and its name shows the shard, as in App checks 2/4. Each job
runs on its own fresh runner with its own Postgres. It builds the web app
itself and starts its own API. No job depends on the build of another job.

Each browser test belongs to exactly one shard. Together, the four jobs run
the whole browser suite. For one commit, a shard holds the same tests in CI
and on a developer machine. Shard 1 also runs the app logic tests, and the
other shards do not. By estimate, four is the smallest count at which each
App shard job ends before the `workspace-check` job.

Each job runs its browser tests one at a time. Parallel runs come only from
the shard jobs. The suite does not add Playwright workers, because the tests
in one job share one recorded GitHub installation and one sign-in rate limit.

`app-check` selects a shard from its `--shard` option, or else from the
`MKC_APP_SHARD` environment variable, which CI sets. When both are set, the
option wins, because it is the direct command and the variable is only a
default. An empty variable selects no shard. The value is `<n>/<total>`, where
`n` is a whole number from 1 to `total`. Any other value fails the command
with a message, because a wrong shard would skip tests in silence. With no
selector, `app-check` runs the whole partition.
`cargo xtask check` and `cargo xtask app-tests` always run the whole of
stage 14. An inherited `MKC_APP_SHARD` does not change them.

## Image Build Runtime

Standalone BuildKit starts with the pinned `buildkit-runc`; readiness requires a
successful worker query rather than only a socket, and bounded startup failures
must emit both the worker probe and retained daemon log. Startup must work
with hardened sticky-directory ownership protections enabled. The OCI
worker uses BuildKit's `auto` snapshotter selection and reports the selected
worker label. Startup requires overlayfs or fuse-overlayfs by default and
rejects native's full-parent-copy fallback before running the required API,
catalogue and app builds; an explicitly capacity-reviewed machine may set
`MKC_BUILDKIT_REQUIRE_LAYERED=false`. Filesystem blocks, inodes and a
time-bounded block sum of the BuildKit-owned root are reported when the daemon
becomes ready, at image-gate entry and after each image success or failure; the
block sum may count shared extents more than once. Capacity reporting never
deletes runner data. The bounded storage comparison must show that the
layered selection uses less allocated BuildKit-root storage than native,
without inferring hosted-runner capacity from the local measurement.
