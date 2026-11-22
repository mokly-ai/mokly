# Canvas redesign of the site and the viewer

Status: Active. On branch `calummoore/mokly-website-redesign-plan-af84`, no
pull request yet. The pull request that completes the work deletes this plan
and its parts: the [design record](./canvas-redesign-design.md), the
[site design calls](./canvas-redesign-design-site.md), the
[viewer milestones](./canvas-redesign-milestones-viewer.md),
[decisions 1 to 5](./canvas-redesign-decisions.md),
[decisions 6 to 12](./canvas-redesign-decisions-viewer.md) and
[decisions 20 to 26](./canvas-redesign-decisions-docs.md) and
[decisions 27 to 32](./canvas-redesign-decisions-site.md) and
[decisions 33 and 34](./canvas-redesign-decisions-browse.md). Decisions 12
and 20 to 34 wait for Cal.

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
site copy. Cal's answers add four product features to the redesign: the full
canvas stage with pan and zoom, the box model in Inspect, a Swipe compare mode
and a Markdown fence that renders an HTML sample beside its code. The change
does not build the Comment and Agent tabs of the viewer, comments, approvals,
agent sessions or presence. The site may still depict them until go-live, as
Cal allowed. A [follow-up item](./follow-ups/viewer-live-presence.md) holds
presence.

## Design record

Read the [design record](./canvas-redesign-design.md) before each milestone.
It holds the dated decisions, design calls, contract owners and replaced ways.

## Milestone 1: Mockups

Tags: mockup

Depends on: none

Draw every changed screen in the mockup catalogues first, from a named Canvas
palette in `@mokly/ui`. The site and the app keep Folio until Milestone 3.

- [x] Add Canvas as a named, non-default palette in `@mokly/ui`, exposed by
      `packages/tokens`, and the Geist faces for the mockups.
- [x] Redraw the site chrome: header, mobile menu and footer with the scheme
      control. Update `design/site/home/menu`. Branch:
      `calummoore/canvas-redesign-m1-site-mockups-7l8g`.
- [x] Redraw `design/site/home` with the copy of the user decisions and the
      drawn demo app. The Browse demo shows the Swipe mode. Branch:
      `calummoore/canvas-redesign-m1-site-mockups-7l8g`.
- [x] Redraw `design/site/docs` with the Layers panel, the page frame, the
      Inspect panel and the HTML sample fence (decision 10). Branch:
      `calummoore/canvas-redesign-m1-site-mockups-7l8g`.
- [x] Redraw `design/site/changelog` with Version history, the timeline, the
      filter and the release frames. Branch:
      `calummoore/canvas-redesign-m1-site-mockups-7l8g`.
- [x] Redraw the four legal screens in the new chrome. Branch:
      `calummoore/canvas-redesign-m1-site-mockups-7l8g`.
- [x] Add `design/site/pricing` and add it to the tour. Branch:
      `calummoore/canvas-redesign-m1-site-mockups-7l8g`.
- [x] Redraw the Browse shell mockups under `examples/basic/specs/design`:
      the canvas stage with four frames, zoom and Fit, the floating catalogue
      and right panel, and the phone dock and sheets (decision 6).
      Branch: `calummoore/canvas-redesign-m1-browse-shell-mockups-5cqm`.
- [x] Draw the right panel states: Inspect with the selection, the props and
      the box model, Usage and the component tree as sections, and Changes
      with every compare mode and Swipe (decisions 7 and 8).
      Branch: `calummoore/canvas-redesign-m1-browse-shell-mockups-5cqm`.
- [x] Redraw the cloud viewer mockups under
      `docs/mockups/src/entries/product/viewer/`: the bar, the account menu
      with Theme, Settings and Sign out, the compact More menu, the check in
      Changes, and the overlays. Branch:
      `calummoore/canvas-redesign-m1-cloud-viewer-mockups-1osn`.
