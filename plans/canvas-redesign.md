# Canvas redesign of the site and the viewer

Status: Active. On branch `calummoore/mokly-website-redesign-plan-af84`, no
pull request yet. The pull request that completes the work deletes this plan,
its [design record](./canvas-redesign-design.md) and its two decisions files,
[decisions 1 to 5](./canvas-redesign-decisions.md) and
[decisions 6 to 10](./canvas-redesign-decisions-viewer.md), as the `plans` skill
says. Ten decisions wait for Cal. Implementation starts after his answers.

The public site in `apps/site` uses Folio: a warm off-white page, one moss
accent and Inter. Cal found it boring and asked for a site that looks like a
design tool. From 18 to 20 November 2026, in a workspace on the old
`mokly-cloud` repository, he reviewed seven concepts and chose **Canvas**. The
site reads as a live design file: a dot-grid canvas, labelled frames, green
selection boxes with handles and size tags, spacing redlines, cursors for
people and agents, Geist and Geist Mono, and one signal green. The Canvas
prototype also covers Docs, Changelog, a new Pricing page, a dark scheme and a
signed-in viewer.

This change implements Canvas on the site and in the viewer, and updates the
site copy. It is mostly a redesign. Each large feature that the product does
not have yet is a decision in the decisions files. The change does not build
the Comment and Agent tabs of the viewer, comments, approvals, agent sessions
or presence. The site may still depict them, as Cal allowed.

## Design record

The [design record](./canvas-redesign-design.md) gives the design source,
Cal's decisions in force with their dates, and my design calls. Read it
before you start a milestone.

## Contract owners

- [Site](../docs/protocol/cloud/site.md),
  [Site home copy](../docs/protocol/cloud/site-copy.md),
  [Site design](../docs/protocol/cloud/site-design.md),
  [Site docs](../docs/protocol/cloud/site-docs.md),
  [Site delivery](../docs/protocol/cloud/site-delivery.md),
  [Site mockups](../docs/protocol/cloud/site-mockups.md) and
  [Marketing site](../docs/protocol/cloud/marketing-site.md).
- [Design tokens](../docs/protocol/cloud/design-tokens.md) and
  [Design token colors](../docs/protocol/cloud/design-tokens-color.md).
- [Viewer chrome](../docs/protocol/cloud/viewer-chrome.md),
  [Viewer host](../docs/protocol/cloud/viewer-host.md),
  [Folio viewer](../docs/protocol/cloud/folio-viewer.md),
  [Settings dialog](../docs/protocol/cloud/settings-dialog.md),
  [Product navigation](../docs/protocol/cloud/product-navigation.md) and
  [Product mockups: viewer](../docs/protocol/cloud/product-mockups-viewer.md).
- [Shell design](../docs/protocol/mokly-shell-design.md),
  [Shell brand](../docs/protocol/mokly-shell-brand.md),
  [Viewer palette](../docs/protocol/mokly-viewer-palette.md),
  [Viewer appearance](../docs/protocol/mokly-viewer-appearance.md),
  [Component inspector design](../docs/protocol/mokly-component-inspector-design.md)
  and [Comparison panes](../docs/protocol/mokly-comparison-panes.md).
- The [site README](../apps/site/README.md), the
  [UI package README](../packages/ui/README.md) and the
  [mockups README](../docs/mockups/README.md).

Replaced ways:

- Folio values → Canvas values. Consumers: the site, the app, the mockups
  and, under decision 1, `@mokly/ui`, the `mokly-html` Markdown style and the
  design mockup sheet. Milestone 1 adds Canvas as a named palette for the
  mockups. Milestone 3 makes it the default and deletes the Folio palette.
- The real dogfood stage on the home page → the Canvas spread, under decision 2. Consumers: `apps/site/scripts/stage.mjs`, `src/stage.ts` and their
  tests. Moved and deleted in Milestone 5, when decision 2 is A or D.

## Milestone 1: Mockups

Tags: mockup

Depends on: none

