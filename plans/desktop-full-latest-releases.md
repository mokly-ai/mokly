# Desktop releases become full latest releases

Status: Active. On branch `calummoore/desktop-releases-become-latest-releases-clkn`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

Every desktop release of `mokly-ai/mokly-desktop` is a GitHub pre-release
today, and its installer names hold the version, such as
`Mokly-0.1.0-mac-arm64.dmg`. GitHub therefore has no "latest" release, and no
fixed download address exists. This change makes each release a draft that
both platform legs fill. A new final job checks the complete inventory of
both platforms and only then turns the draft into a full release that GitHub
marks as latest. The installer and updater file names drop the version. A
later pull request adds a download page on mokly.ai that links
`https://github.com/mokly-ai/mokly-desktop/releases/latest/download/{fixed name}`.
That page is not part of this change.

Contract owners:

- [Desktop distribution](../docs/protocol/cloud/desktop-distribution.md).
- [Desktop application](../docs/protocol/cloud/desktop-app.md).
- The [desktop README](../packages/desktop/README.md).

## Decisions

Cal (`calummoore`, the workspace owner) chose these on 2026-11-24 in the
parent workspace "dedicated download page". The options check ran there.

- **Decision 1 = C.** The future download page links GitHub's fixed latest
  download addresses. Desktop releases become full releases, not
  pre-releases. Each release is marked latest only after its complete asset
  check, and the installer names drop the version. Rejected:
  - A, a version record in the site source that a person updates after each
    release, because it needs a manual step per release.
  - B, a GitHub API lookup at site build time plus a site redeploy, because
    it adds network access to the site build and links two workflows.
  - D, a Mokly-hosted bucket with fixed names, because it adds
    infrastructure and credentials.
- **Decision 2 = B.** The download page shows no pre-release label. This
  affects only the later page.
- **Order.** Cal approved this change and its merge first, then the page.
- These decisions supersede the rule "every release is a pre-release until
  local mode lands" in the two desktop protocol docs.

## Verified facts (2026-11-24)

- electron-publish 26.18.0, `GitHubPublisher.getOrCreateRelease`: it lists
  `GET /repos/{owner}/{repo}/releases` (the first page) and takes the first
  release whose tag is `v{version}` or `{version}`. A matching draft is
  returned at once, before the type check and the two-hour check. A matching
  published release with `releaseType: draft` makes it log "existing type
  not compatible" and return `null`, which the append-only hook turns into a
  job failure. With no match it creates `{tag_name, name: version,
draft: true, prerelease: false}`. So the macOS leg creates the draft and the
  Linux leg reuses it. The env values `EP_DRAFT`, `EP_PRE_RELEASE` and
  `EP_PRELEASE` override `releaseType` from the configuration.
- The two-hour limit no longer applies, because a draft has no
  `published_at` and returns before that check.
- `GET /releases/tags/{tag}` does not return drafts. The final check reads
  the release by id: `GET /releases/{id}`.
- electron-updater 6.8.11, `Provider.getBlockMapFiles`: the old blockmap
  address is the new file address with every copy of the new version
  replaced by the old version, plus `.blockmap`. From v0.1.0 to the first
  version-free release, for example `0.2.0`, the old address is
  `/releases/download/v0.1.0/Mokly-mac-arm64.zip.blockmap`. That asset does
  not exist, so the request fails with 404. `differentialDownloadInstaller`
  catches every error, logs "fallback to full download" and returns `true`,
  and the caller then downloads the full file. On macOS the differential path
  runs only when a cached `update.zip` from an earlier update exists. From the
  first version-free release on, the tag segment still holds the version, so
  the old blockmap address resolves to the earlier release's version-free
  blockmap.
- The AppImage updater uses the blockmap embedded in the AppImage, so the
  file names do not affect it. When the installed AppImage name holds a
  version, the updater moves the new file to the new name. When the name
  holds no version, it replaces the file in place.
- `GitHubProvider.getLatestVersion` with `allowPrerelease = false`: it reads
  `https://github.com/{owner}/{repo}/releases/latest` as JSON and takes its
  `tag_name`. That is the same release that the download page links. With
  `allowPrerelease = true` and a stable current version, such as `0.1.0`, it
  takes the first entry of `releases.atom`, which can be a pre-release.
- The public Atom feed lists the newest published release first. On
  2026-11-24 its order was v0.1.0, v0.1.0-alpha.2, v0.1.0-alpha.1. All three
  releases have the same `created_at`, the one commit of
  `mokly-ai/mokly-desktop`. A promoted draft gets a new `published_at`, so
  installed v0.1.0 apps, which set `allowPrerelease = true`, see the first
  full release as the first feed entry. Its tag has no pre-release part, so
  they read `latest-mac.yml` or `latest-linux.yml` from it.
- v0.1.0 holds twelve assets: four macOS installers, their four blockmaps,
  `latest-mac.yml`, the AppImage, the `deb` and `latest-linux.yml`. The
  version-free names follow from the same `${os}` and `${arch}` values.
- `DESKTOP_RELEASES_TOKEN` is a fine-grained token with Contents write on
  `mokly-ai/mokly-desktop` only, as `docs/ops/secrets.md` records. GitHub's
  "Update a release" endpoint needs Contents write. Listing drafts needs
  push access. The scope needs no change.

## Design

