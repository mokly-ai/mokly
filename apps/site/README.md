# Mokly Site

Status: The site does not draw Canvas yet. The [palette source, fonts and brand milestone](../../plans/canvas-redesign.md#milestone-3-palette-source-fonts-and-brand) makes the `@mokly/ui` palette the source of the tokens, self-hosts Geist and draws the new brand. The [site chrome and legal pages milestone](../../plans/canvas-redesign.md#milestone-4-site-chrome-and-legal-pages) builds the Canvas chrome and the footer scheme control, and restyles the legal pages. The [site home milestone](../../plans/canvas-redesign.md#milestone-5-site-home) builds the drawn home spread and deletes the real dogfood stage. The [site docs milestone](../../plans/canvas-redesign.md#milestone-6-site-docs) builds the Canvas docs. The [site docs sample and changelog milestone](../../plans/canvas-redesign.md#milestone-8-site-docs-sample-and-changelog) draws the fence and builds the Canvas changelog. The [site pricing milestone](../../plans/canvas-redesign.md#milestone-9-site-pricing) builds `/pricing/` and its links to the app.

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
  `localStorage`.

## What This Package Does

Astro renders every public route from one route model. Package-owned and
repository-owned documentation pass through the same CommonMark pipeline,
frontmatter schema, navigation tree, sitemap, social-card generator and
search index. The package-root resolver verifies that the content source is
really `@mokly/mokly` before reading its `CHANGELOG.md`, `docs/guides/` and
allowlisted `docs/protocol/cloud/` files. Package guides keep their authored
Reference destinations; only published Reference documents have their links
rewritten.

Below 768px the shared header holds the brand and a Menu control that opens
the site's destinations in a modal dialog sliding in from the right edge. The
desktop docs tree keeps its scroll position across pages within a tab and
reveals the current page when a direct link, search result or pager opens a
page outside the visible tree.

The site consumes the private `@mokly-cloud/tokens` package from the npm workspace
directly and emits its responsive CSS scoped per color scheme; site styles use
only semantic `--mk-*` properties. There is no second published token
dependency or copied palette.

Every page reads fully without script. Each script, such as the scheme
control, the changelog filter, a scroll spy, a home demo or the controls of an
HTML sample fence, is a small same-origin island. Every animation honours
reduced motion and shows its finished state.
[Site delivery](../../docs/protocol/cloud/site-delivery.md) owns these rules.

The home stage is generated after the dogfood catalogue. It publishes the
four mobile/desktop and light/dark documents of
`product/account/project-created`, read from
`mokly-static/static/mokly-generated/`, plus their local resources into
`public/stage/`. The workspace `@mokly/viewer` public `readCatalogueIndex`
reader checks the version of `mokly-static/mokly-viewer/index.json` and copies
its content under the
[reader contract](../../docs/protocol/cloud/mokly-artifact-compatibility.md#frame-boundary).
The stage projects
Specs and Components from that tree, with section-specific row ordering,
authored variants and hidden-folder pruning. Breadcrumbs use the index's
resolved titles. The frame label is `Mokly Cloud · <SITE_STAGE_PR>` and
carries no private repository link. Generated stage files, social cards,
Astro output and search output are not committed. The stage keeps
`sandbox=""`; `public/_headers` and the Astro preview configuration both add
`Access-Control-Allow-Origin: *` so its opaque origin can load the
self-hosted font without receiving script or storage permissions. The same
file emits the site CSP. The build moves Astro's inline island bootstraps
into content-hashed, same-origin assets and rejects inline executable scripts
or scripts loaded from outside the page's own origin. Astro preview serves
the production CSP so the browser suite exercises that boundary.

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
npm run mockups:build
npm run site:build
npm run site:check
```

Run the development server with:

```sh
npm run dev --workspace @mokly-cloud/site
```

It serves `http://localhost:4321`. Settings come only from the process
environment and are read once:

| Setting         | Local default           | Purpose                                     |
| --------------- | ----------------------- | ------------------------------------------- |
| `SITE_ORIGIN`   | `http://localhost:4321` | Canonical metadata, sitemap and feed origin |
| `SITE_STAGE_PR` | `sydney-v1`             | Home-stage branch or publication label      |

The origin must be an absolute HTTP(S) origin without credentials, path, query or
fragment. The stage label accepts safe letters, digits, `.`, `_`, `/` and `-`,
with no leading slash or `..` path segment. Explicit empty values fail the
build. Get started uses the relative path `/docs/start/install/`. The Pricing
page's Create an account and Start a 7-day trial use the app's relative path
`/sign-up`, and the link check accepts that app path.
[Marketing site](../../docs/protocol/cloud/marketing-site.md) names every link
from the site to the app.

## Development

The focused checks are:

| Command                                             | Coverage                                                        |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `npm run brand:check --workspace @mokly-cloud/site` | Committed PNG matches the public SVG                            |
| `npm run site:build`                                | Stage, cards, CSP-safe Astro output and the search index        |
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

Git ignores the dogfood catalogue's generated output. Run
`npm run mockups:build` from the repository root before direct site build,
check or development commands, and again after changing mockup source. The
stage build runs the mockups build itself only when a selected document is
absent, including on a fresh clone; existing stale documents need an explicit
build. An unreadable or invalid catalogue index fails with
`The dogfood catalogue needs a version 9 catalogue index. Run npm run mockups:build from the repository root.`
The `cloud-site` suite always builds the mockups first.

To add a public first segment or a root asset output, declare it in
`src/navigation.ts`, run `npm run site:routes` to regenerate the
Worker's committed site-segment module, and add the segment to the reserved
workspace names in `crates/mkc-domain`. The site build rejects undeclared
outputs and a stale generated module.

Generated `public/stage/` files are static assets, excluded from the site's
source typecheck. The stage copies the published frame probe script unchanged;
the frame's empty sandbox prevents it from executing.

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

The home page's demo app, `acme/storefront`, is fictional. Every claim about
Mokly stays real, and the source rule of
[Public site](../../docs/protocol/cloud/site.md) lets the site depict a
feature that ships before go-live. Before go-live, check each depicted
feature against the product, and remove each one that did not ship. The
Pricing page states only the plan facts of
[Billing](../../docs/protocol/cloud/billing.md) and
[Billing plan gates](../../docs/protocol/cloud/billing-plan-gates.md).

Terms, Privacy, Complaints and Security are Markdown documents under
`src/content/legal/`. Their effective dates, provider details, retention
statements and security claims stay aligned with the cloud protocols and
production runbooks. `src/legal.ts` owns their shared route and navigation
model; every policy route renders the same Markdown document layout.

### Deployment

`.github/workflows/site.yml` deploys `dist` to the direct-upload Cloudflare
Pages project `mokly-site`. Main derives `SITE_ORIGIN` as
`https://<MKC_DOMAIN>`. Same-repository PRs deploy branch `pr-<number>` at
`https://pr-<number>.mokly-site.pages.dev`. App links are inert on that alias;
the sticky comment names `https://pr-<number>.preview.<MKC_DOMAIN>/sign-in` for
review. Fork and Release Please PRs skip deployment and cleanup.

The workflow requires repository variables `MKC_DOMAIN`,
`CLOUDFLARE_ACCOUNT_ID` and optional `SITE_STAGE_PR`, plus secret
`CLOUDFLARE_PAGES_API_TOKEN` or its `CLOUDFLARE_API_TOKEN` fallback. Closing a
PR runs `scripts/cloud/site/cleanup.sh` at the repository root, which removes every
matching Pages deployment, and marks the sticky site comment inactive.
Provider failures retain the preview and report the reason. Pages applies the
checked-in `_headers` file to the static responses, matching local preview
behavior for the sandboxed home stage. The maintainer steps that create the
Pages project and attach the domain are in the
[deployment runbook](../../docs/ops/deploy.md#public-site).

### Key Code

- `src/navigation.ts` — `SITE_PATHS`, the root asset segments, `GET_STARTED_PATH` (the Install guide that Get started opens) and `currentPage`; the header, footer, sitemap, link check and browser walk all read this one table.
- `scripts/generate-site-segments.ts` — derives the site's first segments from `src/navigation.ts` and writes or checks the Worker's committed `site-segments.ts` module (`site:routes` and `routes:check`).
- `src/settings.ts` — reads `SITE_ORIGIN` and `SITE_STAGE_PR` once from the process environment and validates them.
- `src/mokly-package.ts` — locates the installed `@mokly/mokly`, verifies its name and version, and keeps every package file read inside that root.
- `src/docs/pages.ts` — merges the package guides, the cloud Markdown under `src/content/docs/` and the published references into the one ordered page list that the tree, pager, sitemap, cards, search and tests read; `assertCollection` keeps Astro's collection equal to it.
- `src/docs/sections.ts` — `SECTION_IDS`, `SECTION_TITLES`, `SECTION_SUMMARIES` and `sectionOrder`, the fixed section order and titles.
- `src/docs/frontmatter.ts` — the frontmatter schema and `readFrontmatter`.
- `src/docs/reference-allowlist.ts` and `src/docs/reference.ts` — the published protocol documents and `rewriteHref`, which rewrites a published document's relative links to site routes or to GitHub at the installed tag.
- `src/docs/guides.ts` — validates a guide's `/docs/reference/<slug>/` links against the allowlist without rewriting them.
- `src/docs/sample-fence.ts`, `sample-render.ts`, `sample-lines.ts`, `sample-band.ts` and `sample-path.ts` — the HTML sample fence: the Shiki transformer and the Markdown plugin, the isolated build of each guide sample, the line map, the band markup with one `srcdoc` frame for each view, and the `sample=` path rules.
- `src/docs/code-panel.ts` and `src/components/docs/CodeCopy.tsx` — the Markdown plugin that wraps every code block in the Folio panel, and the island that places a copy control in each panel and copies that panel's own text.
- `src/docs/headings.ts` — stable heading ids, the duplicate-heading check and the on-this-page list.
- `src/components/docs/Search.tsx` and `scripts/index-search.mjs` — the search dialog island, and the post-build indexing of `docs/**/*.html` that waits until the written index is readable.
- `src/components/docs/tree-scroll.ts` — tab-scoped desktop tree scroll restoration and current-page reveal.
- `src/components/Menu.astro` and `src/components/menu-dialog.ts` — the mobile header's menu control and the modal dialog it opens.
- `src/home.ts` — the home hero copy from `docs/protocol/cloud/site-copy.md`, shared by the hero, the home page description and every social card.
- `src/legal.ts` and `src/content/legal/` — the legal documents' schema, labels and routes, and their four Markdown sources.
- `src/changelog/` — the typed changelog parser, the release model, note rendering and the Atom feed.
- `src/metadata.ts`, `src/og.ts` and `scripts/og.mjs` — per-page metadata, the social card drawn as SVG, and the pre-build step that rasterizes one PNG per route.
- `scripts/brand-assets.mjs` and `public/brand/` — the canonical brand SVGs and the script that derives their PNGs and light-variant aliases (`brand:build` and `brand:check`).
- `scripts/stage.mjs`, `scripts/stage/catalogue.ts`, `scripts/stage/tree.ts`, `scripts/stage/fragments.ts` and `src/stage.ts` — the home-stage publication: the fallback mockups build, the public index reader, section projection, document and resource rewriting, and stage manifest schema.
- `scripts/externalize-inline-scripts.ts` and `scripts/script-elements.ts` — move every executable inline script into a content-hashed asset under `/_astro/` after the Astro build.
- `scripts/check-links.mjs` and `scripts/links/` — the built-output link, anchor, asset, frame and search-index check.
- `scripts/preview.mjs`, `scripts/chromium-path.mjs`, `scripts/lighthouse.mjs` and `src/lighthouse.ts` — the foreground preview server for Playwright, the Chromium path CI reads, and the report-only Lighthouse runner with its audited pages, viewports, thresholds and one retry.
- `src/styles/token-styles.ts` and `src/styles/` — `SITE_TOKEN_CSS`, the `responsiveTokenCss` output scoped per color scheme, and the Folio stylesheets (`base.css`, `chrome.css`, `menu.css`, `layout.css`, `footer.css` and the page sheets), each loaded once by a layout.
- `tests/docs_samples.test.ts` — the HTML sample fence: the rendered views, the line map and the build errors.
- `tests/docs_package.test.ts`, `tests/docs_guides.test.ts` and `tests/docs.test.ts` — the expected guide inventory of the workspace package, the fence languages and guide labels that must render, and the `status: ahead` pages with their source citations.
- `tests/stage_tree.test.ts` — builds a temporary Git catalogue and checks the depicted rows against the index's titles, section order, hidden folders and variants.
- `tests/stage_source.test.ts` — the stage's fallback mockups build and its catalogue-index error message.
- `tests/helpers/published-protocols.ts`, `tests/docs_reference.test.ts`, `tests/docs_mockup_reference.test.ts` and `tests/published_protocols.test.ts` — the shared package-table parser, Reference membership and order in the site and mockup, and malformed-row coverage.
- `tests/legal.test.ts` and `tests/copy.test.ts` — the legal documents' section inventory and the banned-words rule read from the built pages.
- `tests/lighthouse.test.ts`, `tests/site_workflows.test.ts` and `tests/site_cleanup.test.ts` — the budget against the delivery contract, the site workflow policy, and the Pages cleanup script.
- `tests/browser/` — the Playwright suite over every built route.

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
