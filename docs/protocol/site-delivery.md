# Site Delivery

This contract fixes how the public site is built, tested and deployed. The
site package, its checks and its workflow must satisfy every rule here.
Routes are in [Site](./site.md); the CI gate for the package is in the
[CI and npm release contract](./npm-release.md).

## Package

- `site/` is an npm workspace listed in the root `package.json` `workspaces`
  field. One root lockfile covers it and `npm run dependencies:check` audits
  it.
- Astro with `output: "static"`, the MDX integration, the React integration
  for islands, and Pagefind run as a post-build step. No documentation
  framework or theme.
- The root `package.json` `files` allowlist is unchanged; a test packs the
  package and asserts the tarball contains no `site/` path and that the
  root dependency lists are unchanged by the site.
- Site sources are covered by the root Prettier and ESLint configuration;
  `.astro` files are checked by `astro check`.

## Settings

| Setting           | Default                 | Meaning                                      |
| ----------------- | ----------------------- | -------------------------------------------- |
| `SITE_APP_ORIGIN` | `https://app.mokly.ai`  | Origin for Sign in and Get started links     |
| `SITE_ORIGIN`     | `http://localhost:4321` | Canonical origin for metadata, sitemap, feed |
| `SITE_STAGE_PR`   | required                | Pull request number shown on the home stage  |

Settings are read once in `site/src/settings.ts`, validated, and exposed as a
typed object. Invalid or missing required values fail the build with a message
naming the setting. Both origins must be absolute HTTP(S) origins without a
path, query, fragment or userinfo; an optional final slash is normalized away.
Explicit empty values are invalid. `SITE_STAGE_PR` accepts decimal positive
safe integers only. It defaults to `71` only when `SITE_ORIGIN` names
`localhost`, `127.0.0.1` or `[::1]`; all other origins require it explicitly.
CI verification uses the local defaults. Deployment must supply its canonical
origin and stage pull request. Settings come from the process environment;
the workspace does not load `.env` files.

## Output

- Static HTML per route with trailing-slash directories, `404.html`, hashed
  assets, an SVG favicon drawing the brand mark in the accent for both
  schemes, `sitemap.xml`, `robots.txt` allowing everything and naming the
  sitemap, and `changelog.xml` (Atom). The sitemap and `robots.txt` are
  endpoints rendered from the route table and `SITE_ORIGIN`, so a deployment
  publishes its own absolute URLs; the sitemap omits the 404 document.
- Per-page metadata: `title`, `description`, canonical URL, Open Graph
  (`title`, `description`, `type`, `url`, `image`) and Twitter card
  (`summary_large_image`). The image is generated at build time per page from
  the page title on the Folio canvas at 1200×630 in the light scheme, is named
  `/og/<slug>.png` after the route, and is advertised only once the build has
  produced it. The 404 document carries `noindex` instead of a canonical URL.
- No runtime API calls, no cookies, no third-party scripts. Islands hydrate
  only the docs search and the code-block copy control.
- The home stage embeds documents from this repository's example catalogue
  built during the site build: the Welcome screen's mobile and desktop
  fragments in light and dark with their stylesheets copied into the site
  output, shown in a sandboxed frame with no scripts. The stage label is the
  configured pull request; a test asserts that number appears in
  `CHANGELOG.md`.

## Accessibility

Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, a
skip link as the first focusable element, visible focus on every control,
44px targets, contrast per [Site design](./site-design.md) in both schemes,
usable at 320px and 200% zoom, keyboard-only navigation of every header,
footer, sidebar and on-this-page link, and `aria-current` on the current
route. Frames have titles. Images have alt text or are decorative.

## Tests

| Check      | Script            | What it proves                                                                                                                                  |
| ---------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Build      | `site:build`      | Astro builds, Pagefind indexes, settings validate                                                                                               |
| Typecheck  | `site:typecheck`  | `astro check` and `tsc --noEmit` pass                                                                                                           |
| Unit       | `site:test`       | Changelog parser, settings, sections, reference allowlist, CLI reference coverage                                                               |
| Links      | `site:links`      | Every internal href, anchor, asset and frame source in `site/dist` resolves                                                                     |
| Browser    | `site:browser`    | Playwright on Chromium at 390px and 1440px, light and dark; header and footer walk, both home actions, changelog, legal, docs layout and search |
| Lighthouse | `site:lighthouse` | Category scores at both viewports meet the thresholds below                                                                                     |

`site:check` runs build, typecheck, unit, links and browser in that order and
is the step `cargo xtask check` runs after `package:smoke` and before
`test:browser`. The link checker walks the built HTML and CSS, resolves relative
and same-origin absolute URLs, validates HTML fragments, and checks local
assets (including responsive images and CSS URLs) and frame sources. External
URLs are not fetched. Missing output or an output tree without HTML fails.
Playwright uses Astro's preview API in a foreground process to serve only
`site/dist` on `MOKLY_SITE_PLAYWRIGHT_PORT` (default
`4611`), independently of the catalogue browser suite. Lighthouse runs
in CI as its own required job because it takes minutes; it can be run locally
with the same script.

Milestone 4 provides the Folio tokens, the shared chrome and an empty page
for every route. Pagefind runs after every build over `docs/**/*.html`; until
documentation pages exist it indexes only the documentation landing page.
`site:lighthouse` fails with a clear Milestone 5 setup message until that
milestone installs the budget configuration. The site CI job and
deployment workflow arrive in Milestone 8.

Lighthouse thresholds, per page and viewport: performance ≥ 0.95,
accessibility = 1.0, best practices ≥ 0.95, SEO ≥ 0.95. Pages audited: `/`,
`/docs`, one docs page, `/changelog`, `/terms`.

## Continuous Integration

`ci.yml` gains a `site-lighthouse` job that builds the site and runs the
Lighthouse budget; the `Required CI` aggregator requires it. The complete
gates already run `cargo xtask check`, which includes `site:check`, so a broken
site fails CI on both Node versions.

## Deployment

`.github/workflows/site.yml`:

- On push to `main`: build the site with the production `SITE_ORIGIN` and
  `SITE_APP_ORIGIN` from repository variables and deploy `site/dist` to the
  Cloudflare Pages project `mokly-site` with `wrangler pages deploy`, using
  the same credential variables and secrets as the catalogue preview
  workflow.
- On same-repository, non-release pull requests: deploy to the `pr-<number>`
  branch alias and maintain one sticky comment marked `<!-- mokly-site -->`
  with status, URL, commit and workflow run. Fork pull requests receive no
  credentials. Closing the pull request marks the comment inactive and deletes
  the alias's deployments, reporting cleanup failures rather than hiding them.
- Actions are pinned to immutable commit hashes; Wrangler is lockfile-pinned.

The production domain is attached to the Pages project by a maintainer; DNS
and the first production deployment are post-merge steps. The release process
is: merge to `main`, the workflow deploys, and the deployed site shows the
changelog for the current `CHANGELOG.md`. There is no separate site version.

## Maintainer Setup

```bash
npx --no-install wrangler pages project create mokly-site --production-branch main
```

Then set the repository variables `SITE_ORIGIN` and `SITE_APP_ORIGIN`, reuse
`CLOUDFLARE_ACCOUNT_ID` and the Pages API token secret, and attach the domain
in the Cloudflare dashboard.
