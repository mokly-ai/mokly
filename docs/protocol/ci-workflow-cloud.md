# CI Workflow: Cloud Jobs

Status: The cloud jobs and workflows are not in this repository yet. The [combine plan](../../plans/combine-mokly-cloud.md) moves them in.

This continues the [CI workflow graph](./ci-workflow.md) for the jobs and the
workflows of Mokly Cloud.

## Cloud Jobs

The CI workflow runs the [cloud suites](./ci-verification.md#cloud-suites) in
cloud jobs on Linux. [Required CI](./ci-workflow.md#required-ci) requires
every cloud job. The Linux jobs build and test every crate. Each job that
builds the `mkc-` crates provides `libpq`, and each job that runs their
database tests provides Postgres. The native jobs on macOS and Windows leave
out the `mkc-` crates, under the
[native rule](./ci-verification.md#gate-ownership).

## Cloud Workflows

- `.github/workflows/deploy.yml` deploys the cloud.
- `.github/workflows/foundation.yml` applies the foundation infrastructure of
  the cloud.
- `.github/workflows/site.yml` deploys the site.
- `.github/workflows/desktop-release.yml` packages and releases the desktop
  shell.

The cloud protocol docs under `docs/protocol/cloud/` define each workflow.

Every push to `main` runs the cloud deploy, also when it changes only Mokly
paths, because a change under `packages/` changes the hosted viewer.

## Forks And Protection

Fork pull requests never get secrets, preview environments, or cloud deploy
credentials. Deploy and preview jobs run only for `main` and for pull requests
from branches of this repository. Production deploys keep their protection:
only a push to the protected `main` branch or a manual dispatch from `main`
runs them.

## Release Please

Release Please covers only the published packages. It keeps the cloud
projects out of the changelog and out of the version bump.

## Related Docs

- [CI workflow graph](./ci-workflow.md)
- [CI verification](./ci-verification.md)
- [Repository layout](./repository-layout.md)