- [x] Run the mockup checks that `AGENTS.md` and `docs/mockups/README.md`
      name. Smoke-test the changed pages in both schemes at 390px and 1440px.
- [x] Update the design and the TODOs of this plan for each problem that the
      mockups show. Decisions 11 and 12 came from the mockups.

## Milestone 2: Documentation and protocol

Depends on: 1

State the new requirements and the answered decisions. Read the
`documentation` skill first. Each page whose behaviour is not built yet gets
a status line that links its milestone.

- [x] `site.md`: routes, header, footer, scheme control, Download for Mac,
      the desktop exception to the left-out list, Pricing and the app links.
      Relax the source rule until go-live: the site may draw a fictional demo
      app and features that ship before go-live. Remove "no plan prices".
      Branch: `calummoore/canvas-redesign-m2-protocol-docs-445q`.
- [x] `site-copy.md`: the new hero, features, closing and Storybook label.
      Branch: `calummoore/canvas-redesign-m2-protocol-docs-445q`.
- [x] `site-design.md`: Canvas surfaces, type, layout, components, the new
      brand and the 3:1 button pair. Replace the Plan cards section, which no
      site code implements. Branch: `calummoore/canvas-redesign-m2-protocol-docs-445q`.
- [x] `site-docs.md`: the Layers panel, search in the panel, the Inspect
      panel, dark code panels, the mobile tree sheet and the sample fence.
      Branch: `calummoore/canvas-redesign-m2-protocol-docs-445q`.
- [x] `site-delivery.md`: the script islands for the scheme control, the
      changelog filter, the scroll spies, the home demos and the sample fence.
      Branch: `calummoore/canvas-redesign-m2-protocol-docs-445q`.
- [x] `site-mockups.md`, `marketing-site.md`: pricing, routes, app links.
      Branch: `calummoore/canvas-redesign-m2-protocol-docs-445q`.
- [x] The token and palette docs (`design-tokens*.md`, `mokly-viewer-palette.md`,
      `mokly-viewer-appearance.md`): Canvas values from `@mokly/ui`. Branch:
      `calummoore/canvas-redesign-m2-protocol-docs-445q`.
- [x] `mokly-shell-design.md` and `mokly-shell-device-chrome.md`: the canvas
      stage, frame labels, size tags, pan, zoom, Fit, floating panels and the
      phone dock. Branch: `calummoore/canvas-redesign-m2-protocol-docs-445q`.
- [x] `mokly-component-inspector-design.md`, `mokly-viewer-selection.md` and
      the frame probe docs: the right panel, the selection and the box model.
      Branch: `calummoore/canvas-redesign-m2-protocol-docs-445q`.
- [x] `mokly-comparison-panes.md` (Swipe, compare on every frame) and
      `mokly-guides.md` (the HTML sample fence). Branch:
      `calummoore/canvas-redesign-m2-protocol-docs-445q`.
- [x] The cloud viewer docs: the bar, the account menu and the check slot.
      Branch: `calummoore/canvas-redesign-m2-protocol-docs-445q`.
- [x] Update the site, UI package and mockups README files. Branch:
      `calummoore/canvas-redesign-m2-protocol-docs-445q`.

## Milestone 3: Palette source, fonts and brand

Depends on: 2

The cloud surfaces take Canvas here. The open-source shell's default look
changes in Milestone 17, after decision 11.

- [x] Make `packages/tokens` import its shared values from the `@mokly/ui`
      palette module. Make Canvas the default for the site, the app and the
      cloud mockups, and delete the Folio values. Branch:
      `calummoore/canvas-redesign-m3-palette-fonts-and-raqu`.
- [x] Self-host Geist and Geist Mono for the site, the app and the cloud
      mockups. Branch: `calummoore/canvas-redesign-m3-palette-fonts-and-raqu`.
