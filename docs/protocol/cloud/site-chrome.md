# Site Chrome

This is the chrome sub-contract of [Site](./site.md): the header, the menu,
the footer and the scheme control that every page shares, and the zoom pill
of the home. The header is the tool bar of the depicted design file, and the
footer is its last frame. [Site design](./site-design.md) owns their look and
the brand.

## Shared Header And Footer

Every page renders the same header and footer around one `main` landmark.

- Brand: the Mokly mark beside the wordmark. The brand links Home with the
  accessible name "Mokly home". In the mobile header the brand shows the mark
  alone where the bar cannot hold the wordmark beside Get started and the
  menu control, and keeps its name.
- Desktop header, in reading order: the brand; the file title
  `mokly.ai — <page>` with a `main` branch chip; the avatars of the people in
  the file; **Docs**, **Changelog**, **Pricing** and **GitHub**; and the
  filled **Get started →**. The header has no tool glyphs, no search and no
  scheme control. As the page narrows, the file title and the avatars leave
  the row before any link does.
- Mobile header (below 768px): the brand, **Get started →** and a control
  named "Menu". The control opens a modal dialog named "Menu": a sheet that
  drops below the bar over the dimmed page and lists **Docs**, **Changelog**,
  **Pricing**, **GitHub** and **Get started →**. Its "Close menu" control
  takes the menu control's place and focus. That control, Escape and a press
  on the dimmed page close the menu and return focus to the menu control.
  Widening to the desktop header or leaving the page also closes it.
- On documentation routes narrower than 1024px, under either header, the docs
  sub-bar sits below the bar, as
  [Site docs layout](./site-docs-layout.md#narrow-widths) defines.
- Footer, in reading order: the brand, the line stating the Mokly CLI is open
  source under the MIT license, and the scheme control; then two link groups,
  Product (**Home**, **Docs**, **Changelog**, **Pricing**) and Legal
  (**Terms**, **Privacy**, **Complaints**, **Security**). A status bar under
  the footer depicts the file: its title, the people in it and the zoom. On
  the home the zoom pill is a control, as [Home zoom](#home-zoom) defines.
- A skip link to `#main` is the first focusable element. The current route's
  header, menu and footer links carry `aria-current="page"`; a docs page marks
  **Docs**. Every link and control has a visible focus ring and a target of at
  least 44px. Reading order is header, main, footer on every viewport.

The file title, the avatars and the status bar are depictions, so the
[accessibility rules](./site.md#accessibility) of Site apply to them. The
home's zoom pill is the one exception. The
[action targets](./site.md#get-started) are in Site too.

## Scheme Control

The footer of every page holds the scheme control: a radio group named "Color
scheme" with **Light** and **Dark**. The page has no other scheme control.

- With no kept choice, the page follows the reader's system scheme, and the
  control checks the scheme in use.
- A choice applies at once, and the site keeps it in `localStorage` on that
  device. A kept choice applies before each page first paints, so no page
  shows the other scheme first.
- `?scheme=light` or `?scheme=dark` selects that scheme for one page view, for
  screenshots. The site does not keep it, does not add it to its links and
  leaves it out of canonical addresses. Carrying the parameter across links was
  rejected, because it changes every canonical address.
- The site sets no cookie for the choice. Without script, the page follows the
  system scheme and the control does not show.

## Home Zoom

On the home, the zoom pill at the end of the status bar is a control that
zooms the page. Every other page keeps the depicted pill. The pill stays in
its place in the status bar. A pill that floats at the window's bottom while
the reader scrolls was rejected, because it covers content and can hide a
focused link.

- The pill is a group named "Zoom" that holds a "Zoom out" button, the zoom
  and a "Zoom in" button. These are the names of the product's pill on the
  [canvas stage](../mokly-shell-canvas-stage.md#canvas). The zoom is a whole
  percentage in a polite live region, so a screen reader announces each
  change. It is text, not a reset control.
- The zoom runs from 8% to 200%, and each page load starts at 100%. A range
  that stops at 100% was rejected, because Zoom in would then do nothing at
  page load and could read as a dead control.
- Zoom in multiplies the zoom by 1.25 and Zoom out by 0.8, the step of the
  product's pill. A step past an end stops at that end. A step that lands
  within half a step of 100% lands on 100%.
- At 8% Zoom out takes `aria-disabled`, and at 200% Zoom in does. The button
  keeps focus, and a press on it does nothing.
- A press applies the zoom at once, and the zoom never animates. After a
  press the pill keeps its place in the window, so repeated presses land on
  it. The zoom works at every window width.
- The zoom scales the home's `main`, except the Specs panel, and its footer
  frame. [Site design pages](./site-design-pages.md#home) defines the layout
  at each zoom.
- The pill has no Fit, and the page has no zoom keys and no zoom gestures.
  ⌘ or Ctrl with + or −, the wheel and a pinch stay the browser's zoom. A
  canvas that zooms on the wheel and on a pinch was rejected, because it takes
  the browser's zoom from readers who enlarge the page to read it.
- The site stores no zoom, and the address never holds it. A kept zoom was
  rejected, because it adds an item of browser storage to the
  [privacy policy](./site-legal.md#data-and-providers).
- Without script, the home shows the depicted pill of every other page, and
  its whole status bar is a depiction.
