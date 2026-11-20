# CI Workflow: Cloud Jobs

This continues the [CI workflow graph](./ci-workflow.md) for the jobs and the
workflows of Mokly Cloud.

## Cloud Jobs

The CI workflow runs the [cloud suites](./ci-verification.md#cloud-suites) in
cloud jobs on GitHub-hosted `ubuntu-24.04`, under the
[runner rule](./ci-workflow.md#job-execution).
[Required CI](./ci-workflow.md#required-ci) requires
each partition, the image check and the provider-plan result. Linux builds
and tests every crate. Each job that
builds the `mkc-` crates provides `libpq`, and each job that runs their
database tests provides Postgres. The native jobs on macOS and Windows leave
out the `mkc-` crates, under the
[native rule](./ci-verification.md#gate-ownership).

The workspace partition runs cloud Rust, migrations, type checks, OpenAPI,
fixtures, email templates, Terraform contracts, origin-router checks, Helm,
and toolchain pins. Desktop, mockups, and site each have a partition. Four
app partitions pass their shard to `cloud-app`. The image job runs
`cloud-infrastructure`. Each partition uses the shared `cargo xtask check
--suite` entry point. No workflow runs the removed cloud stage runner.

Cloud workers use Node 24.21.0 and npm 11.21.0. Testboxes also retain Node
22.15.0 for Mokly commands and report aggregation. The cloud worker selects
its Node installation through `MOKLY_CLOUD_NODE_BIN` before it installs or
runs a suite. It clears the Electron skip setting only for a desktop worker.

Foundation can retain the old repository during cutover with
`MKC_LEGACY_REPOSITORY_ID`. Its trust pairs each repository name with its own
numeric ID and main workflow refs. An empty value trusts only this repository.

## Cloud Testbox Tools

The shared Testbox snapshot installs Chromium, Postgres 16 and `libpq`,
e2fsprogs, and Xvfb. It starts Postgres with the local test role and database,
and puts its server tools on `PATH`. It installs the pinned Terraform, Helm,
BuildKit and crane tools, then starts layered BuildKit. These services and
tools let cloud workers run the same strict suites as CI without provider
credentials. Each cloud database suite creates its own disposable database.

Seven cloud commands, listed in the [remote README](../../xtask/remote/README.md),
each run `node xtask/scripts/testbox-cloud.mjs --expect <fingerprint> --suites <list>`
on their own box. Each installs the root lockfile and Chromium, attempts every
listed suite, names each failed suite, and exits nonzero when any fails. They
produce no suite report.

Lighthouse runs as a separate report job. It retains failures and does not
block `Required CI`.

## Provider Plan

Only a push to `main` after cutover can start the credentialed CI plan.
The job guard runs before secrets or an OIDC permission enter the job.
An unconditional result job requires that plan to succeed when permitted.
On other events it requires a skipped plan and prints the reason.
`Required CI` requires this result job to succeed. Missing, failed, or
cancelled plan evidence cannot pass as a permitted skip.

## Cloud Workflows

- `.github/workflows/deploy.yml` deploys the cloud.
- `.github/workflows/foundation.yml` applies the foundation infrastructure of
  the cloud.
- `.github/workflows/site.yml` deploys the site.
- `.github/workflows/desktop-release.yml` packages and releases the desktop
  shell.
- `.github/workflows/preview.yml` keeps the Mokly Pages previews and the cloud
  preview lifecycle in one workflow.

The cloud protocol docs under `docs/protocol/cloud/` define each workflow.

Desktop package and release jobs use GitHub-hosted `macos-26` for macOS
and `ubuntu-24.04` for Linux. They follow the same runner rule.

Every push to `main` runs the cloud deploy, also when it changes only Mokly
paths, because a change under `packages/` changes the hosted viewer.

## Forks And Protection

Fork pull requests never get secrets, preview environments, or cloud deploy
credentials. Deploy and preview jobs run only for `main` and for pull requests
from branches of this repository. Production deploys keep their protection:
only a push to the protected `main` branch or a manual dispatch from `main`
runs them.

Every cloud delivery job also requires repository variable
`MKC_CLOUD_CUTOVER_ENABLED` to equal `true`. Until the operator sets it, no
cloud plan, deploy, foundation apply, site deploy, desktop package or release,
or preview lifecycle can start. While the switch is off, the result jobs
**Deployment required** and **Foundation required** pass only when every
delivery job of their run was skipped, and they print a skip line. This switch
adds no approval environment.
The preview release uses the existing `preview` environment. Production
promotion still requires `MKC_PRODUCTION_ENABLED=true`.

The cloud preview accepts `pull_request_target` events only from this
repository. Its image and catalogue jobs run without secrets, credentials,
or an environment. The credentialed release checks out trusted `main`
scripts and consumes their artifacts. It cannot run on a fork event even
when a preceding output claims that a deploy is requested.

## Release Please

Release Please covers only the published packages. It keeps the cloud
projects out of the changelog and out of the version bump.
The configuration excludes each cloud directory because Release Please matches
excluded directories only.
Shared root files, including cloud workflows, root tool configurations, and the
AGPL license text, count for the Mokly release.
Dependency pins in cloud manifests follow the coordinated Mokly version;
the cloud projects' own versions do not change.

## Related Docs

- [CI workflow graph](./ci-workflow.md)
- [CI verification](./ci-verification.md)
- [Repository layout](./repository-layout.md)
