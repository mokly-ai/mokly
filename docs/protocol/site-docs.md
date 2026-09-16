# Site Docs

The `/docs` section is the canonical documentation for everything a user of
the CLI, the catalogue or Mokly Cloud needs. It is written from this
repository's real behavior, README, protocol docs and changelog. This contract
fixes the information architecture, the content model, the docs layout and the
verification rules. Routes and copy rules are in [Site](./site.md); tokens in
[Site design](./site-design.md).

## Content Model

Docs are MDX files in the Astro content collection `docs` under
`site/src/content/docs/<section>/<slug>.mdx`. The route is
`/docs/<section>/<slug>`; `/docs` is the Getting started overview. Frontmatter:

| Field         | Required | Meaning                                               |
| ------------- | -------- | ----------------------------------------------------- |
| `title`       | yes      | Page title and sidebar label                          |
| `description` | yes      | Meta description and the lead under the title         |
| `section`     | yes      | One of the section ids below                          |
| `order`       | yes      | Sidebar order within the section, ascending           |
| `status`      | no       | `ahead` marks a page written before the cloud shipped |

The schema rejects unknown sections, duplicate orders within a section and
duplicate slugs, and a page whose directory is not its section. `status` is
never rendered; a test lists every `ahead` page. `site/src/docs/pages.ts` reads
the same files from disk and joins them with the published protocol documents,
so the section tree, previous and next, the sitemap, the social cards and the
verification tests read one list; the build fails when that list and Astro's
`docs` collection describe different pages.

## Information Architecture

| Order | Section id  | Title                  | Pages                                                                                                                       |
| ----- | ----------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1     | `start`     | Getting started        | Install, Configure, Your first screen, Build, Serve                                                                         |
| 2     | `authoring` | Authoring              | Config, Screens, Components, Viewports and color schemes, Collections and tags, Use-case flows, Pages, Links, Review-ignore |
| 3     | `catalogue` | Catalogue              | Browse, Search and filters, Changes, Details, Export and host                                                               |
| 4     | `cli`       | CLI reference          | One page per command: `serve`, `build`, `check`, `export`, `publish`; plus Options and exit status                          |
| 5     | `ci`        | Continuous integration | GitHub Action, Publish from CI, Project tokens, The upload, The check on a pull request                                     |
| 6     | `cloud`     | Mokly Cloud            | Overview, Connect a repository, Branches and pull requests, Sharing and access, Organizations and roles, Settings (`ahead`) |
| 7     | `reference` | Reference              | Allowlisted protocol documents published from `docs/protocol`                                                               |
| 8     | `review`    | Review and edit        | Comments, Approvals, Pull request sync, Agent sessions, Click to reference (`ahead`)                                        |

Section order and titles are fixed in `site/src/docs/sections.ts`; the
sidebar renders sections in this order and pages by `order`. The Changelog is
a site route, not a docs section, and the sidebar's last item links to it.

Install snippets read the version from the workspace `@mokly/mokly` package at
build time and render `npm install --save-dev @mokly/mokly react react-dom`;
pinned examples use that version. Pages never write an install command
themselves: `Install` renders the command (with `pinned` for the exact
version) and `Version` names the version in a sentence, both passed to MDX as
components. The Getting started overview is the Docs landing at `/docs`.

## Docs Layout

- Left section tree generated from the collection: section titles with their
  pages in order, every section that has pages listed expanded under a mono
  rubric head. The
  tree sits on the page canvas rather than in a filled panel and is separated
  from the document by one vertical hairline. Rows are 44px targets with a
  `folioMuted` hover fill; the current page is marked with
  `aria-current="page"` and takes the `accentSoft` fill with `accent` text.
  The published Mokly CLI version heads the tree as a quiet chip linking the
  changelog. On desktop the tree is pinned to the viewport and scrolls
  independently of the document, with the version label fixed at its top and
  the Changelog link fixed at its foot. Below the breakpoint the tree is a
  native disclosure labelled
  with the current section and page.
- The document is ruled: the location trail is the eyebrow above the page
  heading, the page description is set as an accent-ruled pull quote, and
  hairlines separate the intro, each body section and the previous and next
  row.
- Right "On this page" list generated from the page's `h2` and `h3` headings,
  in a `nav` labelled "On this page" hung from its own hairline at the outer
  edge; pages with fewer than two headings omit it. It drops on narrow
  desktop widths and renders under the title on mobile.
- Previous and next links at the foot of the document follow sidebar order
  across section boundaries and are cards that take a `folioLineStrong` edge
  on hover.
- The search control sits in the site header on documentation routes; there
  is no utility bar.
