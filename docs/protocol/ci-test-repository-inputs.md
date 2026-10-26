# Deterministic Test Repository Inputs

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Node tests and browser tests must depend only on the tree under test and
fixture-owned state. A test that needs Git history creates an isolated fixture
repository, commits its own history there, and asserts against that history. A
fixture repository may create and read its own remotes because those references
are fixture-owned inputs inside the test tree. The browser suite's example
server uses the intentionally unresolved base `refs/mokly/browser-suite-no-base`.
It waits for settled usage and `unavailable` Changes, with one `git-failed`
diagnostic. Real Changes specs use isolated Git fixtures. Every worker uses
the same command through the npm shim. Serve binds a free port with `--port 0`.

CI's viewer, browser, and native jobs key npm's download cache from the
checked-out `package-lock.json`. Their cache steps use local data: none
resolves `origin/main` or reads a branch-point lockfile. Identical trees must
produce identical test results; the release workflow's exact-tree evidence
reuse depends on that determinism.

The automated checks for repository inputs are deliberately narrow:

- A Node test requires the browser command to use the named unavailable base
  through one shared command builder. The served design checks share that
  base. The test checks the Playwright configuration, each worker's server,
  readiness, and the single Git diagnostic.
- A repository test of `xtask` requires viewer, browser, and native jobs to use
  the checked-out lockfile and never resolve `origin/main` or a branch-point
  lockfile.

These checks are properties of the workflow, not copies of its text. Review
owns workflow literals such as job names, step order, matrix values and run
strings. Nothing scans test code for remote-branch reads. New tests rely on
review to keep this deterministic-input rule.

No workflow or composite-action `run:` step may delete remote Git state. In a
shared Git worktree, such a command deletes the shared repository's remotes,
remote-tracking references or upstream settings. A repository test of `xtask`
enforces this as a text check across workflow and composite-action steps. It
cannot see commands inside scripts that a step calls.
