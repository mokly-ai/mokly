# Site Delivery

This contract fixes how the public site is built, tested and deployed. The
site package, its checks and its workflow must satisfy every rule here.
Routes are in [Site](./site.md); the CI gate for the package is in the
[CI and npm release contract](./npm-release.md).

## Package

- `site/` is an npm workspace listed in the root `package.json` `workspaces`
  field. One root lockfile covers it and `npm run dependencies:check` audits
  it. The report-only audit tools live separately in `site/lighthouse/`, with
  their own lockfile outside the root workspaces and Node 22.19+ requirement.
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
  endpoints rendered from the route table, the documentation pages and
  `SITE_ORIGIN`, so a deployment publishes its own absolute URLs; the sitemap
  omits the 404 document. Stylesheets small enough to inline are inlined, so no
  page waits on a render-blocking sheet.
- Per-page metadata for every published document, including each
  documentation page: `title`, `description`, canonical URL, Open Graph
  (`title`, `description`, `type`, `url`, `image`) and Twitter card
  (`summary_large_image`). The image is generated at build time per page from
  the page title on the Folio canvas at 1200×630 in the light scheme, is named
  `/og/<slug>.png` after the route, and is advertised only once the build has
  produced it. `site/scripts/og.mjs` runs before Astro, draws each card as an
  SVG document and rasterizes it with `sharp`, which Astro already depends on,
  so the site adds no image toolchain of its own. `site/public/og/` and
  `site/public/stage/` are generated and are not committed. The 404 document
  carries `noindex` instead of a canonical URL. Every page also links the
  changelog feed with `rel="alternate"`.
- No runtime API calls, no cookies, no third-party scripts. Islands hydrate
  only the docs search and the code-block copy control.
- The home stage embeds documents from this repository's example catalogue.
  `site/scripts/stage.mjs` runs before Astro, builds the example catalogue
  when its output is missing, and publishes the Welcome screen's mobile and
  desktop documents in light and dark into `site/public/stage/` with every
  stylesheet they load copied beside them and their links rewritten to that
  directory. Catalogue destinations the site does not publish lose their
  `href`; an unresolvable stylesheet, script or image fails the build. The
  same script writes `stage/manifest.json` with the screen's title and
  identifier and the catalogue trail and navigation rows, all read from the
  example's own build manifest, so the depicted chrome states no fact of its
  own. The page shows the document matching the current viewport and scheme
  in a `sandbox=""` frame with a title and no scripts; the other three stay
  hidden and are never fetched. The stage label is the configured pull
  request; a test asserts that number appears in `CHANGELOG.md`.

## Accessibility

Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, a
skip link as the first focusable element, visible focus on every control,
44px targets, contrast per [Site design](./site-design.md) in both schemes,
usable at 320px and 200% zoom, keyboard-only navigation of every header,
footer, sidebar and on-this-page link, and `aria-current` on the current
route. Frames have titles. Images have alt text or are decorative.

## Tests

| Check      | Script            | What it proves                                                                                                                                                             |
| ---------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build      | `site:build`      | Astro builds, Pagefind indexes, settings validate                                                                                                                          |
| Typecheck  | `site:typecheck`  | `astro check` and `tsc --noEmit` pass                                                                                                                                      |
| Unit       | `site:test`       | Changelog parser, settings, sections, reference allowlist, CLI reference coverage, stylesheet, contrast and copy rules                                                     |
| Links      | `site:links`      | Every internal href, anchor, asset and frame source in `site/dist` resolves                                                                                                |
| Browser    | `site:browser`    | Every route at 390px and 1440px, light and dark, and once at 320px: deterministic accessibility, header/footer navigation, home actions, changelog, legal, docs and search |
| Lighthouse | `site:lighthouse` | Report-only category scores at both viewports against the thresholds below                                                                                                 |

