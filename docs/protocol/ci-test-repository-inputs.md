# Deterministic Test Repository Inputs

Node tests and browser tests must depend only on the tree under test and
fixture-owned state. A test that needs Git history creates an isolated fixture
repository, commits its own history there, and asserts against that history. A
fixture repository may create and read its own remotes because those references
are fixture-owned inputs inside the test tree. The browser suite's shared
example servers use an intentionally unresolved base and read no repository
history, as [CI suite evidence](./ci-suite-evidence.md#test-concurrency)
defines. Real Changes specs use isolated Git fixtures.

CI's viewer, browser, and native jobs key npm's download cache from the
checked-out `package-lock.json`. Their cache steps use local data: none
resolves `origin/main` or reads a branch-point lockfile. Identical trees must
produce identical test results; the release workflow's exact-tree evidence
reuse depends on that determinism.

Review keeps this rule for new test code. No automated check scans tests for
remote-branch reads.

No workflow or composite-action `run:` step may delete remote Git state. In a
shared Git worktree, such a command deletes the shared repository's remotes,
remote-tracking references or upstream settings.
