# Mokly Site

`@mokly-cloud/site` builds Mokly's public marketing, documentation, changelog
and legal website as static Astro output. Work here for public-site pages,
chrome and delivery. Product and account routes remain in `packages/app`.

## Responsibilities

- Build `/`, `/docs/…`, `/changelog/`, `/pricing/`, `/terms/`, `/privacy/`,
  `/complaints/`, `/security/`, the 404 page, feeds, sitemap, robots file,
  favicon, public logo assets and per-page social cards.
- Draw every page in the Canvas look that
  [Site design](../../docs/protocol/cloud/site-design.md) defines, from the
  `@mokly-cloud/tokens` roles and self-hosted faces.
- Render CLI guides, reference documents, version and changelog from the exact
  installed `@mokly/mokly` package. Render each HTML sample fence of a guide
  at build time, as its code beside its sample.
- Render Mokly Cloud and Review documentation from this repository's Markdown.
- Draw the home page's spread and demos of a fictional demo app as static
  components at build time.
- Link every page's shared header to the public Mokly GitHub repository, and
  the Pricing page's plan actions to the app's `/sign-up`.
- Produce a static site with no runtime API calls, cookies or third-party
  scripts. The footer's scheme control keeps the reader's choice in
  `localStorage`, and each page applies a kept choice before it first
  paints.

## What This Package Does

Astro renders every public route from one route model. Package-owned and
repository-owned documentation pass through the same CommonMark pipeline,
frontmatter schema, navigation tree, sitemap, social-card generator and
search index. The package-root resolver verifies that the content source is
really `@mokly/mokly` before reading its `CHANGELOG.md`, `docs/guides/` and
allowlisted `docs/protocol/cloud/` files. Package guides keep their authored
Reference destinations; only published Reference documents have their links
rewritten.

Every page draws on the dot-grid canvas under one sticky tool bar: the brand,
the depicted file title and people, the navigation and Get started. Below
768px the bar holds the brand, Get started and a Menu control, which opens the
site's destinations in a modal sheet that drops in below the bar. Where that
one row cannot hold the wordmark at the reader's text size, the brand keeps
the mark alone and its name "Mokly home". A container query in `chrome.css`,
which the mockups' `chrome.css` repeats, decides it. At 200% text in a 320px
window no page scrolls sideways: labels, buttons and footer links wrap or
break a long word, and parts that sit side by side stack.

Each documentation page is a page of the design file. The Layers panel holds
the docs search and the section tree, the page is a frame on the canvas
labelled with its tracked source, and the Inspect panel holds the page's facts,
Edit on GitHub and On this page with the reading progress. Below 1280px On
this page, the facts and Edit on GitHub sit in a disclosure under the lead.
Below 1024px a sub-bar under the tool bar opens the tree as a modal sheet and
opens search. ⌘K, Ctrl K and `/` open search on every docs page. The Layers
tree keeps its scroll position across pages within a tab and reveals the
current page when a direct link, search result or pager opens a page outside
the visible tree, and a scroll spy marks the section in view.

Every page ends with the footer, the last frame on the canvas: the brand, the
open-source line and the Light and Dark scheme control beside the Product and
Legal links, with the design file's status bar under the frame. The scheme
island leads every page head as a classic, blocking script. Before the first
paint it sets the root's `data-color-scheme` from this view's `?scheme=`, else
from the choice kept in `localStorage`, and with neither the page follows the
system scheme. It then runs the control: a choice applies at once and is
kept, and the parameter is never kept or added to a link. Without script the
control does not show.

The site consumes the private `@mokly-cloud/tokens` package from the npm workspace
directly and emits its responsive CSS scoped per color scheme; site styles use
only semantic `--mk-*` properties. There is no second published token
dependency or copied palette.

Every page reads fully without script. Each script, such as the scheme
control, the changelog filter, a scroll spy, a home demo or the controls of an
HTML sample fence, is a small same-origin island. The measurements island
writes the rendered size, font size or gap into each measured size tag, type
badge and redline value and follows resizing; without script those values do
not show. Every animation honours reduced motion and shows its finished state.
[Site delivery](../../docs/protocol/cloud/site-delivery.md) owns these rules.

