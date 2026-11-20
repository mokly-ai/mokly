# Workspace evidence host URL browser spec flakes

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the branch `calummoore/combine-mokly-cloud-into-repo-704s` (PR #350), CI run 44596520325.
- **Location:** `tests/browser/static_workspace_evidence.spec.ts`, the test "a destination's evidence opens at host URL form extensionless".
- **Reason:** The branch does not change this spec or the code that it covers, so the fix belongs to a separate branch.

- **Background:** The spec opens a destination of the static build at its extensionless host URL and expects its workspace evidence to show "Changed component: Card".
- **Problem:** In browser shard 4/4 on 2026-11-19 it failed with `expect(locator).toBeVisible() failed` for `locator('[data-workspace-evidence]').getByText('Changed component: Card', { exact: true })`, received `hidden`. The rerun of the same commit passed.
- **Impact if no action:** Required CI fails now and then on unrelated changes.
- **Root question:** What does the spec wait for before it reads the evidence of the destination?
- **Options:**
  - **A.** Reproduce the flake with repeated runs, name the nondeterminism source under the `testing` skill, and make the spec wait for an explicit readiness signal of the evidence. Effort: Small.
- **Left out:** A retry or a longer timeout, because they hide the source.
- **Wider fix:** None found before the source is known.
- **Previous examples:** Other `flaky-*.md` items under `plans/follow-ups/`.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because the source is not known yet.
