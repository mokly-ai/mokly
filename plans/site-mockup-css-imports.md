# Site mockup CSS imports

Status: Active. On branch `calummoore/stylesheets-listing-51ma`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

The `design/site/**/index.html` rule in `mokly.config.json` lists 51
stylesheets one by one, in cascade order. Every site mockup links all of
them, so a page loads the sheets of every other page. The list exists for
historical reasons. The site mockups were ported on 2026-09-17, before Mokly
0.14.0 could load CSS that a module imports. The list then lived in the
TypeScript constant `SITE_STYLE_FILES`. The move to Mokly 0.18.0 made the
configuration JSON data, so the constant was copied into the configuration.
The site redesign (#488) grew the list from 16 to 51 files.

This change moves the site CSS into module imports, the way that the
[styles guide](../docs/guides/authoring/styles.md#import-css) shows first and
the way that the Astro site in `apps/site` loads its CSS. Each site screen
imports the sheets that it needs. The site rule keeps only the font sheets.
The styles guide gets one paragraph that steers authors to imports. Mokly
code does not change.

## Decisions

### Decision 1 (2026-11-24): how an author gives each mockup only its CSS

- **Root question:** How does a catalogue author give each mockup only the
  CSS it needs, in a fixed order, without a long list kept by hand?
- **Chosen:** F. Move the site CSS into module imports. A site screen
  imports the shared sheets and its own sheets. The site rule keeps only the
  fonts. The styles guide gets a paragraph: import a mockup's CSS, and use
  configuration rules only for CSS that every page of a route needs.
- **Rejected:**
  - A. Index sheets and one rule per page family, documented in the guide.
    It keeps CSS routing in configuration, unlike the real site.
  - B. Globs in stylesheet lists. Path order replaces the authored order.
  - C. Named stylesheet groups in configuration. A new configuration field
    for a need that imports already meet. Its gain, per-file names in the
    Changes view, did not outweigh the new field.
  - D. Screens declare `stylesheets`. A fourth way to attach CSS.
  - E. One link per imported CSS file. New routes and pruning rules.
  - H, from the options check. Each site part becomes a catalogue component
    that declares its sheets. It adds Browse entries for page parts, and the
    cascade then follows first render order. Effort: Large.
- **Reason:** Imports already ship, match how the real site loads CSS, and
  need only a guide change in Mokly.
- **Completed by G, from the options check:** the guide paragraph also says
  what imports cannot do. An HTML screen has no module, so a rule for its
  page family gives it per-page CSS. Sheets for one colour scheme and remote
  URLs stay in rules. The Changes view names imported CSS by the bundle of
  the mockup.
- **Accepted costs:**
  - The Changes view names the bundle of the mockup, not the part sheet that
    changed, as
    [CSS evidence presentation](../docs/protocol/mokly-css-evidence-presentation.md)
    requires.
  - Each of the eight site bundles carries its own copy of the shared
    sheets, about 56 KB.

### Item 2 (2026-11-24): per-page sheets in the same change

The brainstorm asked whether each site mockup should load only its own
page's CSS, and in which change. The options were A, in this change, B, in a
later branch, and C, never. F's text, "a site screen imports the shared
sheets and its own sheets", chooses A. This is the agent's reading of the
user's choice, recorded on 2026-11-24. The options check added D, a parity
test for each page against its built Astro page, and E, one set of layout
sheets for the site and the mockups. Both are Large, and neither is in this
plan.

## Design calls

Each call is the agent's own, made on 2026-11-24. The options check of
2026-11-24 changed calls 2 to 5. Its report is in
`.context/site-mockup-css-imports/options-check.md`.

1. The site rule stays and keeps `geist.css` and `instrument-serif.css`.
   F's text keeps the fonts in the rule. The real site loads the faces on
   every page. Without a site rule, a site page falls through to the
   `**/*.html` rule and gets the Design styles. Rejected: an empty rule with
   the fonts in the shared style module, which repeats `@font-face` in each
   bundle.
2. Each site screen module imports two style modules: the shared module,
   then its area module. The shared module imports the shared block,
   `base.css` to `footer.css`, in today's order. `policy.css` goes into the
   legal area module. Each area module imports one area group in today's
   order. So each bundle keeps today's relative order by construction.
   Rejected: `SiteLayout` imports the shared module, because the order then
   depends on import sorting. Rejected: each part imports its own sheet,
   because the four responsive sheets serve many parts. Added during
   Milestone 1: a style module is a TypeScript module in
   `docs/mockups/src/screens/design/site/styles/` that holds only
   side-effect CSS imports. A screen module imports its style modules
   before its other imports, so no CSS that a part imports can come first.
   The installed `import/order` rule of `eslint-plugin-import-x` 4.17.1
   does not rank side-effect imports, so their authored order stays.
3. The area groups that the `base.css` header declares give the map from
   pages to sheets. A one-time browser script confirms the map before the
   pixel check. For each site document, it marks a sheet as used when one
   of its selectors matches an element, with dynamic pseudo-classes removed
   and media conditions ignored. When two areas use one sheet, both area
   modules import it, in today's order. Rejected: the class-name scan,
   because general classes inside another page's selectors give false
   matches. Added during Milestone 1: the script ran on the build from
   before the change, where each sheet is its own link, and confirmed the
   map. No page matches a rule of another area's sheet, so no area module
   imports a sheet of another area.
4. `siteStylesheets()` returns the site rule's font sheets first, then the
   imported sheets, in today's order. `siteStyles()` takes an optional
   screen. The tests of one page read only that page's CSS. The tokens,
   parity, container, chrome, and menu tests still read all site CSS.
   Rejected: reading the bundles from the build output, because
   `lightningcss` reprints them. Added during Milestone 1: the helper reads
   the imported sheets from the module graph of each site entry, in the
   order in which Mokly bundles them: first reach, depth first, in import
   order, over the relative imports. Without a screen, it reads a legal
   document first and then the site tour, so `policy.css` keeps its place
   after the shared block and all site CSS keeps today's order.
5. The change makes no visible change to a site mockup. When the removal of
   a sheet from a page changes a capture, or drops a rule that the script
   of call 3 matches, the page keeps that sheet. Each kept sheet gets a
   follow-up item that asks the user which side is right. Reason: the
   mockups are the visual source of truth, as
   [site mockups](../docs/protocol/cloud/site-mockups.md) says.
6. No Mokly code, warning, or validation changes.

Contract owners:

- [Mockup tooling](../docs/protocol/cloud/mockup-tooling.md).
- [Site mockups](../docs/protocol/cloud/site-mockups.md).
- The [mockups README](../docs/mockups/README.md).
- The [styles guide](../docs/guides/authoring/styles.md).

Replaced ways:

- The site stylesheet list in `mokly.config.json` → module imports of the
  site screens. Consumers: every site mockup document, the header of
  `docs/mockups/styles/site/base.css`, `siteStylesheets()` and
  `siteStyles()` in `docs/mockups/src/_tests_/design-site-test-helpers.ts`,
  and the tests that call them. Moved in Milestone 1. Deleted in
  Milestone 1.

## Milestone 1: Site mockups import their CSS

Tags: mockup

Depends on: none

The site screens import their CSS. The site rule keeps only the fonts. The
built site views look the same as before. The work runs in two commits, so
that each pixel check has one cause.

- [x] Build the catalogue on `origin/main` and capture every site view in
      both viewports and both schemes. Save the captures under
      `.context/site-mockup-css-imports/before/`.
- [x] First commit: move the whole list into one style module.
  - [x] Add one site style module that imports all 49 site sheets in
        today's order. Import it from each site screen module.
  - [x] Reduce the `design/site/**/index.html` rule to the two font sheets.
  - [x] Change `siteStylesheets()` to return the font sheets, then the
        imported sheets.
  - [x] Run `npm run mockups:check`, `npm run mockups:test`, and
        `npm run mockups:typecheck`.
  - [x] Capture again and compare. Expect no changed pixel.
- [x] Second commit: split the module by area.
  - [x] Run the browser script of design call 3 on the build. Save the map
        under `.context/site-mockup-css-imports/`.
  - [x] Split the module into the shared module and one area module for
        home, docs, changelog, pricing, and the legal pages, as design
        call 2 says.
  - [x] Add the optional screen to `siteStyles()`. Pass it from the tests
        of one page.
  - [x] Update the header of `docs/mockups/styles/site/base.css`.
  - [x] Run the three mockup commands again.
  - [x] Capture again under `.context/site-mockup-css-imports/after/` and
        compare. Keep each sheet whose removal changes a pixel, and record
        a follow-up item for it, as design call 5 says.
- [x] Update the design and the TODOs of this plan for each problem that
      the comparison shows.

Evidence: `.context/site-mockup-css-imports/`, with `scripts/`, `before/`,
`step1/`, `after/`, `compare-step1.json`, `compare-after.json`,
`sheet-usage-map.json` and `logs/`.

## Milestone 2: Documentation

Depends on: 1

The docs state the new way: the site screens import their CSS, and the
styles guide steers authors to imports.

- [x] Update [mockup tooling](../docs/protocol/cloud/mockup-tooling.md):
      the site rule links the fonts, and the site screens import their
      sheets.
- [x] Update [site mockups](../docs/protocol/cloud/site-mockups.md): each
      site document gets the fonts from the rule and its page's sheets from
      its imports.
- [x] Update the stylesheet paragraph and the key code list of the
      [mockups README](../docs/mockups/README.md).
- [x] Add a paragraph to the [styles guide](../docs/guides/authoring/styles.md):
      import the CSS of a mockup. Use a rule for an HTML screen, for sheets
      of one colour scheme, and for remote URLs. Say that the Changes view
      names imported CSS by the bundle of the mockup.
- [x] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

Evidence: `.context/site-mockup-css-imports/logs/`, with
`m2-format-check.log`, `m2-markdown-links.log` and `m2-guides.log`.

## Milestone 3: Verification, commit, review, and pull request

Depends on: 1, 2

- [ ] Run the complete gate, `cargo xtask check`. Rerun each failed suite
      with `--suite`.
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
