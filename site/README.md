# Mokly Site

This private npm workspace builds Mokly's public website as static files. Work
here for site configuration, pages and documentation. The published
`@mokly/mokly` CLI stays at the repository root and never depends on this package.

## Responsibilities

- Build static routes with Astro, MDX and React integration for future islands.
- Validate build settings, links, assets and browser behavior.
- Keep site dependencies and generated output outside the published CLI tarball.

## What This Package Does

It builds the Folio design system, the shared header and footer, and one page
for every public route: `/`, `/docs/…`, `/changelog/`, `/terms/`, `/privacy/`
and the 404 document, plus `sitemap.xml`, `robots.txt`, `changelog.xml`, one
social card per published document and the favicon. The home carries the hero,
the framed catalogue stage, the three feature modules and the open-foundation
closing; the changelog is parsed from the repository's `CHANGELOG.md`; Terms
and Privacy are Markdown content. The documentation is MDX under
`src/content/docs/<section>/` plus the allowlisted protocol documents, read
from `docs/protocol` where they live. Pagefind runs after Astro and indexes
only `dist/docs/**/*.html`. No site service or API runs in production.

Everything the pages show comes from a real source. The stage renders this
repository's own example catalogue, the changelog parses `CHANGELOG.md`, and
the policy documents are checked-in Markdown.

Colors come from `design/folio/tokens.css` at the repository root, the one
file that declares the Folio tokens. `src/styles/tokens.css` imports it and the
build inlines it; the example catalogue's site mockups read a generated copy of
the same file, so both stay in step. Light and dark follow
`prefers-color-scheme`; setting
`data-color-scheme="light"` or `"dark"` on the document element pins a scheme
for deterministic captures. The desktop composition resolves at 768px, the
same switch the mockups select with `data-site-viewport`.

## Quick Start

From the repository root (Node 22.14+, npm 11):

```bash
npm ci
npm run site:check
npm run dev --workspace site
```

Development serves `http://localhost:4321`. To inspect the built files:

```bash
npm run site:build
npm run preview --workspace site -- --host 127.0.0.1 --port 4611
```

Settings come from the process environment, read once by `src/settings.ts`;
`.env` files are not loaded. Both origins accept absolute HTTP(S) origins only,
with no path, query, fragment or credentials. A final slash is removed.

| Setting           | Local default            | Purpose                              |
| ----------------- | ------------------------ | ------------------------------------ |
| `SITE_APP_ORIGIN` | `https://app.mokly.ai`   | Sign in and Get started links        |
| `SITE_ORIGIN`     | `http://localhost:4321`  | Canonical site origin                |
| `SITE_STAGE_PR`   | `71` on loopback origins | Pull request named on the home stage |

`SITE_STAGE_PR` must be a positive safe decimal integer. An absent value is
allowed only for `localhost`, `127.0.0.1` and `[::1]` canonical hosts; production
and preview hosts require it explicitly. Empty or malformed values fail the
build and name the setting. For a non-local build:

```bash
SITE_ORIGIN=https://example.com SITE_STAGE_PR=71 npm run site:build
```

## Development

Root scripts forward to this workspace. `site:check` runs the first five checks
below in order and is included in `cargo xtask check` after `package:smoke`,
before the catalogue's `test:browser`.

| Root script       | Behavior                                                                  |
| ----------------- | ------------------------------------------------------------------------- |
| `site:build`      | Stage, social cards, Astro static build, Pagefind docs indexing           |
| `site:typecheck`  | `astro check`, then strict `tsc --noEmit`, including scripts              |
| `site:test`       | Stage, changelog, legal, cards, settings, styles, routes, metadata, links |
| `site:links`      | Check built anchors, assets, frame sources, CSS URLs and the search index |
| `site:browser`    | Walk the chrome and every page at 390px and 1440px in light and dark      |
| `site:lighthouse` | Audit the budget pages at both viewports against the agreed thresholds    |

Browser checks use Astro's preview API in a foreground process with
`MOKLY_SITE_PLAYWRIGHT_PORT` (default
`4611`) and the root Playwright installation. They honor `PLAYWRIGHT_CHANNEL`
(default `chrome`; CI uses `chromium`). Screenshots and failure traces go under
`test-results/site`. Build before running links or browser checks individually.
Every published route, including docs and the 404 page, is checked for a single
heading and main landmark, language, image alternatives, accessible control
names, outlines on the first five keyboard targets and horizontal overflow.

The link checker resolves directory routes, relative and same-origin absolute
URLs, queries and encoded fragments without fetching external destinations.
It parses HTML and CSS, including `srcset`, inline styles, SVG links, video
posters and object sources. CSS-only fragment references such as `url(#filter)`
depend on the embedding document and are not resolved from standalone CSS.

