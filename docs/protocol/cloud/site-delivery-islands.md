# Site Delivery Islands

Status: The measurement and home demo islands are not built yet. [Milestone 5](../../../plans/canvas-redesign.md#milestone-5-site-home) builds the home demos and the measurements.

This is the script sub-contract of [Site delivery](./site-delivery.md). It
fixes the small same-origin scripts of the site and the rendering of the HTML
samples. [Site design pages](./site-design-pages.md),
[Site design components](./site-design-components.md) and
[Site docs layout](./site-docs-layout.md) fix the parts that the islands
serve.

## Script Islands

Every page reads fully without script. An island is a small same-origin
script that adds behaviour to the built page. Without script, a page shows
the state that its mockup draws, without the controls that need script, and
a measured size tag, type badge or redline value does not show. Every island
honours reduced motion: nothing moves, and each part shows its finished
state.

| Island          | Pages                          | Behaviour                                                          |
| --------------- | ------------------------------ | ------------------------------------------------------------------ |
| Scheme          | every page                     | Applies the scheme choice before the first paint; runs the control |
| Menu            | every page                     | Opens and closes the mobile menu                                   |
| Measurements    | home, docs, changelog, pricing | Shows rendered sizes in size tags, type badges and redlines        |
| Home demos      | home                           | Plays each demo in view; marks the section in view in Specs        |
| Search          | docs                           | The search dialog and its keys                                     |
| Copy            | docs                           | The copy control of each code panel                                |
| Tree            | docs                           | The tree scroll memory and the tree sheet                          |
| Docs scroll spy | docs                           | Marks the section in view and shows the reading progress           |
| Sample          | docs                           | Runs the controls, the lit lines and the wire of a sample band     |
| Changelog       | changelog                      | Runs the filter; marks the release in view in Version history      |

- The scheme island loads in the page head as a blocking, content-hashed,
  same-origin script, so it sets the scheme from the choice of
  [Site](./site.md) before the first paint. An inline script with a CSP hash
  was rejected, because no published page carries an executable inline
  script. A deferred script was rejected, because the page would first paint
  in the system scheme. Without script the page follows the system scheme,
  and the scheme control does not show.
- The search and copy islands hydrate; the other islands run without
  hydration.
- A home demo plays once when it comes into view and rests in its finished
  state, which the built page draws.
- The changelog filter shows only the notes of the chosen group and the
  releases that hold them, and its status line counts them. Without script
  the filter does not show, and every note shows.
- The sample island switches the frame to the chosen viewport and saved
  state, and it dims the lines that the chosen view does not render. Without
  script the band shows its code beside its first view, with the dimmed
  lines of that view, and without the controls or the wire.

## HTML Samples

The build renders each [HTML sample](../mokly-guides.md#html-samples) of an
installed guide with the workspace `@mokly/mokly` package, as a static build
renders that file under the default configuration: one view for each
viewport and saved state, in the light scheme, with no stylesheet. The build
records the element that each source line renders in each view. Each view
shows in a sandboxed frame that runs no script and loads nothing from another
origin. Each frame keeps the site origin, so that the sample island can find
the element of a line; an opaque frame would hide its elements, and boxes
measured at build time do not match the reader's fonts. Each frame has a
title that names the screen, the viewport and the saved state. [Site docs layout](./site-docs-layout.md#html-samples) fixes how
the band draws the sample.