- [x] Self-host the Instrument Serif 400 face for the site's drawn demo app,
      as the mockups do in `docs/mockups/styles/site/fonts/`. Branch:
      `calummoore/canvas-redesign-m3-palette-fonts-and-raqu`.
- [x] Lower the button pair to 3:1 in the three contrast tests. Branch:
      `calummoore/canvas-redesign-m3-palette-fonts-and-raqu`.
- [x] Draw the new mark and the Geist wordmark in every copy: brand files,
      favicon, social cards, shell, app, emails and desktop icon. Run
      `brand:build`. Branch:
      `calummoore/canvas-redesign-m3-palette-fonts-and-raqu`.
- [x] Run `cargo xtask mokly-fixtures` and commit any changed fixtures.
      Branch: `calummoore/canvas-redesign-m3-palette-fonts-and-raqu`.

## Milestone 4: Site chrome and legal pages

Tags: ui

Depends on: 3, 15

- [x] Draw the dot-grid canvas base in the site stylesheets. Branch:
      `calummoore/canvas-redesign-m4-site-chrome-and-legal-bx98`.
- [x] Rebuild the header, the mobile menu and the footer. Milestone 9 adds
      the Pricing links with the route. Branch:
      `calummoore/canvas-redesign-m4-site-chrome-and-legal-bx98`.
- [x] Add the footer scheme control as a script island, with `localStorage`
      and `?scheme=`. Set the scheme before the first paint. Branch:
      `calummoore/canvas-redesign-m4-site-chrome-and-legal-bx98`.
- [x] Restyle the legal pages and the 404 page. Branch:
      `calummoore/canvas-redesign-m4-site-chrome-and-legal-bx98`.

## Milestone 5: Site home

Tags: ui

Depends on: 4

- [x] Build the hero: the selected heading layer with live size and
      redline tags, the lead and the two actions. Branch:
      `calummoore/canvas-redesign-m5-site-home-hb2n`.
- [x] Draw the Specs and Components spread as static components, with the
      Storybook label. Branch:
      `calummoore/canvas-redesign-m5-site-home-hb2n`.
- [x] Build the Specs panel with its scroll spy. Branch:
      `calummoore/canvas-redesign-m5-site-home-hb2n`.
- [x] Build the Browse, Review and Edit frames and their demos. Branch:
      `calummoore/canvas-redesign-m5-site-home-hb2n`.
- [x] Build the open-foundation frame, the code-to-screen wires, the facts
      and the steps. Branch:
      `calummoore/canvas-redesign-m5-site-home-hb2n`.
- [x] Update `src/home.ts`, the page description and the social cards.
      Branch:
      `calummoore/canvas-redesign-m5-site-home-hb2n`.
- [x] Remove the mockups build from the site checks and deployment, and
      `SITE_STAGE_PR` from the delivery docs and workflow. Branch:
      `calummoore/canvas-redesign-m5-site-home-hb2n`.
- [x] Delete the old stage and its tests. Remove `stage` from
      `SITE_OUTPUT_FIRST_SEGMENTS` and run `npm run site:routes`. Branch:
      `calummoore/canvas-redesign-m5-site-home-hb2n`.

## Milestone 6: Site docs

Tags: ui

Depends on: 4, 15

- [x] Build the Layers panel with search, the version chip and the
      Changelog foot. Keep 44px rows. Branch:
      `calummoore/canvas-redesign-m6-site-docs-570n`.
- [x] Frame the document, and add the Inspect panel with page facts, Edit on
      GitHub and On this page. Edit on GitHub opens the tracked guide
      source under `docs/guides/`, not the generated package copy. Branch:
      `calummoore/canvas-redesign-m6-site-docs-570n`.
- [x] Restyle the code panels and the pager. Keep tab-scoped tree scroll.
      Branch: `calummoore/canvas-redesign-m6-site-docs-570n`.
- [x] Build the mobile sub-bar and the tree sheet. Branch:
      `calummoore/canvas-redesign-m6-site-docs-570n`.