Draw every changed screen in the mockup catalogues first. Read the `mockups`
skill before you start. The mockup tests ban literal colours, and the Browse
design mockups import the shipped theme. So the mockups read Canvas from a
named palette, and the site and the app keep Folio until Milestone 3.

- [ ] Add Canvas as a named light and dark palette in `packages/tokens`, used
      only by the design mockups. Add the Geist faces to the mockup assets.
- [ ] Redraw the site chrome: header, mobile menu and footer with the scheme
      control. Update `design/site/home/menu`.
- [ ] Redraw `design/site/home` with the copy of the user decisions and the
      spread of decision 2.
- [ ] Redraw `design/site/docs` with the Layers panel, the page frame and the
      Inspect panel.
- [ ] Redraw `design/site/changelog` with Version history, the timeline, the
      filter and the release frames.
- [ ] Redraw the four legal screens in the new chrome.
- [ ] Add `design/site/pricing` (decision 3) and add it to the tour.
- [ ] Redraw the Browse shell mockups under `examples/basic/specs/design` in
      Canvas (decision 1): catalogue, stage (decision 6) and right panel
      (decision 7).
- [ ] Redraw the cloud viewer mockups under
      `docs/mockups/src/entries/product/viewer/`: the bar, the account menu
      with Theme, Settings and Sign out, and the compact More menu.
- [ ] Run the mockup checks that `AGENTS.md` and `docs/mockups/README.md`
      name. Smoke-test the changed pages in both schemes at 390px and 1440px.
- [ ] Update the design and the TODOs of this plan for each problem that the
      mockups show.

## Milestone 2: Documentation and protocol

Depends on: 1

State the new requirements and the answered decisions. Read the
`documentation` skill first.

- [ ] `site.md`: routes, header, footer, scheme control, Download for Mac,
      the desktop exception to the left-out list, Pricing (decision 3) and
      the source rule (decision 2). Remove "no plan prices", because the
      Plans and billing docs page lists them.
- [ ] `site-copy.md`: the new hero, features, closing and Storybook label.
- [ ] `site-design.md`: Canvas surfaces, type, layout, components, brand
      (decision 5) and the button contrast (decision 4). Replace the Plan
      cards section, which no site code implements.
- [ ] `site-docs.md`: the Layers panel, search in the panel, the Inspect
      panel, dark code panels and the mobile tree sheet.
- [ ] `site-delivery.md`: the script islands for the scheme control, the
      changelog filter, the scroll spies and the home demos.
- [ ] `site-mockups.md` and `marketing-site.md`: the pricing entry, the route
      table and the app links.
- [ ] `design-tokens.md` and `design-tokens-color.md`: the Canvas values.
- [ ] The viewer docs in the contract owners list, for decisions 1, 6, 7 and
      8, the bar, the account menu and the Appearance control.
- [ ] Update the site, UI package and mockups README files.

## Milestone 3: Tokens, fonts and brand

Depends on: 2

Change the default values in place, so that every surface keeps working.

- [ ] Make Canvas the default palette in `packages/tokens`, and delete the
      Folio palette. Add the signal and signal-fill roles that the design
      needs.
- [ ] Self-host Geist and Geist Mono for the site, the app and the mockups.
- [ ] Change the `@mokly/ui` theme, `crates/mokly-html/src/document.css` and
      `examples/basic/design.css` to the same values (decision 1).
- [ ] Replace Inter with Geist in `packages/viewer/src/shell/assets/fonts/`
      and `crates/mokly-server/src/assets.rs` (decision 1).
- [ ] Apply decision 4 to the three contrast tests and both docs.
- [ ] Apply decision 5 to every copy of the mark: brand files, favicon,
      social cards, shell, app, emails and desktop icon. Run `brand:build`.
- [ ] Run `cargo xtask mokly-fixtures` and commit any changed fixtures.

## Milestone 4: Site chrome and legal pages

Tags: ui

Depends on: 3

- [ ] Draw the dot-grid canvas base in the site stylesheets.
- [ ] Rebuild the header, the mobile menu and the footer. Add Pricing to the
      navigation when decision 3 is A or B.