The home draws a fictional demo app, the coffee shop `acme/storefront`, as
static components at build time: the hero's heading as a selected text
layer, the spread of the app's screens and component sets, and the depicted
product in the Browse, Review and Edit frames and the open foundation. The
home demos island plays each frame's demo once when it comes into view, and
marks the section in view in the Specs panel. The built page draws each demo
in its finished state, so a reader without script or with reduced motion
sees that state.

Generated social cards, Astro output and search output are not committed.
`public/_headers` and the Astro preview configuration both add
`Access-Control-Allow-Origin: *`, so any origin, a sandboxed frame with an
opaque origin included, can read the public static files. The same file emits
the site CSP. The build moves every inline script, Astro's island
bootstraps and the scheme island included, into content-hashed, same-origin
assets and rejects inline executable scripts or scripts loaded from outside
the page's own origin. Astro preview serves the production CSP so the browser
suite exercises that boundary. The development server sends the same CSP but
keeps those scripts inline, so the browser blocks them there: under
`npm run dev` the scheme control and the hydrated islands do not run. Preview
a build to see them.

Every deployment publishes transparent brand assets for external consumers:

| Artwork     | Light surface                           | Dark surface                           | PNG size |
| ----------- | --------------------------------------- | -------------------------------------- | -------- |
| Full lockup | `/brand/mokly-logo-light.svg` or `.png` | `/brand/mokly-logo-dark.svg` or `.png` | 768×256  |
| Icon        | `/brand/mokly-icon-light.svg` or `.png` | `/brand/mokly-icon-dark.svg` or `.png` | 512×512  |

Prefix these paths with `https://mokly.ai` for the production URLs. Prefer SVG
when the consumer accepts it. `/brand/mokly-logo.svg`,
`/brand/mokly-logo.png`, `/brand/mokly-icon.svg` and
`/brand/mokly-icon.png` are stable aliases of the light-surface variants. The
lockup SVGs contain outlined lettering and have no external font dependency.
After changing a canonical variant SVG, regenerate the derived PNGs and
aliases:

```sh
npm run brand:build --workspace @mokly-cloud/site
```

## Quick Start

From the repository root with the pinned Node and npm versions:

```sh
npm ci
npm run build
npm run site:build
npm run site:check
```

Run the development server with:

```sh
npm run dev --workspace @mokly-cloud/site
```

It serves `http://localhost:4321`. Settings come only from the process
environment and are read once:

| Setting       | Local default           | Purpose                                     |
| ------------- | ----------------------- | ------------------------------------------- |
| `SITE_ORIGIN` | `http://localhost:4321` | Canonical metadata, sitemap and feed origin |

The origin must be an absolute HTTP(S) origin without credentials, path, query or
fragment. Explicit empty values fail the build. Get started uses the relative
path `/docs/start/install/`. The Pricing page's Create an account and Start a
7-day trial use the app's relative path `/sign-up`, and the link check accepts
that app path.
[Marketing site](../../docs/protocol/cloud/marketing-site.md) names every link
from the site to the app.

## Development

The focused checks are:

| Command                                             | Coverage                                                        |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `npm run brand:check --workspace @mokly-cloud/site` | Committed PNG matches the public SVG                            |
| `npm run site:build`                                | Cards, CSP-safe Astro output and the search index               |
| `npm run site:typecheck`                            | `astro check` and strict TypeScript                             |
| `npm run site:test`                                 | Content, settings, workflow, style and output contracts         |
| `npm run site:links`                                | Built links, anchors, assets, CSS URLs, frames and search index |
| `npm run site:routes`                               | Regenerate the Worker's committed site-segment module           |
| `npm run site:browser`                              | Every route at 390px/1440px in both schemes and 320px           |
| `npm run site:lighthouse`                           | Report-only performance, accessibility, practices and SEO       |
| `npm run site:check`                                | Required checks above except Lighthouse                         |

Build before running links, browser or Lighthouse independently. Browser
checks serve `dist` on `MOKLY_SITE_PLAYWRIGHT_PORT` (default `4611`).
Lighthouse uses `MOKLY_SITE_LIGHTHOUSE_PORT` (default `4612`) and honors
`CHROME_PATH`; CI obtains the path from `scripts/chromium-path.mjs`. Install
Chromium once with:

```sh
npm exec --workspace @mokly-cloud/site -- playwright install chromium
```

The site reads the built workspace `@mokly/mokly` and `@mokly/viewer`
packages. Run `npm run build` from the repository root before direct site
build, check or development commands, and again after changing either package.

