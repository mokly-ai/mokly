# Public Site And Docs

Move the public Mokly website into this repository: a static marketing site,
canonical documentation for the CLI, catalogue and Mokly Cloud, a changelog
rendered from `CHANGELOG.md`, and the Terms and Privacy documents. The cloud
repository keeps only the logged-in application and its sign-in and sign-up
routes. This plan supersedes the marketing milestones of the cloud repository's
initial-scope plan.

The site is written ahead of the cloud product. It describes the product Mokly
is becoming (browse, review, edit, open foundation) and documents the cloud
from its protocol docs. A go-live alignment pass reconciles `status: ahead`
pages with shipped scope before the domain goes live.

## Shared Decisions

- **Location.** The site is an npm workspace package at `site/`, added through
  a root `workspaces` field so one lockfile and one `npm audit` cover it. The
  published `@mokly/mokly` package keeps its `files` allowlist; a package test
  proves the tarball contains nothing from `site/`. The site may import
  `@mokly/mokly` from the workspace; the package never depends on the site.
- **Framework.** Astro with static output, MDX content collections for docs,
  Pagefind indexed at build time, and React islands only where interaction is
  required. No documentation framework or theme. The docs layout is built from
  the same Folio tokens, header and footer as the marketing pages.
- **Design.** Folio, as selected in the cloud repository on 2026-09-15. Tokens
  are defined once as CSS custom properties on the document root; stylesheets
  never contain literal colors. Light and dark follow the OS preference with a
  `data-color-scheme` override for deterministic captures.
- **Mockups first.** The Folio marketing screens are ported into this
  repository's example design catalogue under `examples/basic` before the site
  is implemented, so the design source survives the cloud repository's
  planned removal and future refinements happen here.
- **Links to the app.** Sign in and Get started point at the app origin, a
  single build-time setting `SITE_APP_ORIGIN` (default `https://app.mokly.ai`,
  to be confirmed) with paths `/sign-in` and `/sign-up`. Nothing on the site
  calls the cloud API; there are no cookies and analytics is off by default.
- **Real content only.** The hero stage renders this repository's own example
  catalogue at build time. The changelog is parsed from `CHANGELOG.md`. The
  installed version is read from the workspace package. No invented customers,
  counts, integrations, dates or release facts.
- **Verified documentation.** Every command, flag, option and field in the
  docs is verified against the current code by a test, not by reading. Where a
  cloud protocol doc and this repository's code disagree about the CLI, this
  repository's code is right and the disagreement is reported to the user.
- **Checks.** Site build, typecheck, unit tests, link check and browser tests
  run inside `cargo xtask check`. Lighthouse runs as its own required CI job.

## Inputs From The Cloud Repository

