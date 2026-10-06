# Mokly Workspace Package Review

Three findings: one High and two Low. The review was read-only and changed no
implementation. Each finding awaits the user's decision. See
[the plan](../../plans/mokly-workspace-package.md) for the milestones.

Background for readers new to the change: the published CLI package
`@mokly/mokly` moved from the repository root into `packages/mokly`, beside
`@mokly/viewer` in `packages/viewer`. The root `package.json` is now a private
npm workspace root. The published tarball keeps the same 2,104 files.
Release Please, the tool that opens release pull requests and creates release
tags, now registers the CLI under the path `packages/mokly` instead of `.`.

The review compared the complete branch with `origin/main` at `781da7a`, using
[the implementation review prompt](../implementation-review-prompt.md).

## Findings

1. **High — Merging this branch before release PR #127 publishes breaking CLI
   changes as a patch release.**
   [`release-please-config.json`](../../release-please-config.json) line 11
   registers the CLI as `packages/mokly`. Release Please gives a commit to a
   package only when the commit changes a file under that package's path. The
   old path `.` received every commit. Every unreleased CLI change since
   `v0.13.0` changed the old root `src/` directory: #125 (`feat!`), #131
   (`feat!`), #129 (`fix`), #132 (`fix`) and #130 (`fix(deps)`). #131 also
   changed `packages/viewer`, so after the move it counts for the viewer only.
   Open release PR #127 currently proposes CLI 0.14.0 with all of these
   changes. If this branch merges first, Release Please regenerates that pull
   request with no CLI commits. The `node-workspace` plugin
   (`updateAllPackages: true`) still bumps the CLI when the viewer releases,
   but only to 0.13.1, with no changelog entries. That patch contains two
   breaking changes. npm installs it automatically for every consumer whose
   range is `^0.13.0`. The branch documents the merge order in the
   [commit attribution contract](../protocol/npm-release-management.md#commit-attribution)
   and the plan's
   [merge prerequisites](../../plans/mokly-workspace-package.md#merge-prerequisites),
   but nothing enforces it.

   **Impact of no change:** a maintainer who merges in the wrong order
   publishes an incorrect semantic version and loses the release notes.

   - **A.** Merge #127 first, so 0.14.0 releases under the old configuration.
     Then merge `main` into this branch. Put the new version in
     `packages/mokly/package.json`, under the `packages/mokly` key of
     `.release-please-manifest.json`, and in the lockfile's `packages/mokly`
     entry. Git carries the changelog edit to `packages/mokly/CHANGELOG.md`
     through the rename. The release-config and lockfile tests reject a wrong
     resolution. Run the gate again, then merge.
   - **B.** Merge this branch first. Before the next release pull request
     merges, set `"release-as": "0.14.0"` for `packages/mokly`, write the
     missing changelog entries by hand, and remove `release-as` after the
     release.
   - **C.** Add an automated check that blocks the merge while unreleased
     root-path CLI commits exist.

   **Recommendation: A.** This is a one-time transition, so a procedural fix
   is enough and a permanent check (C) adds cost for no future benefit. Add
   the integration steps from A to the plan's merge prerequisites, so the
   maintainer who merges does not need to rediscover them.

2. **Low — The npm "Homepage" link now opens the repository overview, not the
   CLI documentation.**
   [`packages/mokly/package.json`](../../packages/mokly/package.json) line 8
   keeps `https://github.com/mokly-ai/mokly#readme`. Before the move, the root
   README was the CLI README. Now it is the workspace overview, and the CLI
   README is `packages/mokly/README.md`. `validatePackageManifest` in
   [`scripts/package/manifest.mjs`](../../scripts/package/manifest.mjs) pins
   `repository` but not `homepage`.

   **Impact of no change:** users who select Homepage on npm, or run
   `npm home @mokly/mokly`, land one link away from the CLI documentation.
   Nothing breaks.

   - **A.** Set `homepage` to
     `https://github.com/mokly-ai/mokly/tree/main/packages/mokly#readme` and
     pin it in `validatePackageManifest`, as `repository` is pinned.
   - **B.** Keep the overview URL. Its Packages table links to the CLI README.

   **Recommendation: A.** The change is small, and the manifest assertion
   stops the value from drifting again. It takes effect with the next release.

3. **Low — The plan says the README moves "with Git history", but Git records
   no rename.** Decision 9 in
   [the plan](../../plans/mokly-workspace-package.md) says `README.md` moves
   with its history. The root `README.md` still exists as the rewritten
   overview, so `git diff -M --name-status origin/main...HEAD` reports
   `M README.md` and `A packages/mokly/README.md`. The repository merges pull
   requests by squash, so `main` will record the same result.

   **Impact of no change:** `git log --follow` and blame for
   `packages/mokly/README.md` start at the move commit. The earlier history
   stays under `README.md`. Nothing breaks, but the plan states a result that
   did not happen.

   - **A.** Correct the wording of Decision 9: the history stays with the root
     path.
   - **B.** Move the README in a separate change that has no root README in
     between. That breaks the root README checks and does not survive a
     squash merge.

   **Recommendation: A.**

## Verified Without Findings

- All 484 moved production source files keep their bytes, and the packed CLI
  keeps the same 2,104 paths.
- Test splits keep every test name. Assertions grew from 9,140 to 9,210.
- No relative import resolves into the removed root `src/` or `dist/`
  (4,053 specifiers checked independently).
- Release Please updates for the root lockfile cover the CLI version, the
  viewer version, and the CLI's exact viewer dependency. A regression test
  fails when either version updater is missing.
- Historical review records change only 78 relative link targets.

## Residual Test Risk

- The browser (844) and hydration (263) suites last ran on the tree before
  the final batch. That batch changed the release config, one test, and
  documentation, which those suites do not read.
- The macOS and Windows `platform` CI jobs run `npm run build` with Node
  22.14.0. The root build now runs both package builds, the documentation
  copy, and `npm rebuild --workspace @mokly/mokly --ignore-scripts`. That
  chain ran only on Linux. Hosted CI runs only for pull requests and `main`,
  and this branch has no pull request yet.
- The lockfile updaters rely on observed release-please 17.6.0 behavior. The
  regression test simulates the configured JSON updaters, not Release Please
  itself. The plan's post-merge follow-up checks the first real release pull
  request.
