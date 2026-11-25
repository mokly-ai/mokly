# Repository Verification

This is the verification sub-contract of
[Repository layout](./repository-layout.md).
[CI verification](../ci-verification.md#cloud-suites) defines the cloud suites
of `cargo xtask check` and the checks that each suite requires. The
[cloud CI jobs](../ci-workflow-cloud.md) run those suites. This page holds the
cloud rules that those pages do not define. The
[xtask guide](../../../xtask/README.md) gives the commands and the tools that
each suite needs.

## Suite Rules

The cloud suites need no cloud credential.

- `cloud-terraform` checks the format of every Terraform root and module
  recursively. It initializes each one without a backend, validates its
  providers, and runs its `terraform test` files.
- `cloud-helm` runs a strict lint, golden renders of every environment, and
  the rejection cases of the typed values. It also checks, in both directions,
  that the workload settings and `docs/ops/environment.md` name the same
  settings.
- `cloud-infrastructure` runs the HTTP smoke, input, and cleanup tests, the
  Dockerfile contracts, and the bounded BuildKit storage comparison. Then it
  builds the API, catalogue, and app images with the pinned standalone
  BuildKit, under [Image Build Runtime](#image-build-runtime). A missing
  BuildKit or crane fails the suite, and the message names the commands that
  install and start them.
- `cloud-desktop` runs the logic tests of `@mokly-cloud/desktop` and builds
  the web export that the shell bundles. Then it runs the Electron smoke test
  against that export and the real API. Linux runs the smoke test under
  `xvfb-run`.
- The [mockup verification contract](./mockup-verification.md) owns the build
  determinism of `cloud-mockups`. The
  [site delivery contract](./site-delivery.md#checks) owns the order of the
  `cloud-site` checks. The [API contract guide](../../api/README.md) owns the
  drift and reason rules of `cloud-openapi` and `cloud-openapi-lint`.

### Route Inventory

Four suites enforce the shared route inventory of the
[origin router](./origin-router.md). The Rust route-reservation tests run in
`cloud-rust`. The site generation and build drift checks run in `cloud-site`.
The Worker tests run in `cloud-origin-router`. The cross-source
infrastructure tests run in `cloud-infrastructure`. Together they compare the
site route table, the built outputs, the generated Worker module, and the
reserved workspace names.

### Cloud Markdown Links

The Markdown link check also covers the Markdown files under `apps/`,
`packages/app/`, `packages/desktop/`, `crates/mkc-*/`, and `infra/`, not only `docs/`, `plans/`, and each
`README.md`. Under `apps/site/src/content/legal/`, a root route of one segment
resolves to its sibling Markdown source, as `/privacy/` resolves to
`privacy.md`. The source and the published destination of each legal link
thus both stay explicit. A `#fragment` on a link to a Markdown document names
a heading anchor of that document, as GitHub derives it from the heading text.

## Test Databases

Each invocation of `cloud-rust`, `cloud-app`, and `cloud-desktop` gets its own
database, as [CI verification](../ci-verification.md#cloud-suites) requires.
Inside that database, every Postgres-backed test suite runs in its own schema,
never in the shared default schema. Data from an earlier run therefore cannot
change its results. A test suite creates its schema, migrates and queries only
through a URL scoped to that schema, and drops the schema when it ends. The
Python smokes create one disposable schema per run.

An unreachable database fails a test run when `MKC_TEST_DATABASE_URL` or `CI`
is set. The cloud suites set `CI`. Only a direct test run on a developer
machine with no database configuration can skip the unreachable default
database, and it prints the reason. A reachable database must pass the
migrations and every assertion.

## App Shards

CI runs the `cloud-app` suite as eight jobs. Job `n` runs shard `n/8`, and its
name shows the shard, as in App checks 2/8. Each job runs on its own fresh
runner with its own Postgres. It builds the web app itself and starts its own
API. No job depends on the build of another job.

Each browser spec file belongs to exactly one shard, and together the shards
run the whole browser suite. For one commit, a shard holds the same tests in
CI and on a developer machine. Shard 1 also runs the app logic tests, and the
other shards do not.

Shards balance measured duration, not file count. The suite places whole spec
files from committed per-file durations, measured from the CI logs of one
complete run. A spec file without a measurement counts as the median measured
file, so a new or renamed spec still runs. Stale measurements can unbalance
the shards, but they never drop a test. Playwright's count-based shards were
rejected because the spec files differ in duration by up to a hundred times,
and one shard then took twice as long as another.

Each job runs its browser tests one at a time. Parallel runs come only from
the shard jobs. The suite does not add Playwright workers, because the tests
in one job share one recorded GitHub installation and one sign-in rate limit.

The app browser suite reads its shard from `MKC_APP_SHARD`. The `cloud-app`
suite sets that variable from its `--shard` option. Without the option, the
suite removes an inherited value and runs the whole browser suite. An empty
value selects no shard. The value is `<n>/<total>`, where `n` is a whole
number from 1 to `total`. Any other value fails the run with a message,
because a wrong shard would skip tests in silence.

## Mockup and Site Shards

CI runs the `cloud-mockups` suite as six jobs, Mockup checks 1/6 to 6/6, and
the `cloud-site` suite as two jobs, Site checks 1/2 and 2/2. Each job builds
the workspace and the catalogue or the site itself. No job depends on the
output of another job, and together the jobs of a suite run every check of
the unsharded suite once.

With `N` shards, where `N` is at least 3 for the mockups and at least 2 for
the site, the shards hold these checks:

| Shard                     | Checks                                               |
| ------------------------- | ---------------------------------------------------- |
| Mockup 1                  | Determinism and types, without a browser             |
| Mockup 2                  | Policy tests and the served browser suite            |
| Mockup `n`, from 3 to `N` | Shard `n - 2` of `N - 2` of the disk browser suite   |
| Site 1                    | Types, unit tests, links, and browser shard 1 of `N` |
| Site `n`, from 2 to `N`   | Browser shard `n` of `N`                             |

With two mockup shards, shard 1 runs the checks without a browser and shard 2
runs both browser suites. One shard runs the complete suite. The mockup and
site browser suites run their tests in parallel mode, so a browser shard is
Playwright's even split by test count.

## CI Jobs

The [CI workflow contract](../ci-workflow.md#job-execution) owns Electron
download isolation. The [cloud workflow contract](../ci-workflow-cloud.md)
owns the fork and cutover guards.

On a trusted push to `main` after cutover with both workload identity names configured, CI
also runs a real read-only Terraform plan. Without that configuration, the job
prints an explicit skip reason. After a merge, the deploy workflow plans and
applies each exact saved plan of a stable environment. An unauthenticated mock
plan is never reported as a cloud deployment.

Workflow contract tests check the desktop release workflow: its triggers,
platforms, permissions, action pins, tag and version check, release
environment, update flag, and deployment-owned origins. The `cloud-site` suite includes the actions of that
workflow in its reviewed action allowlist.
[Desktop distribution](./desktop-distribution.md) defines the workflow, its
packaged launch smoke, and its artifacts.

## Image Build Runtime

Standalone BuildKit starts with the pinned `buildkit-runc`. Readiness requires
a successful worker query, not only a socket. A bounded startup failure prints
both the worker probe and the retained daemon log. Startup works with hardened
sticky-directory ownership protections enabled.

The OCI worker uses the `auto` snapshotter selection of BuildKit and reports
the selected worker label. By default, startup requires overlayfs or
fuse-overlayfs. It rejects the full-parent-copy fallback of the native
snapshotter before the required API, catalogue, and app builds. A machine with
reviewed capacity can set `MKC_BUILDKIT_REQUIRE_LAYERED=false`.

The image checks report the filesystem blocks, the inodes, and a time-bounded
block sum of the BuildKit-owned root. They report these when the daemon
becomes ready, when the image checks start, and after each image success or
failure. The block sum can count shared extents more than once. Capacity
reporting never deletes runner data.

The bounded storage comparison must show that the layered selection uses less
allocated BuildKit-root storage than the native snapshotter. It does not infer
the capacity of a hosted runner from the local measurement.

## Related Docs

- [CI verification](../ci-verification.md#cloud-suites)
- [CI workflow: cloud jobs](../ci-workflow-cloud.md)
- [Repository layout](./repository-layout.md)
- [Repository generated files](./repository-generated-files.md)
- [xtask guide](../../../xtask/README.md)