`site:check` runs build, typecheck, unit, links and browser in that order and
is the step `cargo xtask check` runs after `package:smoke` and before
`test:browser`. The link checker walks the built HTML and CSS, resolves relative
and same-origin absolute URLs, validates HTML fragments, and checks local
assets (including responsive images and CSS URLs) and frame sources. External
URLs are not fetched. Missing output or an output tree without HTML fails.
Playwright uses Astro's preview API in a foreground process to serve only
`site/dist` on `MOKLY_SITE_PLAYWRIGHT_PORT` (default
`4611`), independently of the catalogue browser suite. Every published route,
including authored docs, reference docs and the 404 page, must have exactly one
`h1`, one `main`, a nonempty `html[lang]`, and an `alt` attribute or
`aria-hidden="true"` on every image. Every exposed button and link must have a
nonempty accessible name. The first five keyboard-focusable elements must
retain a visible, nonzero computed outline; pages must not overflow horizontally.
The route walk and those assertions also run once at 320px in the light scheme,
the narrowest width the design contract keeps usable. These assertions are part
of the required complete gates.

The unit suite carries the rules a browser cannot prove cheaply. No stylesheet
may remove a focus outline. Every control rule — one naming a documented
control, or any rule reserving the minimum target size — must draw its whole
boundary with `--site-folio-line-strong` rather than the decorative hairline.
Each contrast pair documented in [Site design](./site-design.md) is measured
from the token file in both schemes, at 4.5:1 for text and 3:1 for boundaries
and the focus ring. The built pages are read back for the copy rules: no route
outside the Reference section, which republishes protocol documents verbatim,
may say "not supported", "coming soon" or "roadmap" outside a code sample, and
marketing routes may not use the internal nouns the copy rules list. The built
stylesheet must carry every Folio token, proving the shared token file was
inlined rather than left as an unresolved import. Lighthouse runs as
its own report-only CI job; its failure remains visible without blocking
`Required CI`. For local audits on Node 22.19+ (Node 24 in CI), first run
`npm ci --prefix site/lighthouse --engine-strict`, then `npm run site:lighthouse`.

Pagefind runs after every build over `docs/**/*.html` and must cover every
published documentation page; `site:links` fails when the index is missing or
one build behind the pages. `site:lighthouse`
serves `site/dist` through Astro's preview API and drives Chrome through
`chrome-launcher`, honouring `CHROME_PATH` and
`MOKLY_SITE_LIGHTHOUSE_PORT` (default `4612`). It prints one row per page and
viewport and exits non-zero naming each category that missed its threshold.
CI retains the printed budget table and failure diagnostics as an artifact
when the Lighthouse job fails.

Lighthouse thresholds, per page and viewport: performance ≥ 0.95,
accessibility = 1.0, best practices ≥ 0.95, SEO ≥ 0.95. Pages audited: `/`,
`/docs`, `/docs/authoring/config`, `/docs/cli/serve`, `/changelog`, `/terms`,
which covers every composition the site publishes. The 390px audit keeps
Lighthouse's simulated slow connection; the 1440px audit declares Lighthouse's
desktop profile (40ms round trip, 10Mbps, no processor slowdown) so a desktop
page is scored on the desktop curves against a connection it can meet.

## Continuous Integration

`ci.yml` runs `site-lighthouse` on Ubuntu with Node 24, npm 11.7.0 and `npm ci`.
Only this job installs the separate tools with
`npm ci --prefix site/lighthouse --engine-strict`, audits their lockfile with
`npm audit --prefix site/lighthouse --audit-level=low --include=prod --include=dev --include=optional --include=peer`,
and typechecks the runner with `npm run build --prefix site/lighthouse`.
It installs Chromium with Playwright and sets `CHROME_PATH` to that executable.
It runs `npm run build && npm run example:build && npm run site:build` before
`npm run site:lighthouse`, using the local settings defaults. The budget table
and diagnostics go to `test-results/site-lighthouse/report.txt`; Bash pipefail
preserves the audit exit status, and `actions/upload-artifact` retains that
directory on failure. This is a text budget report, not Lighthouse's full JSON.

`Required CI` requires `minimum-runtime`, `release-runtime` and
`export-platforms` to succeed, including every platform matrix entry.
`site-lighthouse` has `continue-on-error: false` and keeps its own failing
status and artifact when an audit fails; the aggregator never waits for it.
Both complete gates run `cargo xtask check`, which includes `site:check`.
Workflow tests parse both YAML files and exercise guards, configuration errors,
sticky comments, cleanup failures and the aggregator's failure handling.

