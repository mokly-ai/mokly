# Replace the Intel macOS release runner

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** the `darwin-x64` row of the `build-native` job in
  `.github/workflows/release.yml`, `.github/workflows/release-check.yml`, and
  `.github/workflows/native-bootstrap.yml`; the runner rule in the section
  "Job Execution" of `docs/protocol/ci-workflow.md`; and the section "Release
  Build Matrix And Publication Order" of `docs/protocol/npm-release.md`.
- **Reason:** The `macos-26-intel` runner still works today. The work
  becomes necessary when GitHub retires its Intel macOS images.

- **Terms:**
  - **Native package:** one `@mokly/native-{target}` npm package that holds
    the `mokly` binary of one platform. `darwin-x64` is the Intel macOS one.
  - **GitHub-hosted standard runner:** a runner that GitHub supplies. It is
    free for this public repository. Every build row runs on one.
- **Background:**
  - The release, release-check, and native bootstrap workflows build one
    native binary per target, on a runner of that system and architecture.
  - The section "Release Build Matrix And Publication Order" of
    `docs/protocol/npm-release.md` says that a build refuses a different host
    system or architecture.
  - The `darwin-x64` row runs on GitHub-hosted `macos-26-intel`. The runner
    rule in the section "Job Execution" of `docs/protocol/ci-workflow.md`
    puts only this row on Intel macOS. The row keeps native Intel build and
    execution coverage.
  - Every row of each build matrix checks out with the same
    `actions/checkout` step.
  - Tests pin the runner: `tests/release_matrix.test.ts` and
    `tests/workflow_runner_sizes.test.ts`. The release-check target list in
    `tests/release_check_workflow.test.ts` holds `darwin-x64`.
  - The plan gives no retirement date.
- **Task:**
  1. Read GitHub's runner image announcements, and record the retirement
     date of the Intel macOS images.
  2. Find a GitHub-hosted standard runner with an Intel macOS host that can
     build and run the `x86_64-apple-darwin` binary.
  3. Change the runner of the `darwin-x64` row in the three workflows.
  4. Update the `darwin-x64` row rule in the section "Job Execution" of
     `docs/protocol/ci-workflow.md`, and the tests that pin the runner.
  5. Run the release-check workflow, and check that the `darwin-x64` row
     builds and runs the binary.
  6. If no GitHub-hosted standard runner gives native Intel build and
     execution, stop. Bring the choice to the user as a decision, because
     each other choice, such as a paid runner, Rosetta 2, or dropping the
     target, changes a protocol requirement.
- **Impact if no action:** When GitHub retires the images, the release and
  release-check workflows fail for `darwin-x64`, and no release can publish.
- **Needs:** The retirement date. A runner with an Intel macOS host, and
  credentials when it comes from another provider. Permission to change
  the release workflows.
- **Done when:** All three workflows build and run the `darwin-x64` binary
  on the new runner. The release-check workflow passes for that row. No
  workflow, protocol page, or test names the retired image.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5434).
