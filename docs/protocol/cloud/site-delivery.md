# Site Delivery

This contract fixes how the public site is built, tested and deployed. The
site package, its checks and its workflow must satisfy every rule here.
Routes are in [Site](./site.md); the repository gate is in
[Repository layout](./repository-layout.md#verification-cargo-xtask-check).

## Package

- The site is one private package in the root npm workspace, covered
  by the one `package-lock.json`; no nested lockfile exists. Its Lighthouse
  tooling is part of the same install and runs on the pinned Node
  toolchain.
- The site is static output built from CommonMark content, with islands only
  for the docs search and the code-block copy control. There is no MDX
  integration, documentation framework or theme.
- The site and the mockups consume the workspace `@mokly/mokly` package,
  linked once for the npm workspace and built by `npm run build`. The package
  supplies the CLI guides, published protocols, changelog and runtime surface
  together.
- Site sources are covered by the root Prettier configuration, their
  TypeScript by the root ESLint configuration, and the Astro components are
  type-checked.

## Settings

| Setting         | Local default           | Meaning                                      |
| --------------- | ----------------------- | -------------------------------------------- |
| `SITE_ORIGIN`   | `http://localhost:4321` | Canonical origin for metadata, sitemap, feed |
| `SITE_STAGE_PR` | `sydney-v1`             | Stage source label suffix                    |

Settings come from the process environment; the site loads no `.env`.
They are read once and validated. An invalid or missing required value fails
the build with a message naming the setting. The origin must be an absolute
HTTP(S) origin without a path, query, fragment or userinfo; an optional final
slash is normalized away. Explicit empty values are invalid. `SITE_STAGE_PR`
accepts one safe branch or publication label: ASCII letters, digits, `.`, `_`,
`/` and `-`, with no leading slash or `..` segment. The site renders
`Mokly Cloud · <value>` as plain text and never constructs a repository or
pull-request URL. CI uses the local defaults. Deployment derives `SITE_ORIGIN`
from `MKC_DOMAIN` for production or the Pages alias for a PR and supplies the
approved stage label. There is no app-origin setting.

## Output

The site declares every owned first segment once, including its top-level
assets, and the origin router's committed site-segment inventory is generated
from that declaration. The build compares the generated inventory with the
declaration and with the actual output names, and fails on drift.
`index.html`, `404.html` and `_headers` are build artifacts rather than
reserved first-segment routes. The production router passes `/` and the
declared site segments to Pages unchanged.

- Static HTML per route with trailing-slash directories, `404.html`, hashed
  assets, an SVG favicon drawing the brand mark in the accent for both schemes,
  the brand assets under `/brand/`, `sitemap.xml`, `robots.txt` allowing
  everything and naming the sitemap, and `changelog.xml` (Atom). Brand assets
  are published byte for byte from their committed sources, giving external
  consumers stable paths beneath `SITE_ORIGIN`. Four explicit SVGs are
  canonical: light- and dark-surface lockups on transparent 192×64 canvases
  and icons on transparent 64×64 canvases. Their 768×256 and 512×512 PNGs and
  the unsuffixed light-variant aliases are derived from them, and a derived
  file that differs from its source fails the checks. The sitemap and
  `robots.txt` are rendered from the route table, the documentation pages and
  `SITE_ORIGIN`, so a deployment publishes its own absolute URLs; the sitemap
  omits the 404 document. Small stylesheets are inlined to avoid a
  render-blocking request.
- Per-page metadata for every published document, including each
  documentation page: `title`, `description`, canonical URL, Open Graph
  (`title`, `description`, `type`, `url`, `image`) and Twitter card
  (`summary_large_image`). The image is generated at build time per page from
  the page title on the Folio canvas at 1200×630 in the light scheme, is named
  `/og/<slug>.png` after the route, and is advertised only once the build has
  produced it. Generated cards and stage files are not committed. The 404
  document carries `noindex` instead of a canonical URL. Every page also links
  the changelog feed with `rel="alternate"`.
- No runtime API calls, no cookies, no third-party scripts. Islands hydrate
  only the docs search and the code-block copy control. Two small scripts run
  without hydration: the mobile menu's dialog control and the docs tree's
  scroll memory. No published page carries an executable inline script: every
  script is a deterministic content-hashed asset on the site origin, and a
  page with an executable inline script or a script source outside the site
  origin fails the build.
- The deployed `_headers` file emits these headers for every static response:

  ```text
  /*
    Access-Control-Allow-Origin: *
    Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'
  ```

  The CSP permits the same-origin islands, the search WebAssembly and the home
  stage, but no third-party script. Local preview serves the same headers as
  the deployment, so the browser checks and the home page and documentation
  search run under the deployed policy without a policy violation.

## Home Stage

The home stage embeds documents from this repository's dogfood catalogue. The
stage build runs after the mockups build and publishes the
`product/account/project-created` screen's mobile and desktop documents in
light and dark into the stage directory of the site output. A published stage
document loads no external stylesheet. Each stylesheet that its source
document links is inline, in the original order, with its URLs rebased to the
stage directory. Every other local resource that the documents load, such as
the self-hosted font, is copied beside them, and every reference to it is
rewritten to that directory. Decision: the stage inlines its stylesheets, not
copied external stylesheets and not one combined external stylesheet, because
Chrome can lay out a stage document before an external stylesheet applies.
Chrome then counts the styled layout as a layout shift, which fails the
[performance budget](#performance-budget) although users never see the shift.
Catalogue destinations the site does not publish lose their `href`; an
unresolvable stylesheet, script or image fails the build.

The stage reads those documents from `static/mokly-generated/` in the
`mokly-static/` build output.
It reads the screen's title, path, catalogue trail and
navigation rows from the build's catalogue index, `mokly-viewer/index.json`.
The site builds the Specs and Components rows itself from the
index's catalogue tree, under the rules of
[Stage tree parity](#stage-tree-parity). Decision: the stage
projects the index's tree itself, not through a viewer helper, because the
`@mokly/viewer` exports no hierarchy function. The parity
check against a real build keeps the rows from drifting. The depicted chrome
uses only those build facts.

The page shows the document matching the current viewport and scheme in a
`sandbox=""` frame with a title and no scripts; the other three stay hidden
and are never fetched. The empty sandbox gives the frame an opaque origin, so
every static response carries `Access-Control-Allow-Origin: *`, from the
deployed `_headers` file and from local preview alike. This lets the frame
load its self-hosted font without granting it scripts, storage or a
same-origin identity. The head renders `Mokly Cloud · <SITE_STAGE_PR>`
without a link.

The stage consumes fresh local output from the preceding mockups build;
generated catalogue files are ignored by Git. When a selected document is
missing, including when the whole output tree is missing, the stage build runs
the mockups build itself before reading the documents; it does not refresh
existing stale documents. An absent, malformed or invalid catalogue index
after that fails with
`The dogfood catalogue needs a version 9 catalogue index. Run npm run mockups:build from the repository root.`
Missing referenced stylesheets, fonts or images fail the build.

### Stage Tree Parity

The depicted rows follow the packaged `mokly-folders.md` title and order rules
and the `mokly-catalogue-tree.md` section projection: index screens and
components use the entry title and row kind, variants keep authored order,
explicit folder order precedes the default English label and UTF-16 path
order, each section filters kinds while keeping shared ancestry and reapplies
that section's row order, and hidden ancestry stays in the model but is
omitted from ordinary stage rows. The stage shows the Specs ancestor chain to
the staged screen and a bounded Components prefix. Every depicted row and its
order matches the same projection of a real build's catalogue index, including
an index owner, folder order and variants.

## Accessibility

Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, a
skip link as the first focusable element, visible focus on every control,
44px targets, contrast per [Site design](./site-design.md) in both schemes,
usable at 320px and 200% zoom, keyboard-only navigation of every header,
menu, footer, sidebar and on-this-page link, and `aria-current` on the current
route. Every published route, including the 404 page, has exactly one `h1`,
one `main` and a nonempty `html[lang]`; every image has an `alt` attribute or
`aria-hidden="true"`; every exposed button and link has a nonempty accessible
name; a focused element keeps a visible, nonzero outline; and no page
overflows horizontally at any inspection width, including 320px. The mobile
menu is a modal dialog: opening it moves focus to its close control, the page
behind it is inert and holds its scroll position, and closing it returns focus
to the menu control. Frames have titles. Images have alt text or are
decorative.

## Performance Budget

Lighthouse thresholds, per page and viewport: performance ≥ 0.95,
accessibility = 1.0, best practices ≥ 0.95, SEO ≥ 0.95. Pages audited: `/`,
`/docs`, `/docs/authoring/config`, `/docs/cli/serve`, `/changelog`, `/terms`,
which covers every composition the site publishes. The 390px audit keeps
Lighthouse's simulated slow-4G connection; the 1440px audit declares
Lighthouse's desktop profile (40ms round trip, 10Mbps). Both viewports use an
explicit `1` CPU slowdown multiplier, so shared-runner calibration cannot
silently change the budget. A route and viewport that miss any threshold run
once more, and the second result must satisfy every threshold. The run prints
one row per page and viewport and exits non-zero naming each category that
missed its threshold.

Lighthouse is report-only: its failure stays visible, with the printed budget
table and failure diagnostics kept as an artifact, but it never blocks the
required aggregate, because measured scores vary between runs on shared
runners. The deterministic accessibility rules above are the required gate.

## Checks

The site gate runs the build, the typecheck, the unit tests, the link check
and the browser check, in that order; the Lighthouse budget runs apart from
it. The `cloud-site` suite builds the mockups before the site gate,
including on the independent site CI runner, because the home stage consumes
generated dogfood output. Missing or stale site output fails rather than
skips.

- The build fails when a setting is invalid, when a package document is
  missing or malformed, when the stage cannot be published, or when the
  generated site-segment inventory or a derived brand asset drifts.
- The link check walks the built HTML and CSS: every internal href, anchor,
  asset (including responsive images and CSS URLs) and frame source resolves
  in the output. The relative `/sign-in` and `/sign-up` entry links are the
  only internal paths accepted without a site file, because the app router
  owns them. External URLs are not fetched. Missing output, an output tree
  without HTML, and a search index that is missing or one build behind the
  pages all fail.
- The browser check serves the built output through a local preview and opens
  every route at 390px and 1440px in light and dark, and once at 320px in the
  light scheme, the narrowest width the design contract keeps usable. It holds
  every page to the accessibility rules above and to the header, menu, footer,
  home, changelog, legal, docs and search behavior this contract,
  [Site](./site.md) and [Site docs](./site-docs.md) require.
- The unit tests hold the rules a browser cannot prove cheaply: the stylesheet
  rules of [Site design](./site-design.md), its contrast pairs measured from
  the token values in both schemes, and the banned-words rule of
  [Site](./site.md#copy-rules) read back from the built pages.

## Continuous Integration

The site gate runs in the required aggregate through its own parallel CI
job. A separate Lighthouse job uses the same pinned Node, npm, lockfile
and Chromium installation, builds the mockups before the site, and runs the
report-only budget, keeping its results on failure. The required aggregate
does not depend on that job.

## Deployment

The site deploys as the direct-upload Cloudflare Pages project `mokly-site`
rather than as a Git-connected Pages build, because the build needs the
dogfood catalogue and the pinned repository toolchain, which the repository's
own workflow supplies; deployment builds the dogfood catalogue before the
site. [Site deployment](./site-deployment.md) defines the Pages workflows,
sticky PR comments, cleanup and domain redirects.