Read as data from the cloud repository `mokly-ai/mokly-cloud` at commit
`47ede2e462699ea6538b23da651822931fd041ed` on branch
`origin/calummoore/sydney-v1` (local checkout `mokly-cloud/untitled` on the
user's machine). The marketing mockups will be removed from that repository, so
always read them from this commit with `git show <sha>:<path>` rather than from
the branch tip, and copy them into `.context/cloud-inputs/` (ignored) for
reference during implementation:

- `docs/product-direction.md` — positioning and phases.
- `docs/protocol/design-tokens.md`, `product-copy.md`, `marketing-site.md`.
- `docs/protocol/product-navigation.md`, `viewer.md`, `settings-dialog.md`
  — cloud docs section.
- `docs/protocol/screen-comments.md`, `approvals.md` — review and edit
  section.
- `docs/mockups/src/screens/marketing/*.tsx`, `fixtures/product.ts`,
  `styles/marketing/folio-*.css` and the generated captures under
  `.context/mockups-served/output/marketing/` — Folio visual reference.

## Open Questions

Record answers in `docs/protocol/site.md` during Milestone 1.

1. **App origin.** Confirm `https://app.mokly.ai` for `SITE_APP_ORIGIN`.
2. **Host and domain.** Cloudflare Pages is recommended: the repository
   already deploys previews there with a pinned Wrangler and stored
   credentials, and it provides `pr-<number>` preview aliases. Confirm the
   host and the production domain (for example `mokly.ai` or `www.mokly.ai`).
3. **Mockups in this repository.** Confirm porting the five Folio marketing
   screens into `examples/basic` (recommended) rather than treating the cloud
   captures as the only reference.
4. **Hero stage caption.** The framed catalogue needs a real pull request
   label. Proposed: a merged pull request from this repository named in the
   site configuration and verified against `CHANGELOG.md` by a test.
5. **Lighthouse thresholds.** Proposed minimum category scores at 390px and
   1440px: performance 0.95, accessibility 1.0, best practices 0.95, SEO 0.95.
6. **Analytics.** Default off. If wanted later, name a cookie-free provider;
   it must be a build-time setting that defaults to disabled.

## Milestone 1: Protocol, Positioning And Plan

Define the complete site contract before any mockup or code lands. Stop for
review when the documents and the home copy are ready.

- [x] Create this plan and add it to `plans/README.md`.
- [x] Copy the cloud inputs listed above from commit `47ede2e` into
      `.context/cloud-inputs/` and note any CLI statement in them that
      disagrees with this repository.
- [x] Write `docs/protocol/site.md`: purpose and boundary with the cloud
      repository, route table (`/`, `/docs/…`, `/changelog`, `/terms`,
      `/privacy`), app-origin links, shared header and footer (desktop and
      mobile variants, skip link, `aria-current`), positioning and the four
      product phases, changelog rules (version, date, release link, Mokly CLI
      label, empty state), legal rules (Markdown files, exact placeholder
      bodies, no invented dates), the copy rules, the `status: ahead`
      frontmatter convention, the go-live alignment checklist, and the answers
      to the open questions.
- [x] Draft the full home copy in `docs/protocol/site.md` against the
      positioning: eyebrow, two-line hero heading with the second line in the
      accent, lead, note, hero stage caption rules, three numbered features
      (browse, review, edit), and the open-foundation closing with the
      three-step workflow. Use the existing Folio copy as the tone reference.
- [x] Write `docs/protocol/site-design.md`: Folio surface, accent, status and
      focus tokens for both schemes, type roles and the hero rule, spacing
      scale, layout constants, breakpoints, radii, focus ring, brand and
      wordmark, the scheme override attribute, and the rule that stylesheets
      never contain literal colors.
- [x] Write `docs/protocol/site-docs.md`: docs information architecture
      (getting started, authoring, catalogue, CLI reference, continuous
      integration, Mokly Cloud, reference, review and edit), content
      collection frontmatter (`title`, `description`, `section`, `order`,
      `status`), the docs layout (sidebar from frontmatter, on-this-page from
      headings, previous and next, copyable code blocks, Pagefind search), the
      version source, the CLI reference verification rule, and the explicit
      allowlist for publishing `docs/protocol` documents from their Markdown
      source with link rewriting rules for excluded documents.
- [x] Write `docs/protocol/site-delivery.md`: static-only rule, per-page
      metadata (title, description, canonical, Open Graph and Twitter cards
      with generated images), `sitemap.xml`, `robots.txt`, the changelog Atom
      feed, accessibility requirements, the test matrix (build, link check,
      Playwright at 390px and 1440px in light and dark, Lighthouse
      thresholds), the `cargo xtask check` and CI wiring, the deployment
      workflow, pull request previews and the release process.
- [x] Add the four documents to `docs/protocol/README.md` and add a Website
      section to the root `README.md` that links to them and to this plan.
- [x] Update `docs/protocol/npm-release.md` so its CI section describes the
      site jobs that later milestones add.
- [x] Validate the changed Markdown with Prettier, review the diff, commit
      with Conventional Commits and push. Stop for review of the protocol
      documents and the home copy.

## Milestone 2: Folio Site Mockups

Tags: mockup

Port the Folio marketing screens into this repository's example design
catalogue so every site screen exists as a mockup before implementation. Stop
for review with generated pages inspected in both viewports and schemes.

- [x] Add a `Site` collection under `examples/basic/entries/design/site/`
      with one component per screen and one screen-spec page of at most five
      screens: home, docs page, changelog, terms, privacy. Each screen renders
      mobile and desktop variants in light and dark.
- [x] Port the Folio header, footer, wordmark, hero, feature grid, closing,
      document page, release entry and policy empty-state parts as plain
      semantic controls styled from the Folio tokens, and add those tokens to
      the example's stylesheets without literal colors outside the token
      definitions. The example's registered `@firna/ui` controls carry their
      own theme and cannot express Folio, so the mockups depict the markup the
      site itself implements; recorded in `docs/protocol/site-design.md`.
- [x] Broaden the home mockup to the approved copy from Milestone 1: three
      numbered features, the open-foundation closing, and the framed
      catalogue stage with a pull request label and a Ready for review badge.
- [x] Design the docs page mockup with the left sidebar, on-this-page list,
      previous and next links, a code panel with a copy control and the search
      control, on both viewports.
- [x] Add a `site` user flow that reuses the five screens in the order home →
      docs → changelog → terms → privacy, with links back to each screen.
- [x] Update `docs/protocol/site-design.md` with the mockup ids and routes,
      and update the design catalogue docs that list collections.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`
      and smoke-test the pages through `npm run dev`; capture screenshots at
      390px and 1440px in both schemes for the review.
- [x] Run `cargo xtask check`, commit and push. Stop for review.

## Milestone 2A: Site Design Directions

Tags: mockup

Explore five refined directions for the public site before implementation.
Each direction is applied consistently to the home, a documentation page and
the changelog, stays within the Folio tokens and the Mokly catalogue chrome,
and is registered in the design catalogue for side-by-side review. The user
selects one afterwards; the selected direction replaces the baseline screens
and the others are retired in a later milestone.

- [x] Write `docs/protocol/site-directions.md` with the shared rules, the five
      direction intents and the screen inventory.
- [x] Scaffold the `Directions` collection with one collection, three routes
      and one stylesheet per direction, config rules, watch paths and the
      `tests/design_site_directions.test.ts` coverage.
- [x] Editorial direction: home, docs and changelog.
- [x] Product direction: home, docs and changelog.
- [x] Grid direction: home, docs and changelog.
- [x] Minimal direction: home, docs and changelog.
- [x] Bands direction: home, docs and changelog.
- [x] Capture every direction at 390px and 1440px in light and dark and
      review them together.
- [x] Record the user's selection in `docs/protocol/site-directions.md`.
- [ ] Run `cargo xtask check`, commit and push. Stop for review.

## Milestone 2B: Refine The Selected Direction

Tags: mockup

Apply the user's refinements to the Product direction in place, following the
Selection section of `docs/protocol/site-directions.md`. Stop for review with
screenshots at both viewports and schemes.

- [x] Remove the utility bar from the Product home, docs and changelog; move
      search into the header, the version chip to the sidebar top and the
      location breadcrumb to the title eyebrow.
- [x] Add hover states to every link and control in the Product stylesheet
      and cover them with a test that asserts each interactive class has a
      `:hover` rule that changes more than color.
- [x] Rework the Product docs page: unfilled sidebar on the canvas with a
      hairline rule, all sections expanded with rubric heads, hover and
      current fills, Editorial's ruled document structure and pull-quote
      lead, an on-this-page rail on its own hairline, card-style previous
      and next.
- [x] Update `tests/design_site_product.test.ts` for the new structure and
      capture the three screens at 390px and 1440px in light and dark.
- [x] Run `cargo xtask check`, commit and push. Stop for review.

## Milestone 2C: Promote The Product Direction

Tags: mockup

Make the refined Product direction the baseline site mockup and retire the
exploration. After this milestone `design/site/` holds the five site screens
in the Product design, the directions collection no longer exists, and the
protocol documents describe one design.

- [x] Move the Product screens and parts to `examples/basic/entries/design/site/`
      as the baseline home, docs and changelog; rework terms and privacy to
      the Product chrome; keep the ids `design-site-*`, the routes under
      `design/site/`, the `design-site-tour` use case, and both schemes.
- [x] Replace `examples/basic/generated/site.css` with the Product layout and
      delete `site-<slug>.css` for every direction; keep `site-tokens.css`.
- [x] Delete `examples/basic/entries/design/site/variants/`, the direction
      config rules and watch paths, `docs/protocol/site-directions.md`, and
      the direction tests; fold the Product tests into the baseline site
      tests.
- [x] Update `docs/protocol/site-design.md` (components, docs layout and
      mockups sections), `docs/protocol/site-docs.md` (docs layout), the
      protocol index, the example README and the inventory test list so they
      describe the promoted design only.
- [x] Capture the five screens at 390px and 1440px in light and dark.
- [ ] Run `cargo xtask check`, commit and push. Stop for review.

## Milestone 3: Site Workspace Package And Checks

Create the site package and wire its checks into the repository gate before
any page is styled. At the end the site builds an unstyled placeholder index
and every check passes locally and in CI.

- [x] Add `site/` with its own `package.json`, `astro.config.mjs`,
      `tsconfig.json` and `README.md`; add `workspaces: ["site"]` to the root
      `package.json`; install Astro, MDX, the React integration and Pagefind
      with `npm install` in the workspace so the newest versions are used.
- [x] Add typed `SITE_APP_ORIGIN`, `SITE_ORIGIN` and `SITE_STAGE_PR`
      settings; validate origins and positive integer pull requests, with
      the local-only defaults defined by the delivery contract.
- [x] Add root ignore entries for `site/dist`, `site/.astro` and
      `site/node_modules` to `.gitignore`, `.prettierignore` and the ESLint
      config; keep root Prettier and ESLint covering site sources; use
      `astro check` for `.astro` files.
- [x] Add site scripts: `site:build`, `site:typecheck`, `site:test`,
      `site:links`, `site:browser`, a clearly failing `site:lighthouse`
      placeholder and an ordered `site:check` aggregate; add
      `site/scripts/check-links.mjs` walking `site/dist` for internal hrefs,
      anchors, asset references and frame sources.
- [x] Add a site Playwright configuration that serves `site/dist` and a
      smoke test that loads the placeholder at 390px and 1440px.
- [x] Extend `xtask/src/check.rs` and its tests so `cargo xtask check` runs
      `site:check` after the package checks; update the README developer setup
      and `docs/protocol/npm-release.md`.
- [x] Add a package test proving the packed tarball contains no `site/`
      entries and that the root package's dependencies are unchanged.
- [x] Verify a clean workspace install, the all-category dependency audit,
      and the site checks on the minimum supported Node 22.14 runtime.
- [x] Make package license inspection resolve npm workspace links, preserving
      rejection of missing or unlicensed targets, with a regression test.
- [x] Handle an empty docs set in the Pagefind post-build step without
      indexing marketing content or inventing records.
- [x] Scope and document the Astro/Unifont Undici override needed for Node
      22.14, and smoke-test the dispatcher API used by Unifont.
- [x] Run `cargo xtask check`, commit and push. Stop for review.

## Milestone 4: Design System, Header, Footer And Empty Routes

Tags: ui

Implement Folio as CSS custom properties and the shared chrome, with an empty
page for every route. Stop for review with screenshots at both viewports and
schemes.

- [ ] Emit the Folio tokens as `--site-*` custom properties on the document
      root for light and dark, following the OS preference and the
      `data-color-scheme` override; add a test that no site stylesheet
      contains a literal color outside the token file.
- [ ] Implement base typography, spacing and layout utilities from the type
      roles, spacing scale, `contentMax`, prose measure, gutters and section
      rhythm; add the visible focus ring and 44px target rules.
- [ ] Implement the wordmark and mark, the desktop and mobile header, the
      footer, the skip link, `aria-current` marking and the page layout.
- [ ] Add empty pages for `/`, `/docs`, `/changelog`, `/terms` and `/privacy`
      with per-page metadata, `sitemap.xml` and `robots.txt`.
- [ ] Extend the browser test to walk every header and footer link at 390px
      and 1440px in light and dark and to assert the app-origin links.
- [ ] Capture screenshots at both viewports and schemes; compare with the
      Milestone 2 mockups.
- [ ] Run `cargo xtask check`, commit and push. Stop for review.

## Milestone 5: Home, Changelog, Terms And Privacy

Tags: ui

Build the marketing pages from the approved copy and real sources. Stop for
review with screenshots.

- [ ] Implement the home page: hero with the approved copy and both actions,
      the framed catalogue stage, three numbered features in a column grid on
      desktop, and the closing with the three-step workflow and both actions.
- [ ] Render the stage from this repository's example catalogue at build
      time: run the example build, copy the chosen screen documents and their
      stylesheets for mobile and desktop in light and dark into the site
      output, and embed them in the framed stage with the configured pull
      request label and Ready for review status; add a test that the label
      names a pull request present in `CHANGELOG.md`.
- [ ] Parse `CHANGELOG.md` into typed release entries (version, date,
      compare or release link, grouped notes); render `/changelog` with the
      Mokly CLI label, the empty state, and the Atom feed; add unit tests
      including the empty file and a malformed heading.
- [ ] Add `site/src/content/legal/terms.md` and `privacy.md` with the exact
      placeholder bodies, render the readable document layout with navigation
      between the two policies, and show a date only when the file declares an
      approved one.
- [ ] Generate Open Graph images at build time from the page title using
      the Folio tokens; add card metadata to every page.
- [ ] Extend the browser test to exercise both home actions and the
      changelog, terms and privacy pages at both viewports and schemes.
- [ ] Add the Lighthouse configuration with the agreed thresholds and a
      `site:lighthouse` script; run it locally against `site/dist`.
- [ ] Run `cargo xtask check`, commit and push. Stop for review.

## Milestone 6: Docs Layout And CLI Documentation

Tags: ui

Build the docs layout and write the sections that can be verified against this
repository today. Stop for review.

- [ ] Implement the docs layout: sidebar generated from the content
      collection (section, order, title), on-this-page list from MDX headings,
      previous and next links, copyable code blocks in the Folio code panel
      style, and Pagefind search indexed after the build with a small island
      for the search control.
- [ ] Add the content collection schema with `status: ahead` support hidden
      from readers, and read the current version from the workspace package
      for every install snippet.
- [ ] Write Getting started: install, configure, author a first screen,
      `mokly build`, `mokly serve`.
- [ ] Write Authoring, one page per concept: `defineConfig`, `screen` and
      `defineScreen`, `defineComponent`, viewports and color schemes,
      collections and tags, use-case flows, pages, links, fixtures and
      Review-ignore.
- [ ] Write Catalogue: the Browse shell, search, the All and Changes filter,
      the details inspector, `mokly export` and hosting a static catalogue.
- [ ] Write the CLI reference, one page per command, with exit codes and file
      outputs; add a test that every documented command and option exists in
      `src/cli/help.ts` and the argument parser, and that no CLI option in the
      code is undocumented.
- [ ] Write Continuous integration: the publish GitHub Action, the `publish`
      command, project tokens, the upload at the level a user needs, and how
      the check appears on a pull request.
- [ ] Publish the allowlisted `docs/protocol` documents from their Markdown
      source under Reference, rewriting links to excluded documents to their
      GitHub URLs; add a test for the allowlist and the link rewriting.
- [ ] Extend the link check to docs anchors and Pagefind output; extend the
      browser test to open a docs page, use the sidebar, on-this-page and
      previous and next links, copy a code block and run a search.
- [ ] Run `cargo xtask check`, commit and push. Stop for review.

## Milestone 7: Cloud Documentation Ahead Of Release

Tags: ui

Write the cloud sections from the cloud protocol docs, marked `status: ahead`.
Stop for review.

- [ ] Write Mokly Cloud: what the hosted service adds, connecting a GitHub
      repository through the GitHub App, project tokens, how a branch and pull
      request map to publications, the check on the pull request, sharing
      links and private access, organizations, projects and roles, settings.
- [ ] Write Review and edit: comments on screens, approvals and pull request
      sync, the agent session and click-to-reference.
- [ ] Record every page in the go-live alignment checklist in
      `docs/protocol/site.md` and report any disagreement between the cloud
      docs and this repository's CLI to the user.
- [ ] Run `cargo xtask check`, commit and push. Stop for review.

## Milestone 8: Deployment

Deploy the site on every push to `main` with pull request previews, and
document the release process.

- [ ] Add `.github/workflows/site.yml`: build the site on `main` and deploy
      to the chosen host; deploy same-repository pull requests to a preview
      alias with a sticky comment, following the existing preview workflow's
      credential and fork rules; clean up on close.
- [ ] Add a required `site-lighthouse` job to `ci.yml` and include it in the
      `Required CI` aggregator.
- [ ] Document the host project setup, the domain, `SITE_APP_ORIGIN` and the
      release process in the root `README.md`, `site/README.md` and
      `docs/protocol/site-delivery.md`.
- [ ] Run `cargo xtask check`, commit and push. Stop for review.

## Milestone 9: Verification, Commit, Push And Review

Close the plan on the branch; merge is the completion boundary.

- [ ] Inspect the complete diff and the deletion list against `origin/main`;
      confirm nothing already on `main` is removed without approval.
- [ ] Run `cargo xtask check` and resolve any failures.
- [ ] After checks pass, `git add -A`, commit remaining work with
      Conventional Commits and push with every new file tracked.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      against `origin/main` and report numbered findings with severity,
      context, impact, lettered options and a recommendation, without changing
      the implementation.

## Post-merge follow-up (non-blocking)

- [ ] Create the host project, attach the production domain and confirm the
      first `main` deployment serves every route.
- [ ] Run the go-live alignment pass with the cloud repository against every
      `status: ahead` page before the domain goes live.
- [ ] Replace the Terms and Privacy placeholders with approved legal text.
- [ ] In the cloud repository, remove the marketing mockups and routes and
      point its Home, Docs and Changelog links at this site.