- Code blocks render in the Folio code panel with a language label when the
  fence names one and a copy control that writes the block's text to the
  clipboard and confirms "Copied" for two seconds. Shell commands appear only
  in code blocks. A Markdown-pipeline plugin wraps every block in the panel, so
  authored pages and published protocol documents render the same panel, and
  one React island per page places a copy control in each panel and copies that
  panel's own text rather than a second copy carried in the page. Syntax
  highlighting uses Shiki with `github-light-high-contrast` and
  `github-dark-high-contrast` selected by the color scheme; both are held to
  4.5:1 against the code panel surface in their scheme.
- Search indexes every docs page with Pagefind after the site build. Each
  document marks its `main` element as the indexed body and its chrome as
  ignored, so the tree, the rail and the pager never answer a query. The header
  search control on docs pages is a React island that loads the Pagefind
  JavaScript interface on the first search and opens a modal dialog; results
  link to the page and to the heading that matched. The index excludes
  marketing and legal pages, and the link check fails when it does not cover
  every published documentation page.
- Headings get stable ids from their text; duplicate heading text on an
  authored page fails the build.
- Every docs page has one `h1`, the title; MDX content starts at `h2`.

## Reference Section

Allowlisted documents from `docs/protocol` are published under
`/docs/reference/<slug>` from their Markdown source at build time; they are
never copied into `site/`. A content collection reads them where they live and
renders them through the same Markdown pipeline as the authored pages, so a
published document takes the same code panel, heading ids and layout. The allowlist lives in
`site/src/docs/reference-allowlist.ts` with, per document, the source path,
slug, title and order. The initial allowlist:

| Source                                    | Slug               | Title                  |
| ----------------------------------------- | ------------------ | ---------------------- |
| `docs/protocol/mokly-export-delivery.md`  | `export-delivery`  | Static export delivery |
| `docs/protocol/mokly-export-ownership.md` | `export-ownership` | Export ownership       |
| `docs/protocol/mokly-upload.md`           | `upload`           | Catalogue upload       |
| `docs/protocol/mokly-navigation.md`       | `navigation`       | Catalogue navigation   |
| `docs/protocol/mokly-link-controls.md`    | `link-controls`    | Styled link controls   |
| `docs/protocol/mokly-pages.md`            | `pages`            | Pages in the catalogue |

Relative links inside a published document to another allowlisted document
rewrite to its site route; links to any other repository path rewrite to the
file on GitHub at `main`. The document's first `h1` becomes the page title
and is removed from the body. A test checks that every allowlisted source
exists, that no excluded document is reachable from the site, and that link
rewriting covers every relative link in the allowlisted set.

## Verification

- CLI reference: a test parses every documented command, option and value
  form from the `cli` section and asserts each exists in `src/cli/help.ts`
  and `src/cli/arguments.ts`, and that every public option in the parser is
  documented. Hidden process options (`__serve-child`, `--retained-runtime`,
  `--strict-port`, `--update-version`) are excluded by name.
- Exit status: the reference documents `0` on success and `1` on any failure,
  with the typed error categories from `src/errors.ts` listed as the
  `[mokly/<category>]` prefix a reader sees; a test asserts the list matches.
- Authoring: every public export in `src/index.ts` is named on at least one
  authoring page; a test asserts coverage.
- Config: the Config page's field list matches the `MoklyConfig` type; a test
  asserts every top-level field appears.
- Continuous integration: `site/tests/docs_ci.test.ts` checks the CI pages
  against the upload protocol and publisher: exact endpoint and headers,
  acceptance and rejection behavior, timeout, required null comparison fields,
  missing/extra-field rejection, optional directories, authentication before
  decompression, CLI options and credential environment variables.
- Cloud and review pages cite the cloud protocol document they were written
  from in a page-level comment, `{/* Source: mokly-cloud <path> */}`, listing
  one or more documents separated by `, ` and relative to `docs/` in that
  repository. A test fixes the set of `ahead` pages, checks every citation
  names a known cloud document and rejects a section that is part shipped and
  part ahead; the alignment pass in [Site](./site.md) reads the same list.
- Link check covers every internal href and anchor across the built site.
- Browser test opens a docs page at 390px and 1440px in light and dark, uses
  the sidebar, on-this-page and previous/next links, copies a code block and
  runs a search that returns the expected page.

## Writing Rules

- Never document a command, flag, option, field or behavior that a test has
  not verified exists in the current code.
- Prefer one page per concept; keep each page under about 200 lines of MDX.
- Use product nouns in headings; exact identifiers belong in code spans and
  tables.
- Cloud pages describe the hosted service from its protocol docs in the
  present tense without "coming soon" language, and carry `status: ahead`.
