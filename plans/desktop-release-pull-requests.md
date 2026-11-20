# Desktop release pull requests and Mac updates

Status: Active. On branch `calummoore/desktop-release-process-ujn3`, no pull
request yet. The branch stacks on `calummoore/move-app-and-desktop-into-packages-kitn`,
which moves the app and the desktop shell under `packages/`. The pull request
that completes the work deletes this plan, as the `plans` skill says.

Today a person edits the desktop version by hand and pushes a
`desktop-v{version}` tag. The tag starts `.github/workflows/desktop-release.yml`,
which publishes a pre-release to the public feed `mokly-ai/mokly-desktop`.
This change gives the desktop app a Release Please release pull request, as
Conductive has, and makes the Mac updater safe and complete. It does not
change the feed repository, the Linux packages, or the npm release jobs.

## Decisions

Cal answered each decision on 2026-11-20. The options and their reasons are in
the conversation of workspace "desktop release process".

1. Which changes start a desktop release: **D**. Move `apps/app` and
   `apps/desktop` under `packages/`, then one desktop component at `packages/`
   that excludes `packages/mokly` and `packages/native-*`. Rejected: a component
   at `apps/desktop` only, a component at `apps/` that misses package-only
   changes, and a custom release tool. The move runs in its own branch.
2. One release pull request or two: **B**, separate pull requests. Rejected:
   one combined pull request, because each release would then ship both the
   npm packages and the desktop app.
3. Version numbers: **B**, `0.x.y` from `0.1.0`. Rejected: the alpha line.
   Every release stays a GitHub pre-release until local mode lands.
4. Which builds may update themselves: **A**, only release builds, with a
   build-time flag. Rejected: every packaged build, because a preview build
   could install a production release over itself.
5. Copies in a read-only place: **B**, a launch dialog that offers to move the
   app into Applications. Rejected: only a note in the docs.
6. Where the signing secrets live: **B**, a `desktop-release` GitHub
   environment that admits only `main`. Rejected: repository secrets that any
   branch can read.
7. Answer to a manual update check: **B**, a dialog for each result.
   Rejected: no answer.

## Design calls

My calls, 2026-11-20:

- The desktop release runs in `.github/workflows/release.yml`, directly after
  Release Please, as in Conductive. `desktop-release.yml` becomes a reusable
  workflow and loses its tag trigger. Reason: a tag that Release Please makes
  with a personal token could start the tag trigger and publish twice.
- Before signing, a job checks that the tag points at the release commit. The
  release jobs check out that commit, never a tag or branch name.
- The feed stays in `mokly-ai/mokly-desktop`. Reason: the updater would read
  the npm releases of this repository, which hold no app files.
- The desktop component sets `prerelease: true`, so the GitHub release in this
  repository is a pre-release. The npm release then stays "Latest".
- The manifest starts the desktop component at `0.0.0` with
  `initial-version: 0.1.0`. Reason: Release Please keeps the pre-release part
  when it bumps `0.1.0-alpha.2`, so it would give `0.1.1-alpha.2`. The first
  changelog then lists the releasable bundle commits since the bootstrap
  commit. The dry run of 2026-11-20 listed 86.
- The Mac app offers "Restart now" only after the macOS update framework
  accepts the download, as Conductive does. Reason: before that, Restart now
  can wait for ever.
- The new dialogs are native message boxes. They get no mockup, because the
  catalogue has no native dialogs and macOS draws them.
- The build writes the update flag into `bundle/build-config.json` beside the
  other build inputs, so a packaged app reads one file.

Contract owners:

- [Desktop distribution](../docs/protocol/cloud/desktop-distribution.md).
- [Desktop application](../docs/protocol/cloud/desktop-app.md).
- [npm release management](../docs/protocol/npm-release-management.md).
- [Secrets](../docs/ops/secrets.md).
- The [desktop README](../packages/desktop/README.md).

Replaced ways:

- A pushed `desktop-v{version}` tag → a merged desktop release pull request.
  Consumers: `desktop-release.yml`, the desktop README, the cutover runbook.
  Moved and deleted in Milestone 3.