## Milestone 7: HTML sample fence

Depends on: 2

The fence is non-UI pipeline work plus its drawing. Keep the drawing in
Milestone 8.

- [x] Add the fence to the site Markdown pipeline: render the sample at build
      time in a sandboxed frame beside its code, with the line-to-element map.
      Branch: `calummoore/canvas-redesign-m7-html-sample-fence-9llh`.
- [x] Accept the fence in the guide checks of the site and the package.
      Branch: `calummoore/canvas-redesign-m7-html-sample-fence-9llh`.
- [x] Use the fence in the Your first screen guide of `docs/guides`. Branch:
      `calummoore/canvas-redesign-m7-html-sample-fence-9llh`.

## Milestone 8: Site docs sample and changelog

Tags: ui

Depends on: 6, 7, 15

- [x] Draw the sample fence: the frame label, the size tag, the viewport and
      state controls, and the wires between lines and elements. The scaled frames fit at
      320px, so the guide page does not overflow. Reuse the line helper of
      `code-panel.ts` in `sample-band.ts`, so the band draws no blank row
      after each line. Branch:
      `calummoore/canvas-redesign-m8-site-docs-sample-and-omtn`.
- [x] Build Version history with its scroll spy, and the release timeline.
      Branch: `calummoore/canvas-redesign-m8-site-docs-sample-and-omtn`.
- [x] Build the filter for Breaking, Features, Fixes and Performance.
      Branch: `calummoore/canvas-redesign-m8-site-docs-sample-and-omtn`.
- [x] Build the release frames, with breaking notes as pinned callouts. Move
      the trail rules from the docs sheet into a shared sheet. The page must
      not scroll sideways from 768px to 797px, and the panels sit below the
      sticky bar. Branch:
      `calummoore/canvas-redesign-m8-site-docs-sample-and-omtn`.

## Milestone 9: Site pricing

Tags: ui

Depends on: 4

- [x] Add `/pricing` to `src/navigation.ts`, then run `npm run site:routes`.
      `pricing` is already a reserved workspace name. Add Pricing to the
      header, the menu and the footer. Correct the module comment about app
      routes. Branch: `calummoore/canvas-redesign-m9-site-pricing-5q33`.
- [x] Build the plan frames, the compare table and the questions from
      `billing.md`. Branch: `calummoore/canvas-redesign-m9-site-pricing-5q33`.
- [x] Link Create an account and Start a 7-day trial to `/sign-up`, and let
      the link check accept the app paths. Add the page to the sitemap, the
      cards, the browser walk and the Lighthouse pages. Branch:
      `calummoore/canvas-redesign-m9-site-pricing-5q33`.

## Milestones 10 to 13 and 15 to 18

The viewer milestones and the added Milestones 15 to 18 are in
[the viewer milestones file](./canvas-redesign-milestones-viewer.md).

## Milestone 14: Verification, commit, review and pull request

Depends on: every other milestone

- [ ] Run the one full test pass on the merged primary branch (Cal,
      2026-11-20): the complete gate of `AGENTS.md`, `npm run site:check` and
      the report-only Lighthouse run, with the home page scores.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the diff against `origin/main` with the `implementation-review`
      skill after the push, then apply its fix rule and re-review once.
- [ ] Delete this plan, its design record and both decisions files when the
      `plans` skill says, under "Deleting the plan".
- [ ] Open the pull request, with the dated decisions and design calls, a
      plan permalink and the new follow-up items. Its CI is the final check.

## Post-merge follow-up (non-blocking)

- [ ] Check the deployed site and the deployed app in both schemes on a real
      phone and in Safari.
- [ ] Measure the home with Lighthouse again, now that the stage frame is
      gone, and narrow `plans/follow-ups/flaky-site-lighthouse-performance.md`.
- [ ] Before go-live, check every depicted feature on the site against the
      product, and remove what did not ship, as the relaxed source rule says.
