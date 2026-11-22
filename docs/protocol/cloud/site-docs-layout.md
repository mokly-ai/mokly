# Site Docs Layout

This is the layout sub-contract of [Site docs](./site-docs.md). Each docs page
is a page of a design file: the section tree is the Layers panel, the
document is a page frame on the canvas, and the page's facts and outline form
the Inspect panel. [Site design](./site-design.md) and
[Site design components](./site-design-components.md) own the roles, the type
and the parts.

## Workspace

| Width            | Layout                                                     |
| ---------------- | ---------------------------------------------------------- |
| 1280px and above | Layers 252px, the page frame up to 880px and Inspect 236px |
| 1024px to 1279px | Layers 252px and the page frame                            |
| 768px to 1023px  | The sub-bar over the page frame, which is at most 820px    |
| Below 768px      | The sub-bar over the page frame, with a 10px canvas margin |

The columns stand 32px apart in a workspace at most 1680px wide. The panels
float on the canvas and stick 72px below the window top. Each panel is at
most the window height less 128px, and it scrolls inside itself.

## Layers Panel

The Layers panel is a floating panel and a navigation landmark named
"Documentation", with the title `Layers` and the meta `Docs`.

- Its top holds the search control and the version row. The search control
  is a 44px field shape on `background` with a `borderStrong` ring, labelled
  `Search docs`, with its key hint: `⌘K` on Apple platforms and `Ctrl K`
  elsewhere. The version row links the changelog and names the published
  Mokly CLI version on a signal chip.
