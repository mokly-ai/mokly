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
- The site is static output built from CommonMark content, with the small
  [script islands](./site-delivery-islands.md#script-islands). There is no
  MDX integration, documentation framework or theme.
- The site and the mockups consume the workspace `@mokly/mokly` package,
  linked once for the npm workspace and built by `npm run build`. The package
  supplies the CLI guides, published protocols, changelog and runtime surface
  together.
- Site sources are covered by the root Prettier configuration, their
  TypeScript by the root ESLint configuration, and the Astro components are
  type-checked.

## Settings

| Setting       | Local default           | Meaning                                      |
| ------------- | ----------------------- | -------------------------------------------- |
| `SITE_ORIGIN` | `http://localhost:4321` | Canonical origin for metadata, sitemap, feed |

Settings come from the process environment; the site loads no `.env`.
They are read once and validated. An invalid or missing required value fails
the build with a message naming the setting. The origin must be an absolute
HTTP(S) origin without a path, query, fragment or userinfo; an optional final
slash is normalized away. Explicit empty values are invalid. CI uses the
local defaults. Deployment derives `SITE_ORIGIN` from `MKC_DOMAIN` for
production or the Pages alias for a PR. There is no app-origin setting.

## Output

The site declares every owned first segment once, including its top-level
assets, and the origin router's committed site-segment inventory is generated
from that declaration. The build compares the generated inventory with the
declaration and with the actual output names, and fails on drift.
`index.html`, `404.html` and `_headers` are build artifacts rather than
reserved first-segment routes. The production router passes `/` and the
declared site segments to Pages unchanged.

- Static HTML per route with trailing-slash directories, `404.html`, hashed
  assets, an SVG favicon drawing the brand mark in each scheme's colours, the
  brand assets under `/brand/`, `sitemap.xml`, `robots.txt` allowing
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
  the page title in the Canvas look at 1200×630 in the light scheme, is named
  `/og/<slug>.png` after the route, and is advertised only once the build has
  produced it. Generated cards and sample views are not committed. The 404
  document carries `noindex` instead of a canonical URL. Every page also links
  the changelog feed with `rel="alternate"`.
- No runtime API calls, no cookies, no third-party scripts. Every script is
  one of the [script islands](./site-delivery-islands.md#script-islands). No
  published page carries an executable inline script: every script is a
  deterministic content-hashed asset on the site origin, and a page with an
  executable inline script or a script source outside the site origin fails
  the build.
- The deployed `_headers` file emits these headers for every static response:

  ```text
  /*
    Access-Control-Allow-Origin: *
    Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'
  ```

  The CSP permits the same-origin islands, the search WebAssembly and the
  sandboxed sample frames, but no third-party script.
  `Access-Control-Allow-Origin: *` lets any origin, a sandboxed frame with an
  opaque origin included, read the public static files. Local preview serves
  the same headers as the deployment, so the browser checks run every island
  and the documentation search under the deployed policy without a policy
  violation.

## Home Demos

The home draws its demo app and its product demos as static components at
build time: the spread, the Browse, Review and Edit demos and the open
foundation of [Site design pages](./site-design-pages.md#home). They read no
catalogue output and embed no frame. This is decision 2, option A: a clearly
fictional demo app drawn at build time, rather than the repository's own
dogfood screens in a sandboxed frame, so that the home can show the design's
spread and demos. [Site](./site.md) fixes what the demo app may depict.

## Accessibility

Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, a
skip link as the first focusable element, visible focus on every control,
44px targets, contrast per [Site design](./site-design.md) in both schemes,
usable at 320px and 200% zoom, keyboard-only navigation of every header,
menu, footer, Layers and On this page link, and `aria-current` on the current
route. Every published route, including the 404 page, has exactly one `h1`,
one `main` and a nonempty `html[lang]`; every image has an `alt` attribute or
`aria-hidden="true"`; every exposed button and link has a nonempty accessible
name; a focused element keeps a visible, nonzero outline; and no page
overflows horizontally at any inspection width, including 320px. The mobile
menu is a modal dialog: opening it moves focus to its close control, the page
behind it is inert and holds its scroll position, and closing it returns focus
to the menu control. The tree sheet is a modal dialog in the same way, and
closing it returns focus to the Layers control. Each segmented control is a
native radio group with an accessible name. Depictions are hidden from
assistive technology and take no focus. Frames have titles. Images have alt
text or are decorative.

## Performance Budget

Lighthouse thresholds, per page and viewport: performance ≥ 0.95,
accessibility = 1.0, best practices ≥ 0.95, SEO ≥ 0.95. Pages audited: `/`,
`/docs`, `/docs/authoring/config`, `/docs/cli/serve`, `/changelog`,
`/pricing`, `/terms`, which covers every composition the site publishes. The
390px audit keeps Lighthouse's simulated slow-4G connection; the 1440px audit
declares Lighthouse's desktop profile (40ms round trip, 10Mbps). Both
viewports use an explicit `1` CPU slowdown multiplier, so shared-runner
calibration cannot silently change the budget. A route and viewport that miss
any threshold run once more, and the second result must satisfy every
threshold. The run prints one row per page and viewport and exits non-zero
naming each category that missed its threshold.

Lighthouse is report-only: its failure stays visible, with the printed budget
table and failure diagnostics kept as an artifact, but it never blocks the
required aggregate, because measured scores vary between runs on shared
runners. The deterministic accessibility rules above are the required gate.

## Checks

The site gate runs the build, the typecheck, the unit tests, the link check
and the browser check, in that order; the Lighthouse budget runs apart from
it. Missing or stale site output fails rather than skips.

- The build fails when a setting is invalid, when a package document is
  missing or malformed, or when the generated site-segment inventory or a
  derived brand asset drifts.
- The link check walks the built HTML and CSS: every internal href, anchor,
  asset (including responsive images and CSS URLs) and frame source resolves
  in the output. The relative `/sign-up` link of the pricing page is the only
  internal path accepted without a site file, because the app router owns
  it. External URLs are not fetched. Missing output, an output tree
  without HTML, and a search index that is missing or one build behind the
  pages all fail.
- The browser check serves the built output through a local preview and opens
  every route at 390px and 1440px in light and dark, and once at 320px in the
  light scheme, the narrowest width the design contract keeps usable. It holds
  every page to the accessibility rules above and to the header, menu, footer,
  home, changelog, pricing, legal, docs and search behavior this contract,
  [Site](./site.md) and [Site docs](./site-docs.md) require.
- The unit tests hold the rules a browser cannot prove cheaply: the stylesheet
  rules of [Site design](./site-design.md), its contrast pairs measured from
  the token values in both schemes, and the banned-words rule of
  [Site](./site.md#copy-rules) read back from the built pages.

## Continuous Integration

The site gate runs in the required aggregate through its own parallel CI
job. A separate Lighthouse job uses the same pinned Node, npm, lockfile
and Chromium installation, builds the site, and runs the report-only budget,
keeping its results on failure. The required aggregate does not depend on
that job.

## Deployment

The site deploys as the direct-upload Cloudflare Pages project `mokly-site`
rather than as a Git-connected Pages build, because the build needs the
workspace packages and the pinned repository toolchain, which the
repository's own workflow supplies. [Site deployment](./site-deployment.md)
defines the Pages workflows, sticky PR comments, cleanup and domain redirects.