Root ESLint covers site TypeScript and scripts; `astro check` validates Astro
templates. Root Prettier uses the site's Astro plugin. Generated `dist`, `.astro`
and workspace `node_modules` are ignored. Tooling shared with the CLI (TypeScript,
Playwright, tsx and type definitions) remains in the root development dependencies;
site-specific build dependencies belong here. Install new site dependencies from
this directory with `npm install --save-dev <package>`; commit the root lockfile.
Lighthouse tools instead belong to the independently locked `lighthouse/`
package, outside the root workspaces and site typecheck. Its own build checks
the runner after those optional development tools have been installed.

`tests/site_package.test.ts` at the root checks the real tarball and compares
root dependencies and the publish allowlist with the committed pre-site fixture
in `tests/fixtures/site-package-boundary.json`. Update that fixture only for
deliberate package dependency maintenance, never to accommodate site tools.

### Deployment

The root [Site workflow](../.github/workflows/site.yml) uses Node 24 and npm
11.7.0, installs the root lockfile with `npm ci`, then runs `npm run build &&
npm run example:build && npm run site:build`. It uploads this workspace's
`dist` with lockfile-pinned Wrangler to the direct-upload Pages project
`mokly-site`. Every merge to `main` deploys; there is no separate site version.
The changelog always comes from the checkout's `CHANGELOG.md`.

From the repository root after `npm ci`, an authenticated maintainer runs:

```bash
npx --no-install wrangler pages project create mokly-site --production-branch main
```

Set repository Actions variables `SITE_ORIGIN` (required production origin),
`SITE_APP_ORIGIN` (required application origin) and optionally `SITE_STAGE_PR`.
The workflow explicitly supplies `71` when the stage variable is unset; this
merged PR appears in `CHANGELOG.md`. The settings module's loopback-only
default remains unchanged. Both origins obey the validation rules above.
Reuse variable `CLOUDFLARE_ACCOUNT_ID` and secret `CLOUDFLARE_PAGES_API_TOKEN`
(fallback `CLOUDFLARE_API_TOKEN`) with Pages edit access. Missing configuration
fails deployment with an error annotation; credentials enter only step `env`.

Same-repository PRs build their head commit with `SITE_ORIGIN` set to
`https://pr-<number>.mokly-site.pages.dev`, deploy to `pr-<number>` and update one
`<!-- mokly-site -->` bot comment with status, URL, commit and run. Forks and
Release Please PRs skip deployment and cleanup. Superseded runs are cancelled.
Closing a PR marks its comment inactive and deletes its branch deployments
across all API pages; failures report retained status rather than success.