- [ ] Add the footer scheme control as a script island, with `localStorage`
      and `?scheme=`. Set the scheme before the first paint.
- [ ] Restyle the legal pages and the 404 page.

## Milestone 5: Site home

Tags: ui

Depends on: 4

- [ ] Build the hero: the selected heading layer with live size and
      redline tags, the lead and the two actions.
- [ ] Build the Specs and Components spread under decision 2, with the
      Storybook label.
- [ ] Build the Specs panel with its scroll spy.
- [ ] Build the Browse, Review and Edit frames and their demos. The Browse
      demo draws the Overlay divider (decision 8).
- [ ] Build the open-foundation frame, the code-to-screen wires, the facts
      and the steps.
- [ ] Update `src/home.ts`, the page description and the social cards.
- [ ] When decision 2 removes the stage, delete it and its tests, remove
      `stage` from `SITE_OUTPUT_FIRST_SEGMENTS` and run `npm run site:routes`.

## Milestone 6: Site docs

Tags: ui

Depends on: 4

- [ ] Build the Layers panel with search, the version chip and the
      Changelog foot. Keep 44px rows.
- [ ] Frame the document, and add the Inspect panel with page facts, Edit on
      GitHub and On this page.
- [ ] Restyle the code panels and the pager. Keep tab-scoped tree scroll.
- [ ] Build the mobile sub-bar and the tree sheet.
- [ ] Add the showpiece when decision 10 is B or C.

## Milestone 7: Site changelog

Tags: ui

Depends on: 4

- [ ] Build Version history with its scroll spy, and the release timeline.
- [ ] Build the filter for Breaking, Features, Fixes and Performance.
- [ ] Build the release frames, with breaking notes as pinned callouts.

## Milestone 8: Site pricing

Tags: ui

Depends on: 4

Skip this milestone when decision 3 is C or D.

- [ ] Add `/pricing` to `src/navigation.ts`, then run `npm run site:routes`.
      `pricing` is already a reserved workspace name. Correct the module
      comment, which names app routes that the module does not hold.
- [ ] Build the plan frames, the compare table and the questions from
      `billing.md`.
- [ ] Point the plan actions as decision 3 says. Let the link check accept
      the app paths under option A. Add the page to the sitemap, the cards,
      the browser walk and the Lighthouse pages.

## Milestone 9: Browse shell in `@mokly/ui`

Tags: ui

Depends on: 3

- [ ] Restyle the catalogue, the top bar, the stage, the compare toolbar and
      the search in Canvas. Restyle the existing frame labels, and add size
      tags (decision 6).
- [ ] Move the inspector to a right panel with Inspect, Usage, Components and
      Changes. Show Changes only on changed entries (decision 7). Add next
      and previous change, and a slot for the cloud's check.
- [ ] Draw the selection outline with name and size tags from the instance
      boxes (decision 7).
- [ ] Restyle the standalone Appearance control in the bar.
- [ ] Add `⌘K` and `/` for search.

## Milestone 10: Cloud viewer chrome

Tags: ui

Depends on: 9

- [ ] Rebuild the bar: project switcher, publication pill, Search, History,
      Share and account. Remove the Settings button.
- [ ] Build the account menu with Theme, Settings and Sign out. Store the
      theme choice on the device.
- [ ] Fill the Changes tab's check slot with the Mokly check.
- [ ] Restyle the panels, the switcher, Share, History and the settings
      dialog.
- [ ] End the More menu with the same account rows on compact widths.

## Milestone 11: Verification, commit, review and pull request

Depends on: every other milestone

- [ ] Run `npm run site:check`, which includes the browser suite, and the
      report-only Lighthouse run. Report the scores of the home page.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record follow-up
      items under `plans/follow-ups/` for the rest, re-review once, and
      report.
- [ ] Record the follow-up item that decision 8, option D needs.
- [ ] Delete this plan, its design record and both decisions files when the
      `plans` skill says, under "Deleting the plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls with their dates, a permalink to this plan, and the
      follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Check the deployed site and the deployed app in both schemes on a real
      phone and in Safari.