- Every section that has pages is listed expanded under a `mono` rubric head
  with its page count, in the order of
  [Site docs](./site-docs.md#information-architecture). The sections scroll
  inside the panel between its top and its foot.
- Each page is a 44px row with a file icon. A CLI command's page title is
  `mono`. Hover fills a row with `background`. The current page's row carries
  `aria-current="page"` and takes `signalSoft` with `text`.
- The foot holds the Changelog row, which links the changelog.

The tree keeps 44px rows, not the design's 31px rows, because every target on
the site is at least 44px; the rows still read as a dense Layers panel.

## Page Frame

The document is a page frame on the canvas, selected because the page is the
selected layer.

- The frame label names the page's source path in `signalDeep`, such as
  `start/install.md`. A soft selection with corner handles outlines the
  frame, and a size tag under it shows the frame's rendered size.
- The sheet centres a reading column of at most 568px between margins of at
  least 88px and 64px. Below 1440px the margins are at least 76px and 48px,
  and on mobile they are 20px. A band, such as an HTML sample, spans the
  whole sheet.
- The intro holds the location trail as the eyebrow, with its last step in
  `signalDeep`, then the title, then the description as a lead with a 2px
  `signal` rule at its left edge.
- A hairline that crosses the whole sheet rules each `h2` section. The
  section's two-digit index, such as `01`, hangs in the margin beside its
  heading on desktop and heads the section on mobile. On desktop the index of
  the section in view takes `signalDeep`; on mobile every index does.
- Previous and next close the sheet below a hairline, as two small frames
  under the `mono` labels Previous and Next. Each names the neighbour's
  section, title and description. Each has a `borderStrong` ring, which
  becomes a `signal` ring with `shadow.medium` on hover. They follow the tree
  order across section boundaries, and they stack on mobile.

## Inspect Panel

The Inspect panel is a floating panel with the title `Inspect` and the page's
file name as its `mono` meta. It holds two sections.

- Page: the page facts as labelled rows with `mono` values: Section and, for
  a package-owned page, Version on a signal chip and Package `@mokly/mokly`.
  **Edit on GitHub** follows: a full-width 44px link with a `borderStrong`
  ring.
- On this page: the reading progress as a bar and a percentage, then a row
  for each `h2` and `h3` heading. An `h2` row repeats its section index. The
  row of the section in view takes `signalSoft` and `aria-current="location"`.
  A page with fewer than two headings has no On this page list.

Edit on GitHub opens GitHub's editor for the page's tracked source on the
`main` branch of the public repository: `docs/guides/<section>/<slug>.md` for
a guide, the protocol source for a Reference page, and the page's Markdown
under `apps/site/src/content/docs/` for a cloud page. It never opens the
package's generated copy of a guide, which Git ignores.

## Narrow Widths

- Below 1280px the Inspect panel does not show. A native disclosure under the
  lead, named On this page with its section count, holds the On this page
  list, the page facts and Edit on GitHub. It starts closed on each page.
- Below 1024px the Layers panel does not show. A sticky sub-bar under the
  tool bar, 52px tall, holds the Layers control and a 44px search control.
  The Layers control names the section and the page.
- The Layers control opens the tree sheet: a modal dialog named Layers that
  drops in under the sub-bar over a scrim. It holds the version row, every
  section with its 44px rows, and the Changelog row in its foot. The control,
  Escape, the scrim and a link close it.

## Tree Scroll

- Where the Layers panel shows, the tree keeps its scroll offset across docs
  pages in the same tab, including refresh and browser Back/Forward.
  Selecting a tree link keeps that row at its previous visible position. On
  direct entry, search, or Previous/Next navigation, reveal the current page
  with the smallest necessary tree scroll only when its row is outside the
  visible tree. Save the offset in tab-scoped storage; when storage is
  unavailable, links still work and an offscreen current page is revealed. A
  page restored from the browser's back/forward cache keeps its
  browser-restored position. Tree scrolling never moves the document or
  overrides normal page, fragment, or browser-history scroll behavior.
- The tree sheet starts closed on each page and has no saved scroll
  position. Opening it reveals the current page's row with the smallest
  necessary scroll.

## Code Blocks

Code blocks render in the
[code panel](./site-design-components.md#code-panel).

- The tab names the fence's language. A `bash`, `sh` or `shell` fence draws a
  `$` prompt before each line. Shell commands appear only in code blocks.
- Copy writes the block's text, without prompts or line numbers, to the
  clipboard and confirms Copied for two seconds. It copies that panel's own
  text rather than a second copy carried in the page.
- Authored pages and published protocol documents render the same panel.
  Every fence language the installed guides use renders with its normal
  highlighting, label and copy control; unknown fences are not stripped, and
  no code is copied twice.

## Search

The search control of the Layers panel, or of the sub-bar below 1024px, opens
a modal search dialog. `⌘K` or `Ctrl K`, and `/`, open it on every docs page.
Close, Escape and a press on the dimmed page close it, and a press inside the
dialog keeps it open. Decision 27 rejected closing search only on Close and
Escape, because the menu and the tree sheet also close on that press.
Search sits in the Layers panel, as the design draws it, not in the site
header. Search covers every docs page and no marketing or legal page. Only
the document body is indexed, so the panels, the location trail and the pager
never answer a query. Results link to the page and to the heading that
matched. The link check fails when the index does not cover every published
documentation page.

## HTML Samples

An [HTML sample](../mokly-guides.md#html-samples) of a guide renders as a
sample band: a band of the dot-grid canvas across the whole sheet, between
hairlines.

- Head: the screen's title as a dark tag and its catalogue path as a `mono`
  chip.
- Code: the fence in a numbered code panel, whose tab names the file, with
  its folder as the path and `html` as the language.
- Controls: two segmented controls of native radios. `Viewport` offers Mobile
  and Desktop. `Saved state` offers the screen's title for its default state,
  then the title of each variant. The checked option takes `background` with
  a `borderStrong` ring. On mobile each option is 44px tall.
- Frame: the chosen view, scaled down on the canvas, labelled with the
  viewport's name and icon, with a selection and a size tag of the view's
  full size: 390 × 844 for Mobile and 1280 × 800 for Desktop. The view keeps
  the browser's default style, light in both site schemes, because the
  sample has no stylesheet. The band opens on Mobile in the default state.
- Lines: a line that renders nothing in the chosen view is dimmed. Pointing
  at a line or an element, or tapping it, lights the line and the element.
  Where the band sets the frame beside the code, a `signal` wire joins the
  lit line to its element.
- The band sets the frame beside the code while the page frame is at least
  846px wide. Narrower, it stacks the head, the code, the controls and the
  frame, without the wire.

[Site delivery islands](./site-delivery-islands.md#html-samples) fixes how
the build renders each view, and the island that runs the band.