- The installer names become `Mokly-${os}-${arch}.${ext}`. The fixed
  inventory, which the download page depends on:
  - macOS: `Mokly-mac-arm64.dmg`, `Mokly-mac-x64.dmg`,
    `Mokly-mac-arm64.zip`, `Mokly-mac-x64.zip`, the four matching
    `.blockmap` files and `latest-mac.yml`.
  - Linux: `Mokly-linux-x86_64.AppImage`, `Mokly-linux-amd64.deb` and
    `latest-linux.yml`.
- `publish.releaseType` becomes `draft`. Each leg keeps the existing
  guarantees: build with publishing off, the append-only upload hook, no
  asset replacement or deletion, `EP_GH_IGNORE_TIME` removed, the tag check
  and the `desktop-release` environment.
- Each leg's final check reads the release by id. It requires a draft with
  the tag `v{version}`. Each leg then writes a manifest of its verified files,
  with name and size, and uploads it as the workflow artifact
  `desktop-release-{platform}`.
- A new job, `promote`, needs both legs. It runs in the `desktop-release`
  environment with `contents: read` and receives only `GH_TOKEN`. It checks
  out the release commit, installs Node and runs a promotion script that uses
  only Node built-ins. The script:
  1. Reads both manifests and requires one per platform, the tag
     `v{version}` of `packages/desktop/package.json`, one release id and the
     fixed inventory of each platform.
  2. Reads the release by id and requires the tag.
  3. Reads the asset list and requires exactly the fixed inventory, each
     asset with its manifest size and the `uploaded` state.
  4. Sends one release-level `PATCH /releases/{id}` with `draft: false`,
     `prerelease: false` and `make_latest: "true"`.
  5. Reads `GET /releases/latest` and requires the same id.
- A failed leg skips the promotion, so a partial release stays a draft and
  never becomes latest. A rerun of the failed jobs also reruns the skipped
  promotion.
- Design call (2026-11-24, my call): the updater sets
  `allowPrerelease = false`. Reason: the app then follows the same GitHub
  latest release that the download page links, and a pre-release or an
  unpromoted release never reaches it. Installed v0.1.0 apps keep
  `allowPrerelease = true`, and they still find the first full release as the
  first Atom entry, as the facts above show.
- Design call (2026-11-24, my call): the promotion is idempotent. When the
  release is already a full release, the script skips the `PATCH` and only
  checks that it is latest. Reason: a rerun after a failed latest check must
  not need a new version.
- Design call (2026-11-24, my call): the promotion check runs in a separate
  job with no npm install. Reason: the job that holds the token then runs no
  third-party package code. The GitHub client moves into a module with no
  npm imports, and the append-only publisher moves into its own module.
- Design call (2026-11-24, my call): the publisher removes `EP_PRE_RELEASE`
  and `EP_PRELEASE` from its environment. Reason: either value would turn the
  draft into a public pre-release before the check.
- Design call (2026-11-24, my call): the follow-up item
  `plans/follow-ups/desktop-linux-release-runs-after-macos-failure.md` closes
  with this change. Reason: Decision 1 chose its option E, a draft that turns
  public only after both platforms pass. A notarization that passes the time
  limit fails before any macOS upload, and a rerun of the failed jobs then
  repairs the release.
- The GitHub client keeps GET for reads, POST for asset uploads only, and one
  release-level PATCH with the fixed promotion body. It has no DELETE and no
  asset PATCH.

## Milestone 1: Documentation and protocol

Depends on: none

The protocol docs, the README files, the runbooks and the follow-up items
state the new release contract: drafts, the promotion, the fixed names and
the updater that follows the latest release.

- [x] `docs/protocol/cloud/desktop-distribution.md`: replace the pre-release
      rule with Decision 1, list the fixed asset names, describe the draft,
      the promotion and its check, and the updater that follows the latest
      release.
- [x] `docs/protocol/cloud/desktop-app.md`: remove "until then the shell
      publishes pre-releases only". Keep the page at 250 lines or fewer.
- [x] `docs/protocol/cloud/site.md`: remove the pre-release reason of the
      current release-list link. Keep the link.
- [x] `docs/development/cloud.md`, `packages/desktop/README.md` and
      `docs/ops/secrets.md`: describe the draft, the promotion and the token
      use.
- [x] `docs/mockups/src/fixtures/site.ts`: remove the pre-release reason
      from the comment.
- [x] Update the follow-up items that name pre-releases or the old release
      flow. Delete
      `plans/follow-ups/desktop-linux-release-runs-after-macos-failure.md`.

## Milestone 2: Draft releases, promotion and fixed names

Depends on: none

The packaging configuration, the release scripts, the workflow, the updater
and their tests implement the design.

- [x] `packages/desktop/electron-builder.yml`: version-free `artifactName`
      and `releaseType: draft`.
- [x] Release scripts: the draft check by id, the manifest, the promotion
      script and the split of the GitHub client from the publisher.
- [x] `.github/workflows/desktop-release.yml`: the manifest upload and the
      `promote` job.
- [x] `packages/desktop/src/updates.ts`: `allowPrerelease = false`.
- [x] Tests next to the changed code, and
      `xtask/tests/cli/desktop_release_workflow_tests.rs`.

## Milestone 3: Verification, commit, review, and pull request

Depends on: 1, 2

- [ ] Run the targeted tests, `npm run test --workspace @mokly-cloud/desktop`,
      `cargo xtask check --suite repository` and the gate suites that the
      `finish-work` skill names.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
- [ ] Check the file names in the packaging artifacts of the pull request.

## Post-merge follow-up (non-blocking)

- [ ] The first version-free release proves the draft reuse by the second
      leg, the promotion, the latest mark, the fixed latest download
      addresses, and the update of an installed v0.1.0 app.
