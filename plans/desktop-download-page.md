# Desktop download page

Status: Active. On branch `calummoore/dedicated-download-page-3rnj`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

The home's **Download for Mac** opens the GitHub release list of the desktop
app, `https://github.com/mokly-ai/mokly-desktop/releases`. A reader then has to
find the right file among the assets of several releases. This change adds a
`/download/` page to the public site. The page offers the installer of each
supported computer and links each one to GitHub's fixed download address of
the latest release. The reader never sees a GitHub page. The change does not
cover Windows, release notes, checksums or system requirements, and it adds no
script island.

Contract owners:

- [Public site](../docs/protocol/cloud/site.md).
- [Site home copy](../docs/protocol/cloud/site-copy.md).
- [Site design pages](../docs/protocol/cloud/site-design-pages.md).
- [Site mockups](../docs/protocol/cloud/site-mockups.md).
- [Desktop distribution](../docs/protocol/cloud/desktop-distribution.md),
  which fixes the asset names that the page links.
- The [site README](../apps/site/README.md).

## Decisions

Cal answered decisions 1 and 2 on 2026-11-24 in the brainstorm of this
workspace. Its notes are in `.context/download-page/brainstorm.md`.

1. **How the download links stay correct.** Chosen: **C**. Every desktop
   release becomes a full GitHub release, marked latest only after a check of
   all its files, and the installer names hold no version. The page links
   `https://github.com/mokly-ai/mokly-desktop/releases/latest/download/{name}`
   and never changes for a release.
   - Rejected: **A**, a version record in the site source that a person
     updates after each release, because it needs a manual step for each
     release. **B**, a GitHub lookup at site build time with a site redeploy
     for each release, because it adds network access to the site build and
     links two workflows. **D**, a Mokly-hosted bucket with fixed names,
     because it adds infrastructure and credentials.
   - Left out: read the version from `packages/desktop/package.json`, because
     that version changes before the files upload. Look the release up in the
     browser or in the origin router, because the site makes no runtime API
     calls and the router calls no API.
   - Cal ordered the release change first. PR #496 merged it on 2026-11-24 as
     `10a30afe4`. The fixed names are in
     [Desktop distribution](../docs/protocol/cloud/desktop-distribution.md).
2. **How the page shows release status.** Chosen: **B**. The page shows no
   pre-release or status label.
   - Rejected: **A**, the version with a "Pre-release" chip. **C**, a line
     that says what the app does not do yet, because it explains more than
     the copy rules permit.
3. **When desktop 0.2.0 ships.** Chosen by Cal on 2026-11-24: **A**. The
   orchestrator merges release pull request #486 at once, watches the
   release, and checks the four download addresses. 0.2.0 is the first
   release with fixed names. Until it is promoted, every link of the page
   returns 404, so this pull request merges only after it. #486 merged as
   `4bd5e0fe8` on 2026-11-24, and `v0.2.0` is the latest release. The four
   addresses return their installers.
   - Rejected: **B**, Cal merges #486 later, because an early run of the new
     release path leaves time to fix it before the page depends on it.

## Design calls

My calls of 2026-11-24, each with its reason:

- The route is `/download/`, a new site page, not a docs guide. Reason: the
  goal is one destination for a download, and the docs describe the CLI.
- The page offers four installers in this order: the Mac `.dmg` for Apple
  silicon, the Mac `.dmg` for Intel, the Linux `.AppImage` and the Linux
  `.deb`. Reason: these are the installers that a release publishes. Only the
  updater uses the `.zip` files and the blockmaps.
- The page does not detect the reader's computer. Reason: browsers report
  Apple silicon Macs as Intel, and detection needs a script island. The page
  names each build plainly, Apple silicon first, because new Macs use it.
- The page shows no version. Reason: a fixed link always gives the latest
  release, and the site cannot know its version without a lookup.
- The home's **Download for Mac** keeps its label and opens `/download/`. The
  header, the menu and the footer do not change. Reason: the chrome is a
  separate contract, and Cal did not ask to change it.
- `download` joins the reserved site segments in `crates/mkc-domain`, so no
  workspace can take the name. Reason: the site owns each first segment of
  its routes.
- The page copy is new public copy. Cal approves its words at the mockup
  review, and the documentation milestone records them in `site-copy.md`.

## Milestone 1: Mockups

Tags: mockup

Depends on: none

Add the download screen to the site mockups and link it from the home.

- [ ] Add the `design/site/download` entry and its screen under
      `docs/mockups/src/screens/design/site/`, in mobile and desktop and in
      light and dark, from the shared site parts.
- [ ] Make the home hero's **Download for Mac** open the download screen, and
      add the screen to the site tour.
- [ ] Add the download styles under `docs/mockups/styles/site/`.
- [ ] Update the site mockup tests, such as
      `docs/mockups/src/_tests_/design-site-home.test.ts`.
- [ ] Run the mockup check that `docs/mockups/README.md` gives. Save
      screenshots under `.context/download-page/`.
- [ ] Get Cal's approval of the screen and its copy.
- [ ] Update the design and the TODOs of this plan for each problem that the
      mockups show.

## Milestone 2: Documentation and protocol

Depends on: 1

- [ ] `site.md`: add the `/download` route, point **Download for Mac** at it,
      and replace the desktop exception of Ahead-Of-Release Pages.
- [ ] `site-copy.md`: add the approved download copy.
- [ ] `site-design-pages.md`: add the Download page layout.
- [ ] `site-mockups.md`: add the download entry and the tour step.
- [ ] The site README: add `/download/` to its responsibilities.

## Milestone 3: Reserve the route

Depends on: 2

- [ ] Reserve `download` in `crates/mkc-domain/src/slug.rs`, with its test.

## Milestone 4: Site page

Tags: ui

Depends on: 3

- [ ] Add `download` to `SITE_PATHS` and `SITEMAP_PATHS` in
      `apps/site/src/navigation.ts`, and the four installer links.
- [ ] Run `npm run site:routes` and commit the regenerated segment modules,
      also `packages/desktop/src/site-segments.ts` when it changes.
- [ ] Add `apps/site/src/pages/download.astro` and its styles, matching the
      mockup. Keep the parity test of the site styles passing.
- [ ] Point `Actions.astro` at `/download/`, and remove
      `EXTERNAL_LINKS.desktopReleases` when nothing else uses it.
- [ ] Update the site tests and the browser specs, the route walk included.
- [ ] Smoke-test the built page at 320px, 390px and 1440px in both schemes.

## Milestone 5: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [x] Check that each of the four latest download addresses returns the
      installer, after desktop 0.2.0 is promoted.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
