# Release content-addressed details with a breaking note

- **Severity:** Medium (estimate). **Effort:** Small (estimate).
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #224.
- **Location:** The next release pull request of Release Please,
  `CHANGELOG.md`, and `release-please-config.json:11`.
- **Reason:** The release pull request opens only after PR #224 merges.

- **Terms:**
  - **Release Please:** the release tool of this repository. It opens a
    release pull request that sets the version and writes `CHANGELOG.md`
    from the commit messages on `main`.
- **Background:**
  - PR #224 merged on 2026-10-29 as `f93afcea`, with a `feat!` title and a
    `BREAKING CHANGE:` footer.
  - The footer says: the catalogue index is version 9 and the entry detail is
    version 4. Each index record lists `detailId`. Each detail carries
    `detailId` and no `deploymentId`, and a removed detail no longer
    carries `generation`. Static builds write `mokly-viewer/deployment.json`.
    `@mokly/viewer` exports `EntryDetailV4` instead of `EntryDetailV3`.
  - The footer also says to rebuild and publish every catalogue again with
    the matching viewer, and that Mokly Cloud must accept index version 9.
  - `release-please-config.json:11` sets `bump-minor-pre-major`, so a
    breaking change before 1.0 raises the minor version. The last release
    is 0.17.0.
  - `docs/guides/start/upgrade.md` gives the content id step after the
    0.17.0 steps.
  - The repository rules forbid angle-bracket placeholders in a release pull
    request body, because Release Please parses that body as HTML.
  - On 2026-10-30 the release branch of Release Please holds release
    0.18.0. Its `CHANGELOG.md` entry carries the breaking note above,
    including the rebuild step and the Mokly Cloud step. The release is not
    published yet.
- **Task:**
  1. When Release Please opens the next release pull request, check that its
     version is the next minor version, 0.18.0.
  2. Check that its notes carry the breaking change above: index version 9
     with `detailId` in each record, entry detail version 4 without
     `deploymentId` or `generation`, the type `EntryDetailV4`, and
     `mokly-viewer/deployment.json`.
  3. Check that the notes tell each host to rebuild and publish every
     hosted catalogue again with the matching viewer.
- **Impact if no action:** A release can ship the format change as a patch,
  or without the upgrade step. Hosts with the old viewer then reject every
  new catalogue.
- **Needs:** The release pull request of Release Please. The task needs no
  credentials beyond review access.
- **Done when:** The release that holds PR #224 is published as a minor
  version, and its `CHANGELOG.md` entry carries the breaking-change note.
- **Related:**
  - [mokly-cloud-index-v9.md](./mokly-cloud-index-v9.md) pins this release in
    Mokly Cloud.
  - [hosted-upload-reuse-check.md](./hosted-upload-reuse-check.md) publishes
    with the release that this task checks, to confirm that hosted uploads
    skip unchanged details. It needs this release first.
