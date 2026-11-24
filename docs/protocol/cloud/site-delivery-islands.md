# Site Delivery Islands

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

| Island          | Pages                          | Behaviour                                                                           |
| --------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| Scheme          | every page                     | Applies the scheme choice before the first paint; runs the control                  |
| Menu            | every page                     | Opens and closes the mobile menu                                                    |
| Measurements    | home, docs, changelog, pricing | Shows rendered sizes in size tags, type badges and redlines                         |
| Home demos      | home                           | Plays each demo in view; runs the Swipe divider; marks the section in view in Specs |
| Search          | docs                           | The search dialog and its keys                                                      |
| Copy            | docs                           | The copy control of each code panel                                                 |
| Tree            | docs                           | The tree scroll memory and the tree sheet                                           |
| Docs scroll spy | docs                           | Marks the section in view and shows the reading progress                            |
| Sample          | docs                           | Runs the controls, the lit lines and the wire of a sample band                      |
| Changelog       | changelog                      | Runs the filter; marks the release in view in Version history                       |

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
- A mouse or a pen that moves over the compared screens of the Browse demo
  pauses its sweep, and the sweep resumes when the pointer leaves. A scroll
  alone does not pause it.
- A press grabs the Swipe divider: the divider and the branch screen's clip
  follow the pointer until the release. A touch grabs it when it moves across
  the screens, and a tap puts it under the finger. A touch that moves up or
  down scrolls the page. After a grab the sweep does not play again, and the
  divider stays where the reader leaves it until the page loads again. The
  divider takes no focus. Without script the divider rests at 50%.
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
