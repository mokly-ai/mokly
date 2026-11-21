# Site Docs

Status: The Canvas docs layout is not built yet. [Milestone 6](../../../plans/canvas-redesign.md#milestone-6-site-docs) builds it.

The `/docs` section is the canonical documentation for the CLI, catalogue and
Mokly Cloud. The installed `@mokly/mokly` package owns CLI guides and published
protocol references; this repository owns the Cloud and Review and edit
sections. This contract fixes their single rendering boundary. Routes and copy
rules are in [Site](./site.md); tokens in [Site design](./site-design.md); the
layout in [Site docs layout](./site-docs-layout.md).

## Content Model

All guides are plain CommonMark with frontmatter. A package guide may also
hold [HTML samples](../mokly-guides.md#html-samples), which the site renders
beside their code. Package-owned guides are read from the installed package's
`docs/guides/<section>/<slug>.md`; cloud-owned guides are Markdown in this
repository, one file per page. The route is
`/docs/<section>/<slug>`; `/docs` is the Getting started overview. Both owners
use one schema:

| Field         | Required | Meaning                                               |
| ------------- | -------- | ----------------------------------------------------- |
| `title`       | yes      | Page title and tree label                             |
| `description` | yes      | Meta description and the lead under the title         |
| `section`     | yes      | One of the section ids below                          |
| `order`       | yes      | Tree order within the section, ascending              |
| `status`      | no       | `ahead` marks a page written before the cloud shipped |

The schema rejects unknown sections, extra frontmatter fields, duplicate orders
within a section, duplicate slugs and a directory/section mismatch. `status` is
never rendered. Each section is wholly package-owned or wholly cloud-owned;
mixed ownership fails the build. The two sources merge into one ordered page
list. The section tree, previous and next, the sitemap, the social cards and
search all follow that list, and a disagreement between any of them fails the
build.

Package guide authoring and packaging follow the
[`mokly-guides.md`](../mokly-guides.md)
contract. The site validates that boundary and does not restate or rewrite
package-owned prose. The package decides its guide inventory, titles and
order; the site renders every guide that the workspace `@mokly/mokly` package
supplies. The set of package guides that the site expects is fixed in the
site, so a Mokly change that adds, removes or renames a guide updates that set
in the same change rather than appearing unreviewed. The workspace package
ships 34 guides, and the site expects exactly those 34.

## Information Architecture

| Order | Section id  | Title                  | Owner   |
| ----- | ----------- | ---------------------- | ------- |
| 1     | `start`     | Getting started        | package |
| 2     | `authoring` | Authoring              | package |
| 3     | `catalogue` | Catalogue              | package |
| 4     | `ci`        | Continuous integration | package |
| 5     | `cli`       | CLI reference          | package |
| 6     | `cloud`     | Mokly Cloud            | cloud   |
| 7     | `reference` | Reference              | package |
| 8     | `review`    | Review and edit        | cloud   |

Section order and titles are fixed; the tree renders sections in this order
and pages by `order`. The `cloud` and `review` sections hold the pages written
from this repository's protocol docs and carry `status: ahead` as
[Site](./site.md#ahead-of-release-pages) requires. The Changelog is a site
route, not a docs section, and the foot of the Layers panel links to it. The
docs mockup follows the same section order and page labels.

The installed package owns its install snippets and version literals. Every
version literal in the installed guides equals the installed `@mokly/mokly`
version, so a stale packed guide source cannot ship. The Getting started
overview is the Docs landing at `/docs`.

## Docs Layout

[Site docs layout](./site-docs-layout.md) fixes the layout of every docs page:
the Layers panel with the section tree and search, the page frame, the
Inspect panel with the page facts and On this page, the sub-bar and the tree
sheet on narrow widths, the code blocks and the HTML sample band.

- Headings get stable ids from their text; duplicate heading text on an
  authored page fails the build.
- Every docs page has one `h1`, the title; authored Markdown starts at `h2`.

## Reference Section

Allowlisted documents from the workspace package's `docs/protocol/` are
published under `/docs/reference/<slug>` from their Markdown source at build
time. They are never copied into the site, and they render through the same
pipeline as the authored pages, so a published document takes the same code
panel, heading ids and layout. The allowlist records, per document, the source
path, slug, title and order:

| Source                                    | Slug               | Title                     |
| ----------------------------------------- | ------------------ | ------------------------- |
| `docs/protocol/mokly-export-delivery.md`  | `export-delivery`  | Static export delivery    |
| `docs/protocol/mokly-export-ownership.md` | `export-ownership` | Export ownership          |
| `docs/protocol/mokly-upload.md`           | `upload`           | Catalogue upload          |
| `docs/protocol/mokly-upload-exchange.md`  | `upload-exchange`  | Catalogue upload exchange |
| `docs/protocol/mokly-navigation.md`       | `navigation`       | Catalogue navigation      |
| `docs/protocol/mokly-link-controls.md`    | `link-controls`    | Styled link controls      |
| `docs/protocol/mokly-pages.md`            | `pages`            | Pages in the catalogue    |

The allowlist is fixed by this contract. No protocol file becomes a site page
only because the package ships it; adding a document is a change to
this table. The table holds the documents of the **Published Protocol
Documents** list in `mokly-guides.md`, in that order,
and the site and the docs mockup fail their checks when the two lists differ.
A Mokly change that changes that list therefore changes
this table in the same change.

Guides keep their authored links unchanged; the Reference link rewriting below
never runs on a guide. A guide link to `/docs/reference/<slug>/` must name an
allowlisted slug, keeps its query and fragment, and resolves in the built
site.

Relative links inside a published document to another allowlisted document
rewrite to its site route; links to any other repository path rewrite to the
file on GitHub at the installed package's `v<version>` tag. The document's
first `h1` becomes the page title and is removed from the body. Every
allowlisted source exists, no excluded document is reachable from the site,
and link rewriting covers every relative link in the allowlisted set.

## Verification

- The installed `@mokly/mokly` is located through the npm workspace installation,
  and its package name and exact shared version are verified before any
  guide, protocol document or changelog is read. Missing, malformed or
  path-escaped package content fails the build with a boundary-specific error.
- Package-owned guide files and references must satisfy the frontmatter
  schema, link grammar and installed-version check. The site accepts the HTML
  sample fence of the guide contract. The Mokly package's own guide contract
  owns CLI-to-prose completeness checks.
- Cloud and review pages cite their local protocol source as
  [Site](./site.md#ahead-of-release-pages) requires.

## Writing Rules

- Package-owned behavior is changed in the open repository, released, then
  consumed here; this site never patches its prose locally.
- Use product nouns in headings; exact identifiers belong in code spans and
  tables.
- Cloud pages describe the hosted service from its protocol docs in the
  present tense without "coming soon" language, and carry `status: ahead`.