## Deployment

`.github/workflows/site.yml`:

- Pushes to `main` deploy `site/dist` to the production branch `main` of the
  direct-upload Cloudflare Pages project `mokly-site`. Builds require repository
  variables `SITE_ORIGIN` and `SITE_APP_ORIGIN`; missing values produce a clear
  `::error` before building. Invalid values fail settings validation.
- Opened, synchronized and reopened same-repository pull requests build the
  PR head commit and deploy to `pr-<number>`. `SITE_ORIGIN` becomes
  `https://pr-<number>.mokly-site.pages.dev`; `SITE_APP_ORIGIN` still comes from
  the repository variable. Forks and Release Please PRs (head branches starting
  `release-please--` or labels containing `autorelease:`) skip deploy and close.
- Both deploy jobs use repository variable `SITE_STAGE_PR`, falling back to
  `71`, the merged PR named in `CHANGELOG.md`. This is an explicit workflow
  fallback; the settings module still requires it for non-loopback origins.
- Both install Node 24, npm 11.7.0 and the lockfile with `npm ci`, then run
  `npm run build && npm run example:build && npm run site:build`. Deployment
  uses `npx --no-install wrangler pages deploy`, with the root lockfile's
  Wrangler and no registry fallback. Actions reuse the immutable pins in CI
  and the catalogue preview workflow.
- Credentials mirror `preview.yml`: repository variable `CLOUDFLARE_ACCOUNT_ID`
  and secret `CLOUDFLARE_PAGES_API_TOKEN`, falling back to `CLOUDFLARE_API_TOKEN`,
  enter only the validation, deploy and cleanup steps through `env`. Missing
  credentials fail deployment with an error annotation. Forks receive none.
- One bot-authored sticky comment marked `<!-- mokly-site -->` reports the
  latest run status, target alias URL, PR head commit and workflow run, including
  failures. The catalogue comment remains separate. Closing an eligible PR
  marks this comment inactive even if cleanup fails; no comment is created
  by the close job when none exists.
- `scripts/site/cleanup.sh` ports the catalogue's curl cleanup and retained/
  deleted status reporting. It gathers every page of deployments before
  deleting only those whose branch matches `pr-<number>`, with `force=true`.
  Missing credentials, transport, HTTP, API and parse failures report retained
  status; delete failures also emit warnings and do not prevent other attempts.
  Close checks out the event's default ref, without pinning a potentially
  deleted PR head. Missing/null page counts default to zero and use page length
  to determine completion; malformed page counts retain all deployments. A
  page's matching ids are appended only after its entire listing parses.
- Concurrency group `site-<PR number or ref>` cancels superseded runs, including
  an open-PR deploy when the close event arrives, independently of the catalogue.

The production domain is attached to the Pages project by a maintainer; DNS
and the first production deployment are post-merge steps. The release process
is: merge to `main`, the workflow deploys, and the deployed site shows the
changelog for the current `CHANGELOG.md`. There is no separate site version.

## Maintainer Setup

```bash
npx --no-install wrangler pages project create mokly-site --production-branch main
```

Run the command from a checkout after `npm ci`, authenticated with the
Cloudflare account and a token with Pages edit access. Configure repository
Actions variables `SITE_ORIGIN` (the intended production HTTPS origin),
`SITE_APP_ORIGIN` (the app origin, normally `https://app.mokly.ai`) and optionally
`SITE_STAGE_PR` (defaults to `71`). Origins must have no path, query, fragment
or credentials; a trailing slash is allowed. Reuse `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_PAGES_API_TOKEN` or `CLOUDFLARE_API_TOKEN` from the catalogue workflow.

In the Cloudflare dashboard, open `mokly-site` → Custom domains, attach the
host in `SITE_ORIGIN`, and complete the prompted DNS setup after the go-live
alignment pass. Domain attachment and the first production smoke test remain
post-merge maintainer work. Keep `Required CI` as the required branch status.
See Cloudflare's [direct-upload CI guide](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
and [custom domain guide](https://developers.cloudflare.com/pages/configuration/custom-domains/).