To add a public first segment or a root asset output, declare it in
`src/navigation.ts`, run `npm run site:routes` to regenerate the
Worker's committed site-segment module, and add the segment to the reserved
workspace names in `crates/mkc-domain`. The site build rejects undeclared
outputs and a stale generated module.

Root Prettier includes this package, and its Astro plugin formats `.astro`
files. Root ESLint lints the TypeScript but does not parse `.astro` files;
`npm run site:typecheck` checks them with `astro check`.
`cargo xtask check` installs the single `package-lock.json`,
builds and verifies mockups, then runs the complete site gate. Lighthouse is a
separate visible CI job and does not block the required aggregate. Workflow
tests record reviewed immutable action pins, including the Electron download
cache used by the desktop job.
They also check the desktop release workflow's action pins and require its
secret references to stay in step environments.

### Content Boundaries

`src/docs/sections.ts` fixes section ownership and order. Getting started,
Authoring, Catalogue, Continuous integration, CLI reference and Reference are
package-owned. Mokly Cloud and Review and edit are repository-owned Markdown
under `src/content/docs/`. A section cannot mix owners. Prefer one page per
concept, and keep each authored page under about 200 lines of Markdown.

The package guides must satisfy their own guide contract. The site expects
the 34 guides of the workspace `@mokly/mokly` package, validates strict
frontmatter and CommonMark, rejects MDX/JSX and broken destinations, and
requires install-version literals to equal the workspace package version.
Reference links to package source use the `v<version>` tag of that version.
A Mokly change that makes a statement of the repository-owned docs pages, the
docs landing, the home copy or the Terms stale fixes that statement in the
same change.
Reference publishes seven documents, including Catalogue upload exchange
between Catalogue upload and Catalogue navigation. Site and mockup membership
tests read the package's Published Protocol Documents table through one shared
parser. The mockup membership test lives in the site suite; the mockup suite
also checks the complete depicted sidebar against the site.
Cloud-owned pages cite existing local protocol documents with HTML comments.
Package guides keep their authored links; `src/docs/guides.ts` validates
Reference destinations against the allowlist without rewriting them.
A root-relative link in a page under `src/content/` names a site route, such
as `/privacy/` or `/docs/ci/github-action/`, not a repository path. The
repository Markdown link test, `tests/markdown_links.test.ts`, fails the link
when the site has no route there. It checks the fragment against the
headings of the Markdown that the route renders.

