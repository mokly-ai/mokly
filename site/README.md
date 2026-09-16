# Mokly Site

This private npm workspace builds Mokly's public website as static files. Work
here for site configuration, pages and documentation. The published
`@mokly/mokly` CLI stays at the repository root and never depends on this package.

## Responsibilities

- Build static routes with Astro, MDX and React integration for future islands.
- Validate build settings, links, assets and browser behavior.
- Keep site dependencies and generated output outside the published CLI tarball.

## What This Package Does

Milestone 3 supplies an unstyled index at `/`, static output in `site/dist`,
and the repository checks. The approved Folio design and other public routes
belong to later milestones. Pagefind runs after Astro and indexes only
`dist/docs/**/*.html`; with no docs it reports zero pages and emits no bundle.
No site service or API runs in production.

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
| `SITE_APP_ORIGIN` | `https://app.mokly.ai`   | Future Sign in and Get started links |
| `SITE_ORIGIN`     | `http://localhost:4321`  | Canonical site origin                |
| `SITE_STAGE_PR`   | `71` on loopback origins | Future home-stage pull request       |

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

| Root script       | Behavior                                                                    |
| ----------------- | --------------------------------------------------------------------------- |
| `site:build`      | Astro static build, validated settings, Pagefind docs indexing              |
| `site:typecheck`  | `astro check`, then strict `tsc --noEmit`, including scripts                |
| `site:test`       | Settings, build failures, link checker and search-index tests               |
| `site:links`      | Check built HTML/SVG anchors, asset and frame sources, CSS imports and URLs |
| `site:browser`    | Load the built index at 390px and 1440px in light and dark                  |
| `site:lighthouse` | Fails explicitly until Milestone 5 adds Lighthouse budgets                  |

Browser checks use Astro's preview API in a foreground process with
`MOKLY_SITE_PLAYWRIGHT_PORT` (default
`4611`) and the root Playwright installation. They honor `PLAYWRIGHT_CHANNEL`
(default `chrome`; CI uses `chromium`). Screenshots and failure traces go under
`test-results/site`. Build before running links or browser checks individually.

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

`tests/site_package.test.ts` at the root checks the real tarball and compares
root dependencies and the publish allowlist with the committed pre-site fixture
in `tests/fixtures/site-package-boundary.json`. Update that fixture only for
deliberate package dependency maintenance, never to accommodate site tools.

### Key Code

- `astro.config.mjs` — static build, MDX and React integrations.
- `src/settings.ts` — typed, validated settings.
- `src/pages/index.astro` — unstyled index.
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
