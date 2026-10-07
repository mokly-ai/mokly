# Deterministic Test Repository Inputs

Unit and browser tests must depend only on the tree under test and fixture-owned
state. The example preview unit test copies the checked-out example and tooling
into an isolated fixture repository, commits that fixture-owned baseline,
applies one deterministic source edit and asserts its exact changed
destinations and count. The browser suite's example server runs with
`--base HEAD` and compares with the checked-out `HEAD`; every worker's server
uses that same command. A fixture repository may create and read its own
remotes because those references are fixture-owned inputs inside the test tree.

CI's package, unit, browser, and hydration jobs key npm's download cache from
the checked-out `package-lock.json`. Their cache steps use local data: none
resolves `origin/main` or reads a branch-point lockfile. Identical trees must produce identical test results; the
release workflow's exact-tree evidence reuse depends on that determinism.

The remaining automated checks for repository inputs are deliberately narrow:

- [`tests/preview.test.ts`](../../tests/preview.test.ts) owns the isolated
  fixture baseline, deterministic edit and exact changed-result assertions.
- `tests/ci_workflow_policies.test.ts` requires the browser example server
  command to include `--base HEAD`, checked through the exported command
  builder rather than source text. It also requires the package, unit,
  browser and hydration jobs to use the checked-out lockfile and never
  resolve `origin/main` or a branch-point lockfile.

These checks are properties of the workflow, not copies of its text. Review
owns workflow literals such as job names, step order, matrix values and run
strings. Nothing scans test code for remote-branch reads. New tests rely on
review to keep this deterministic-input rule.

No workflow or composite-action `run:` step may delete remote Git state. In a
shared Git worktree, such a command deletes the shared repository's remotes,
remote-tracking references or upstream settings.
[`tests/ci_workflow_remote_state.test.ts`](../../tests/ci_workflow_remote_state.test.ts)
enforces this as a text check across workflow and composite-action steps, using
the command scanner in
[`tests/helpers/remote_state_commands.ts`](../../tests/helpers/remote_state_commands.ts).
It cannot see commands inside scripts that a step calls.
