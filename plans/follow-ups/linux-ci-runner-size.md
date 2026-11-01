# Return Linux Rust jobs to two vCPUs

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `.github/workflows/ci.yml:64`, `:111`, `:159`, and `:264`,
  `.github/workflows/blacksmith-testbox.yml:24`,
  `tests/workflow_runner_sizes.test.ts:26-39`,
  `docs/protocol/ci-workflow.md:115-119`, and
  `docs/protocol/remote-verification-testbox.md:14`.
- **Reason:** On 2026-10-26 the user raised these runners for a limited
  time, until the Rust build cache and the other CI speed work landed.

- **Terms:**
  - **Blacksmith:** the CI runner provider. Its runner labels name the
    size, for example `blacksmith-8vcpu-ubuntu-2404`.
  - **Testbox:** the remote runner that `cargo xtask check` can use for a
    remote gate run.
- **Background:**
  - On 2026-10-26 the user raised the Linux CI jobs that compile Rust from
    2 to 8 vCPUs. The raise was for a limited time, until the Rust build
    cache of PR #215 and the other CI speed work landed.
  - On 2026-10-27 the user chose 8 over 16 vCPUs for the Windows native
    job, because with the Rust build cache 16 vCPUs gave no speed-up. That
    job stays on 8 vCPUs.
  - On 2026-10-27 the user also asked that the remote gate's Testboxes match
    the CI suite jobs and stay aligned. A remote gate then takes the time and
    cost of CI. So the Testbox job moves back with the Linux jobs.
  - PR #215 merged on 2026-10-27 with the Rust build cache.
  - Today the repository, viewer, browser, and static-delivery jobs of
    `ci.yml` and the Testbox job use `blacksmith-8vcpu-ubuntu-2404`.
  - `docs/protocol/ci-workflow.md:117-118` now gives the reason "fast CI
    results are worth their higher cost".
- **Task:**
  1. Measure the cached job times of these jobs on 2 vCPUs, for example in
     one manual CI run on a branch.
  2. Compare them with the current 8-vCPU times. If 2 vCPUs make CI much
     slower, give the user both times before the change. The protocol now
     states a reason for the larger runners.
  3. Move the four Linux CI jobs and the Testbox job to
     `blacksmith-2vcpu-ubuntu-2404`. Keep the Windows native job on 8 vCPUs.
  4. Update `docs/protocol/ci-workflow.md`,
     `docs/protocol/remote-verification-testbox.md`, and
     `tests/workflow_runner_sizes.test.ts` in the same change.
- **Impact if no action:** CI keeps the cost of 8-vCPU runners after the
  limited time that the user set.
- **Needs:** Permission to run CI on a branch for the measurement.
- **Done when:** The Linux Rust jobs and the Testbox job run on 2 vCPUs, or
  the user chose to keep 8 vCPUs after seeing the measured times. The docs
  and the runner size test match the workflows.
- **Related:** [remote-testbox-timeout.md](remote-testbox-timeout.md) asks
  how a healthy remote Testbox run can finish under its 30-minute job
  guard. This task moves the Testbox job to 2 vCPUs, which makes each
  Testbox command slower. So the suite measurement under option C of that
  item must come after this task.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6715).
