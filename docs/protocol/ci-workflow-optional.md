# CI Workflow: Optional Workflows

This page continues the [CI workflow graph](./ci-workflow.md) for the optional
workflows that `Required CI` does not depend on.

## Design Attribution Matrix

`.github/workflows/design-attribution.yml` runs nightly and through manual
`workflow_dispatch`. It runs the `design_attribution_tests` test target of
`mokly-cli` with the `design-matrix` Cargo feature on
`ubuntu-24.04` after building the workspace. It has a 120-minute
job timeout and a separate 90-minute test-process hang guard with a 30-second
termination grace period. Both guards must allow at least three times typical
duration. Each run saves its source tree ID and its timed test log as an
artifact. This workflow is optional. `Required CI` does not depend on it.

## Testbox Workflow Target

`.github/workflows/blacksmith-testbox.yml` prepares the Testboxes of the
[remote verification contract](./remote-verification.md). The
[Testbox workflow contract](./remote-verification-testbox.md#workflow) defines
its triggers, job, runner, step order, and action revisions. Its job runs on a
Blacksmith runner, because Testboxes exist only on Blacksmith. The job checks
out with Blacksmith's checkout action, which keeps a Git mirror between runs.
Its default Node.js version equals the version of the CI native jobs. Cloud
commands use their separate pinned Node installation. Its npm and Rust setup
equals the setup of the CI repository job. Its workflow `env` equals the
workflow `env` of the CI workflow. It restores the Rust build cache with the
options of the CI viewer, browser, and static-delivery jobs and never saves it.
CI saves its cache on GitHub-hosted runners, so no job refreshes that cache.
`Required CI` does not depend on this workflow. The
hosted CI graph and its release profile keep their required jobs.

## Related Docs

- [CI workflow graph](./ci-workflow.md)
- [Remote verification](./remote-verification.md)
- [Testbox workflow contract](./remote-verification-testbox.md)