- Repository secrets for desktop signing → the `desktop-release` environment.
  Consumers: `desktop-release.yml`, `docs/ops/secrets.md`. Moved in
  Milestone 3. A repository admin deletes the repository secrets after the
  first release passes.

## Milestone 1: Documentation and protocol

Depends on: none

State the new release process and the updater rules.

- [x] `docs/protocol/cloud/desktop-distribution.md`: the release pull request,
      the tag check, the environment, the update flag, the move dialog, the
      manual check answers, and the offer after macOS accepts the download.
- [x] `docs/protocol/npm-release-management.md`: separate release pull
      requests, and the desktop component beside the npm component.
- [x] `docs/ops/secrets.md`: the six secrets live in `desktop-release`, with
      the setup commands.
- [x] `docs/ops/repository-cutover.md`: replace the "next `desktop-v*` tag"
      check with the first desktop release pull request.
- [x] `packages/desktop/README.md`: the release steps and the updater.

## Milestone 2: Release Please

Depends on: 1

- [x] `release-please-config.json`: `separate-pull-requests: true`, and the
      `packages` component with `component: desktop`, `prerelease: true`,
      `initial-version: 0.1.0`, `bump-minor-pre-major`, its changelog in
      `packages/desktop/CHANGELOG.md`, `extra-files` for the version in
      `packages/desktop/package.json` and `package-lock.json`, and
      `exclude-paths` for `packages/mokly` and `packages/native-*`.
- [x] `.release-please-manifest.json`: `"packages": "0.0.0"`.
- [x] Run the pinned Release Please against the local configuration with
      `scripts/release/version_updates.mjs`. A bundle change gives the desktop
      version `0.1.0`. An npm CLI or native change gives no desktop release.
      `tests/release_config.test.ts` keeps the lasting rule: from `0.1.0`, a
      breaking change gives `0.2.0`. The dry run below proves the first
      version once.
- [x] Run a Release Please dry run against this branch on GitHub. Check the
      desktop pull request title and the tag `desktop-v0.1.0`. Save the output
      under `.context/`.
- [x] `scripts/verification/ratchets/public-exports.mjs`: skip a component
      that releases a private workspace, such as the desktop shell.

## Milestone 3: Release workflow

Depends on: 2

- [x] `desktop-release.yml`: replace the tag trigger with `workflow_call`
      inputs for the tag and the commit. The release job uses the
      `desktop-release` environment, checks out the commit, and builds with
      the update flag on.
- [x] `release.yml`: expose the desktop outputs of Release Please. Add a tag
      check job and a job that calls `desktop-release.yml`.
- [x] `release-environment.py`: keep the check that the tag equals
      `desktop-v` plus the package version.
- [x] Update the workflow contract tests in
      `xtask/tests/cli/desktop_release_workflow_tests.rs` for the new trigger.
      `tests/desktop_release_tag_check.test.ts` runs the tag check with a
      stand-in `gh`, and checks that the desktop outputs follow the
      component path. `tests/workflow_runner_sizes.test.ts` admits each
      local workflow call that it audits.

## Milestone 4: Mac updater

Depends on: 1

- [x] `scripts/build.mjs` and `src/config.ts`: carry the update flag. Only
      `MKC_DESKTOP_UPDATES=enabled` turns it on.
- [x] `src/updates.ts`: the updater is off unless the app is packaged and the
      flag is on. On macOS, offer Restart now only after the native updater
      accepts the download. Answer each manual check with a dialog.
- [x] `src/menu.ts`: disable Check for updates when the updater is off.
- [x] A new module offers to move a copy in a read-only place into
      Applications, once per version.
- [x] Logic tests for each case, with Electron doubles.

## Milestone 5: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against the move branch, or against
      `origin/main` after the move merges, with the `implementation-review`
      skill. Report the findings, then apply the fix rule: fix the `fix now`
      findings, record follow-up items under `plans/follow-ups/` for the rest,
      re-review once, and report.
- [ ] Before the merge, a repository admin creates the `desktop-release`
      environment, limits it to `main`, and copies the six secrets into it.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Smoke-test a real update on a Mac: install the first release from its
      DMG into Applications, merge the next desktop release pull request,
      and check Later and Restart now.
- [ ] After the first release passes, delete the six repository secrets.