After the go-live alignment pass, attach the `SITE_ORIGIN` host through the
project's Custom domains page and follow its DNS instructions. Domain setup
and the first production smoke test remain post-merge maintainer work; see
[the delivery contract](../docs/protocol/site-delivery.md#maintainer-setup).

### The documentation

`src/docs/` owns the content model: `sections.ts` fixes the section ids, their
titles and their order; `frontmatter.ts` is the one schema Astro's `docs`
collection and the build scripts validate against; `pages.ts` reads the MDX
files from disk, joins them with the published protocol documents and is the
single list the section tree, previous and next, the sitemap, the social cards
and the verification tests read. The build fails when that list and the content
collection describe different pages, when two pages in a section take the same
order, or when a page repeats a heading.

The Mokly Cloud and Review and edit sections are written from the cloud
repository's protocol documents before that product ships. Their pages carry
`status: ahead`, which readers never see, and open with a
`{/* Source: mokly-cloud <path> */}` comment naming the document they came
from. `tests/docs.test.ts` fixes the list of those pages, checks each citation
and keeps a section wholly ahead or wholly shipped, so the go-live alignment
pass in `docs/protocol/site.md` can find every page it has to reconcile.

`version.ts` reads the workspace `@mokly/mokly` version, which heads the
section tree and writes every install snippet; pages never write an install
command themselves, they render `Install` (with `pinned` for the exact version)
or `Version`, which `src/pages/docs/[...slug].astro` passes to MDX.

`code-panel.ts` and `reference.ts` are Markdown-pipeline plugins: the first
wraps every code block in the Folio code panel so authored pages and published
documents look the same, the second drops a published document's own title
heading and rewrites its links — to another published document's site route,
or to the file on GitHub. `reference-allowlist.ts` is the allowlist; a document
that is not on it is not readable on the site. Syntax highlighting uses the
high-contrast GitHub themes for light and dark, which meet 4.5:1 on the code
panel in both schemes.

Two React islands hydrate on a documentation page: `CodeCopy` places a copy
control in each panel and copies that panel's own text, and `Search` loads the
Pagefind interface on the first search and opens the results in a dialog. The
search control appears in the header on documentation routes and nowhere else.

### The home stage

`scripts/stage.mjs` runs before Astro. It builds the example catalogue when
`examples/basic/generated/screens/welcome.*.html` is missing, copies the four
Welcome documents and every stylesheet they load into `public/stage/`,
rewrites their links to that directory, drops catalogue destinations the site
does not publish, and writes `public/stage/manifest.json` with the screen
title and identifier plus the catalogue trail and navigation rows read from
the example's own build manifest. The page embeds the document matching the
current viewport and scheme in a `sandbox=""` frame; the other three are
hidden by CSS and never fetched. `public/stage/` is generated and ignored.

### Social cards

`scripts/og.mjs` draws one 1200×630 card per route from `src/og.ts` and
rasterizes it with `sharp`, which Astro already depends on, so the site adds
no image toolchain. Cards land in `public/og/`, which is generated and
ignored. `src/metadata.ts` advertises a card only once the build produced it,
so the cards must be drawn before `astro build`.

### Lighthouse

On Node 22.19+ (Node 24 in CI), install the separate tools from the repository root:

```bash
npm ci --prefix site/lighthouse --engine-strict
npm run build --prefix site/lighthouse
npm run site:lighthouse
```

`npm run site:lighthouse` serves `dist` through Astro's preview API and drives
Chrome through `chrome-launcher`. The 390px audit keeps Lighthouse's simulated
slow connection; the 1440px audit declares its desktop profile, so a desktop
page is scored on the desktop curves against a connection it can meet. Set `CHROME_PATH` when Chrome is not at
`/usr/bin/google-chrome` and `MOKLY_SITE_LIGHTHOUSE_PORT` (default `4612`) to
move the preview. The budget lives in `src/lighthouse.ts`; a unit test keeps
it equal to the delivery contract. The run prints one row per page and
viewport and exits non-zero naming each category that missed its threshold.
CI's report-only `site-lighthouse` job selects Playwright's Chromium through
`CHROME_PATH` and saves that text budget report and diagnostics to
`test-results/site-lighthouse/report.txt` at the repository root. Failures
retain the report as an artifact and fail that job, with `continue-on-error:
false`. `Required CI` is independent of Lighthouse; deterministic accessibility
assertions run in its complete gates. The separate tools' lockfile is audited
at all severities in the Lighthouse job. Normal `npm ci` and `site:check` do
not require these tools; a local audit without them prints the install command.

### Capturing the pages

`node --import tsx scripts/capture.mjs <directory> [route ...]` writes a
full-page screenshot of every published route, documentation included, at 390px
and 1440px in both schemes, for comparing the built site with the mockups. Name
routes to capture only those. It is a development aid, not a check.

### Key Code

- `astro.config.mjs` — static build, MDX and React integrations.
- `src/settings.ts` — typed, validated settings.
- `src/stage.ts` and `scripts/stage/` — the home stage manifest, the document
  rewriting rules and the depicted catalogue navigation.
- `src/changelog/` — the `CHANGELOG.md` parser, the typed release notes and
  the Atom feed.
- `src/legal.ts` and `src/content/legal/` — the policy documents.
- `src/og.ts` and `src/lighthouse.ts` — the social card drawing and the
  Lighthouse budget.
- `src/docs/` — the documentation content model, the version, the reference
  allowlist and the Markdown-pipeline plugins.
- `src/layouts/Docs.astro`, `src/components/docs/` and `src/pages/docs/` — the
  section tree, the on-this-page list, previous and next, the code panel's copy
  island and the search island.
- `src/navigation.ts` — the route table, application links and current-route
  marking shared by the header, footer, sitemap and browser walk.
- `src/metadata.ts` and `src/sitemap.ts` — canonical URLs, social card images,
  `sitemap.xml` and `robots.txt`.
- `src/styles/` — `tokens.css` (an import of the shared Folio source),
  `base.css`,
  `controls.css`, `chrome.css`, `layout.css`, `footer.css`, `home.css`,
  `details.css`, `stage.css`, `tree.css`, `changelog.css`, `docs.css` and
  `document.css`.
- `src/components/` and `src/layouts/Site.astro` — brand, skip link, header,
  footer, glyphs, release notes, the policy document and the page shell every
  route renders; `src/components/home/` holds the hero, stage, modules and
  closing.
- `src/pages/` — one page per public route.
- `scripts/check-links.mjs` and `scripts/links/` — static output checks.
- `scripts/index-search.mjs` — Pagefind post-build step.
- `playwright.config.ts` and `tests/` — browser and unit/integration coverage.

### Related Docs

- [Repository setup](../README.md#developer-setup)
- [Site contract](../docs/protocol/site.md)
- [Site design and owning mockups](../docs/protocol/site-design.md)
- [Documentation contract](../docs/protocol/site-docs.md)
- [Delivery contract](../docs/protocol/site-delivery.md)
- [Implementation plans](../plans/README.md)