The home page's demo app, `acme/storefront`, and the people of the design
file, Maya and Sam, are fiction, and they stay after go-live. Every claim
about Mokly stays real. The source rule of
[Public site](../../docs/protocol/cloud/site.md#boundary) lets the site depict
comments, approvals, agent sessions and presence until go-live. Presence
inside a depicted Mokly screen, such as the Browse viewer, the comment thread
or the Edit window, counts as such a feature, and so does each named agent,
Claude and Codex.

Each drawing of such a feature carries a source comment that holds
`status: "ahead"` and the names of its features, so the search for the ahead
pages finds it too. A template block takes
`{/* status: "ahead" (presence) */}` on the line above it. A component that
only draws the features, such as `AgentChat.astro`, takes
`// status: "ahead" (agent sessions, Claude)` in its frontmatter, and a data
entry takes that line above it. The names are `comments`, `approvals`,
`agent sessions`, `presence`, `Claude` and `Codex`. A person's cursor outside
a depicted Mokly screen, such as Maya's on the hero heading, and the pricing
questions are fiction of the design file, so they carry no mark.

Before go-live, run the alignment pass of the ahead pages and the marks:

1. From the repository root, run `grep -rn 'status: "ahead"' apps/site/src`.
2. Check each named feature against the deployed product. A named agent
   stays only when agent sessions support it.
3. Remove each drawing of a feature that did not ship, and the copy that
   names the feature, in the page and in
   [Site home copy](../../docs/protocol/cloud/site-copy.md). Removing an agent
   from `src/components/people.ts` makes the type check fail at each `person`
   that still names it.
4. Remove the mark of each drawing whose features all shipped.

The Pricing page states only the plan facts of
[Billing](../../docs/protocol/cloud/billing.md) and
[Billing plan gates](../../docs/protocol/cloud/billing-plan-gates.md).

Terms, Privacy, Complaints and Security are Markdown documents under
`src/content/legal/`. Their effective dates, provider details, retention
statements and security claims stay aligned with the cloud protocols and
production runbooks. A change to what the site or the app keeps in the
browser also changes section 9 of `privacy.md`, and all four effective dates
move together. `src/legal.ts` owns their shared route and navigation
model; every policy route renders the same document layout: a page frame on
the canvas, labelled with its Markdown source such as `legal/terms.md`,
whose sheet holds the Legal kicker, the title, the effective date, the
Markdown body ruled into its sections and the links to the other three. The
404 page shares the layout in a frame labelled `404.html` and holds only its
heading.

### Deployment

`.github/workflows/site.yml` deploys `dist` to the direct-upload Cloudflare
Pages project `mokly-site`. Main derives `SITE_ORIGIN` as
`https://<MKC_DOMAIN>`. Same-repository PRs deploy branch `pr-<number>` at
`https://pr-<number>.mokly-site.pages.dev`. App links are inert on that alias;
the sticky comment names `https://pr-<number>.preview.<MKC_DOMAIN>/sign-in` for
review. Fork and Release Please PRs skip deployment and cleanup.

The workflow requires repository variables `MKC_DOMAIN` and
`CLOUDFLARE_ACCOUNT_ID`, plus secret `CLOUDFLARE_PAGES_API_TOKEN` or its
`CLOUDFLARE_API_TOKEN` fallback. Closing a
PR runs `scripts/cloud/site/cleanup.sh` at the repository root, which removes every
matching Pages deployment, and marks the sticky site comment inactive.
Provider failures retain the preview and report the reason. Pages applies the
checked-in `_headers` file to the static responses, matching local preview
behavior. The maintainer steps that create the
Pages project and attach the domain are in the
[deployment runbook](../../docs/ops/deploy.md#public-site).

### Key Code

- `src/navigation.ts` — `SITE_PATHS`, the root asset segments, `GET_STARTED_PATH` (the Install guide that Get started opens), `APP_PATHS` (the app's `/sign-up`, the one application route that the site links) and `currentPage`; the header, menu, footer, sitemap, route generator, link check and browser walk all read this one table.
- `scripts/generate-site-segments.ts` — derives the site's first segments from `src/navigation.ts` and writes or checks the Worker's committed `site-segments.ts` module (`site:routes` and `routes:check`).
- `src/settings.ts` — reads `SITE_ORIGIN` once from the process environment and validates it.
- `src/mokly-package.ts` — locates the installed `@mokly/mokly`, verifies its name and version, and keeps every package file read inside that root.
- `src/docs/pages.ts` — merges the package guides, the cloud Markdown under `src/content/docs/` and the published references into the one ordered page list that the tree, pager, sitemap, cards, search and tests read; `assertCollection` keeps Astro's collection equal to it.
- `src/docs/sections.ts` — `SECTION_IDS`, `SECTION_TITLES`, `SECTION_SUMMARIES` and `sectionOrder`, the fixed section order and titles.
- `src/docs/frontmatter.ts` — the frontmatter schema and `readFrontmatter`.
- `src/docs/reference-allowlist.ts` and `src/docs/reference.ts` — the published protocol documents and `rewriteHref`, which rewrites a published document's relative links to site routes or to GitHub at the installed tag.
- `src/docs/guides.ts` — validates a guide's `/docs/reference/<slug>/` links against the allowlist without rewriting them.
- `src/docs/sample-fence.ts`, `sample-render.ts`, `sample-lines.ts`, `sample-band.ts`, `sample-stage.ts` and `sample-path.ts` — the HTML sample fence: the Shiki transformer and the Markdown plugin, the isolated build of each guide sample, the line map, the band markup and the `sample=` path rules. `sample-band.ts` draws the head, the numbered code panel, whose lines hold their newlines through the line helper of `code-panel.ts` and whose open tab holds the file's name in a part of its own that ends in an ellipsis where the bar cannot hold it, and the Viewport and Saved state controls in the band's own form; `sample-stage.ts` draws one frame for each view, labelled with its viewport, whose screen holds the status band or the browser bar over the view's `srcdoc` frame, with the lit element's mark and a selection with the view's full size, and the wire. Only the first view shows without script.
- `src/components/docs/sample-island.ts`, `sample-views.ts` and `sample-marks.ts` — the sample island, which `Docs.astro` loads with a `<script src>`, without hydration: it marks each band ready, which shows the controls, switches the frame and the dimmed lines to the chosen view, and lights a line and its element on pointing or tapping, with the element's mark and, while the band sets the frame beside the code, the wire. It reads a view's document once that frame has loaded; the view takes no pointer, so the island finds the element under the pointer with `elementFromPoint`. `sample-views.ts` reads the frames and the radios, and `sample-marks.ts` places the mark and the wire.
- `src/styles/docs-sample.css` and `docs-sample-frames.css` — the band, its head, code, controls, stage and wire, and the frames. Each view's document keeps its viewport width, 390px under the 44px status band or 1280px under the 40px bar, and a transform scales it to the frame: 60% for Mobile, and the frame's width over 1280px for Desktop, which `tan(atan2())` divides. The band stacks while the page frame is narrower than 846px. The view's frame stays a Tab stop; a focused frame matches neither `:focus` nor `:focus-visible`, so its screen draws the focus glow on `:focus-within`.
- `src/docs/code-panel.ts`, `src/components/docs/Install.astro`, `src/components/docs/CodeCopy.tsx` and `src/styles/docs-code.css` — the docs code panels, in the markup of the shared code panel: the Markdown plugin, and the Shiki transformer that `Install.astro` passes to Astro's `Code` for the install snippet. The open tab shows the `terminal` icon for a `bash`, `console`, `sh` or `shell` block and the `file` icon otherwise, and names the language. A `bash`, `sh` or `shell` block takes `site-code--prompt`, and each `site-code-line` holds its own newline, so the `pre`'s text is the block's source. The island mounts Copy, with the `copy` icon, into each panel head after its copy slot, and copies that text. The module exports its hast helpers, the line helper and the tab icon, which the sample band shares. `docs-code.css` holds only what a Shiki block adds to `code.css` and `code-tokens.css`: the dark theme's token colours in both schemes, no scroll box, the inset focus glow and the hidden slot.
- `src/docs/headings.ts` — stable heading ids, the duplicate-heading check and the on-this-page list.
- `src/layouts/Docs.astro` — every documentation page: the workspace with the Layers panel, the page frame and the Inspect panel, the sub-bar and the tree sheet below 1024px, the one search island, the docs scroll spy and the sample island.
- `src/components/docs/Layers.astro`, `TreeSections.astro`, `TreeFoot.astro`, `VersionRow.astro` and `SearchControl.astro` — the Layers panel, a `Panel` whose tree rows are `PanelRow` parts, and the version row, sections and Changelog row that the tree sheet shares.
- `src/components/docs/Subbar.astro`, `TreeSheet.astro` and `tree-sheet.ts` — the sub-bar below 1024px and the modal tree sheet that its Layers control opens.
- `src/components/docs/Inspect.astro`, `Facts.astro`, `OnThisPage.astro`, `Outline.astro` and `scroll-spy.ts` — the Inspect panel, a `Panel` named by the page's file, the On this page disclosure below 1280px, and the scroll spy that marks the heading in view and moves the reading progress.
- `src/components/docs/page-source.ts` — each page's tracked source, which the frame label names and Edit on GitHub opens, and the page facts.
- `src/components/docs/Pager.astro`, `pager-entries.ts` and `Trail.astro` — previous and next with each neighbour's section and description, and the location trail.
- `src/components/docs/Search.tsx`, `search-keys.ts`, `CanvasIcon.tsx` and `scripts/index-search.mjs` — the search dialog island, which binds the page's search controls, owns ⌘K, Ctrl K and `/`, names the key hint and closes on a press on the dimmed page, with a fallback where the browser lacks `closedby`, the island's drawing of an `icons.ts` icon, and the post-build indexing of `docs/**/*.html` that waits until the written index is readable.
- `src/components/docs/tree-scroll.ts` and `tree-reveal.ts` — the Layers panel's tab-scoped tree scroll memory from 1024px, and the current-page reveal that the tree sheet shares.
- `src/components/Header.astro` and `src/components/page-name.ts` — the tool bar of every page, and the page name of each route, which its file title shows after `mokly.ai —`.
- `src/components/Menu.astro` and `src/components/menu-dialog.ts` — the mobile header's menu control and the modal sheet it opens.
- `src/components/Footer.astro`, `SchemeControl.astro` and `StatusBar.astro` — the footer frame of every page, the Light and Dark control in its brand column, and the depicted status bar under the frame.
- `src/components/scheme-island.js` — the scheme island, a checked classic script that `src/layouts/Site.astro` emits first in every page head: it applies `?scheme=` or the choice kept under `mokly.site.scheme` in `localStorage` before the first paint, and it runs the scheme control. `tests/scheme_island.test.ts` runs this file in `node:vm` against the stub page of `tests/helpers/scheme-island.ts`.
- The shared Canvas parts, each documented in its own comment: `Icon.astro` with the `icons.ts` drawings, `Mark.astro`, `Brand.astro`, `Button.astro`, `Chip.astro`, `Kicker.astro`, `SectionBox.astro`, `FrameLabel.astro`, `Selection.astro`, `SizeTag.astro`, `Redline.astro`, `PageFrame.astro`, which frames a document with a `FrameLabel` and a `Selection` and, given `measure`, a size tag of the sheet, and `Avatar.astro`, `Presence.astro` and `Cursor.astro` with the people of `people.ts`, all under `src/components/`. A `Selection`, `SizeTag` or `Redline` that measures a part renders `Measurements.astro`, which loads the measurements island: `measurements-island.ts` calls `startMeasurements` of `measurements.ts`, and `tests/measurements.test.ts` runs it against a stub page.
- `src/components/Panel.astro`, `PanelRow.astro` and `src/styles/panels.css` — the floating panel with its head, body and optional foot, and its 44px rows, which link with `href` and mark the current row with `aria-current`.
- `src/components/CodePanel.astro`, `code-lines.ts`, `src/styles/code.css` and `code-tokens.css` — the dark code panel, drawn at build time from typed lines of syntax tokens, with tabs, line numbers, a prompt, lit and dimmed lines and a foot, without a Copy control or a script.
- `src/home.ts` — the home hero copy from `docs/protocol/cloud/site-copy.md`, shared by the hero, the home page description and every social card.
- `src/pages/index.astro` and `src/components/home/` — the home: `Hero.astro` with `Spread.astro`, `SpreadSets.astro` and `StorybookMark.astro`; `Workspace.astro` with `SpecsPanel.astro`; the modules `BrowseModule.astro` (with `CheckCard.astro`, `Viewer.astro`, `ViewerTree.astro`, `ViewerCompare.astro` and `FitConnector.astro`), `ReviewModule.astro` (with `Thread.astro`), `EditModule.astro` (with `AgentChat.astro`) and `Foundation.astro` (with `Steps.astro`, `Terminal.astro` and `FitWire.astro`), built on `ModuleText.astro`, `ModuleFrame.astro` and `ViewerBarParts.astro`; and the demo app under `home/acme/`, which `Artboard.astro` frames and `CardSelection.astro` selects. Their sheets are `src/styles/home*.css`.
- `src/components/home/home-island.ts`, `specs-spy.ts` and `demos.ts` — the home demos island: the Specs scroll spy, and the demo states that each frame's sheet animates. `tests/home_island.test.ts` drives it against a stub page, and `tests/browser/home*.spec.ts` check the home in a browser.
- `src/pages/pricing.astro` and `src/components/pricing/` — the pricing page: `Hero.astro` with the two measured redlines under the heading, `Plans.astro` with the two section boxes and the three `PlanFrame.astro` frames (Team selected, with its measured size tag and Maya's cursor), `Compare.astro` with the props table, and `Questions.astro` with the resolved threads of `Thread.astro`. `hero-copy.ts` holds the approved hero copy, which the page description repeats. `plan-facts.ts` keeps Team's seat prices in USD cents, the trial length and the currency, and derives the shown amounts; `compare-rows.ts` and `questions.ts` hold the compare rows and the threads. The page and its parts load `src/styles/pricing*.css`.
- `src/legal.ts` and `src/content/legal/` — the legal documents' schema, labels and routes, and their four Markdown sources.
- `src/components/Policy.astro` and `src/styles/document.css` — one legal document in its page frame, and the sheet of the legal pages, which `src/pages/404.astro` shares.
- `src/changelog/` — the changelog model and the Atom feed. `parse.ts` reads each release of the installed package's `CHANGELOG.md` with its note groups, whose kind `groups.ts` names from the heading (a heading that names no kind keeps its notes under its own words), and its upgrade notes, which `upgrade.ts` reads in full as topics with their subtopics, paragraphs and lists. `items.ts` splits each note into its scope, its text, its issue and commit links and its nested items, and `notes.ts` splits text into typed segments and keeps only the link destinations that the site publishes. `anchors.ts` gives each release, group, upgrade topic and subtopic an id unique on the page and points a note's fragment for an upgrade heading of the same release at that id. `releases.ts` reads the file, points a relative link to a published guide's Markdown at the guide's page, and adds the readable date. `feed.ts` writes one entry per release, with a line for each note group and one that names the upgrade topics.
- `src/pages/changelog.astro` and `src/components/changelog/` — the changelog page: `History.astro` (Version history), `Intro.astro` (the title as a measured selected text layer), `Timeline.astro` with the lanes of `timeline.ts`, `Filter.astro` with the status line of `status.ts`, the full `Release.astro` frames and the `CompactRelease.astro` frames of `Earlier.astro`, which share `ReleaseHead.astro`, `ReleaseCounts.astro` and `ReleaseNotes.astro` with its groups, notes and `Upgrade.astro`. `facts.ts` holds the group names and icons, the page's dates and every count. `changelog-island.ts`, which the page loads as one script without hydration, runs the filter and opens the closed disclosure around a link's target, and `release-view.ts` marks the release in view. The page and its parts load `src/styles/changelog*.css`.
- `src/metadata.ts`, `src/og.ts` and `scripts/og.mjs` — per-page metadata, the social card drawn as SVG in the Canvas light look around the light lockup's outlined drawing, and the pre-build step that rasterizes one PNG per route. The rasterizer loads no web font, so the card's text takes system stacks.
- `scripts/brand-assets.mjs` and `public/brand/` — the canonical brand SVGs and the script that derives their PNGs and light-variant aliases (`brand:build` and `brand:check`).
- `src/fonts/` — the self-hosted Geist, Geist Mono and Instrument Serif 400 faces, each beside its SIL Open Font License, and `fonts.css`, the `@font-face` rules that the site layout imports, so the build emits each face as a content-hashed file under `/_astro/`.
- `scripts/externalize-inline-scripts.ts` and `scripts/script-elements.ts` — move every executable inline script into a content-hashed asset under `/_astro/` after the Astro build.
- `scripts/check-links.mjs` and `scripts/links/` — the built-output link, anchor, asset, frame and search-index check. It accepts the paths of `APP_PATHS` without a site file, and no other path.
- `scripts/preview.mjs`, `scripts/chromium-path.mjs`, `scripts/lighthouse.mjs` and `src/lighthouse.ts` — the foreground preview server for Playwright, the Chromium path CI reads, and the report-only Lighthouse runner with its audited pages, viewports, thresholds and one retry.
- `src/styles/token-styles.ts` and `src/styles/` — `SITE_TOKEN_CSS`, the `responsiveTokenCss` output scoped per color scheme, and the stylesheets. `src/layouts/Site.astro` loads the shared sheets on every page: `base.css` with the dot-grid canvas and the focus glow of every control, the shared parts (`controls.css`, `buttons.css`, `canvas.css`, `canvas-tags.css`, `labels.css` and `people.css`), the chrome (`chrome.css`, `menu.css`, `footer.css` and `scheme.css`) and `layout.css`, which holds the document type that the legal pages, the docs and the changelog share and the location trail above a page title. A page, a layout or a part loads its own sheet, such as `page-frame.css` for `PageFrame.astro`. The built page puts such a sheet before the shared sheets, so a rule in it that overrides a shared rule needs a more specific selector. Their class names and rules match the site mockups' sheets under `docs/mockups/styles/site/`, which `docs/mockups/src/_tests_/design-site-parity.test.ts` compares, and `design-site-containers.test.ts` compares their container queries.
- `tests/docs_samples.test.ts` — the HTML sample fence: the rendered views, the line map, the built band with lines that hold their newlines, the frame labels, the size tags and the controls, and the build errors.
- `tests/browser/docs-sample.spec.ts` and `tests/browser/sample.ts` — the sample band in a browser: one row for each line, the controls that switch the view and the dimmed lines, the wire beside the code and none stacked, pointing and tapping that light a line and its element, each view inside the band and the sheet at 320px, 390px and 1440px, and the band without script.
- `tests/docs_code_panel.test.ts` and `tests/browser/docs-code.spec.ts` — the built code panel markup of a guide and of the docs landing, with the icon of each tab kind; the copy of a multi-line block; the dark fill in both schemes; Copy beside the sample's language at the end of its bar; the sample tab's file name, which ends in an ellipsis at 320px; and the line numbers at 200% text.
- `tests/docs_page_source.test.ts`, `tests/docs_pager_entries.test.ts` and `tests/docs_search_body.test.ts`, with `tests/browser/docs-layout.spec.ts`, `docs-search.spec.ts` and `docs-sheet.spec.ts` — each page kind's tracked source, Edit on GitHub target and facts, the pager's neighbours, the indexed body, and in a browser the layout steps, the scroll spy, the search controls, keys and dimmed page, and the tree sheet.
- `tests/docs_package.test.ts`, `tests/docs_guides.test.ts` and `tests/docs.test.ts` — the expected guide inventory of the workspace package, the fence languages and guide labels that must render, and the `status: ahead` pages with their source citations.
- `tests/helpers/published-protocols.ts`, `tests/docs_reference.test.ts`, `tests/docs_mockup_reference.test.ts` and `tests/published_protocols.test.ts` — the shared package-table parser, Reference membership and order in the site and mockup, and malformed-row coverage.
- `tests/legal.test.ts` and `tests/copy.test.ts` — the legal documents' section inventory and the banned-words rule read from the built pages.
- `tests/changelog.test.ts`, `tests/changelog_notes.test.ts`, `tests/browser/changelog.spec.ts` and `changelog-layout.spec.ts` — the releases, notes, upgrade notes, anchors, links and feed that the changelog model reads, and in a browser the frames, the filter, the release in view, a link into a closed disclosure, Version history under the tool bar, the widths without sideways scroll, 200% text in a 320px window, the words of each filter option inside the option and the bar at 320px with 100% and 200% text, the checked filter option in forced colours and the page without script.
- `tests/pricing.test.ts` and `tests/browser/pricing.spec.ts` — the pricing page's seat prices, trial length and currency against the verified plan catalogue in `crates/mkc-domain/src/billing.rs`, and the page's targets, table roles, hidden depictions, target sizes, sticky plan heads and 200% text in a 320px window.
- `tests/lighthouse.test.ts`, `tests/site_workflows.test.ts` and `tests/site_cleanup.test.ts` — the budget against the delivery contract, the site workflow policy, and the Pages cleanup script.
- `tests/browser/` — the Playwright suite over every built route. `large-text.ts` opens a route in a 320px window at 200% text, where the chrome, footer, home, changelog, pricing, tree sheet and sample specs check their parts.

### Related Docs

- [Architecture](../../docs/architecture/cloud.md)
- [Repository setup](../../docs/development/cloud.md#developer-get-started) and the
  [TypeScript npm workspace](../README.md)
- [Public site](../../docs/protocol/cloud/site.md),
  [Site chrome](../../docs/protocol/cloud/site-chrome.md),
  [Site home copy](../../docs/protocol/cloud/site-copy.md),
  [Site pricing](../../docs/protocol/cloud/site-pricing.md),
  [Site changelog](../../docs/protocol/cloud/site-changelog.md),
  [Site docs](../../docs/protocol/cloud/site-docs.md),
  [Site docs layout](../../docs/protocol/cloud/site-docs-layout.md),
  [Site design](../../docs/protocol/cloud/site-design.md),
  [Site design components](../../docs/protocol/cloud/site-design-components.md),
  [Site design pages](../../docs/protocol/cloud/site-design-pages.md),
  [Site mockups](../../docs/protocol/cloud/site-mockups.md),
  [Site legal](../../docs/protocol/cloud/site-legal.md),
  [Site delivery](../../docs/protocol/cloud/site-delivery.md),
  [Site delivery islands](../../docs/protocol/cloud/site-delivery-islands.md),
  [Site deployment](../../docs/protocol/cloud/site-deployment.md) and
  [Marketing site](../../docs/protocol/cloud/marketing-site.md)
- [Design tokens](../../docs/protocol/cloud/design-tokens.md) and the
  [viewer palette](../../docs/protocol/mokly-viewer-palette.md), which hold
  the Canvas values
- [Guides](../../docs/protocol/mokly-guides.md), which define the HTML sample
  fence
- [Billing](../../docs/protocol/cloud/billing.md)
- [Deployment runbook](../../docs/ops/deploy.md#public-site)
