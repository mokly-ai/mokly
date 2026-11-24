# Site Design Pages

Status: The home's zoom is not built yet. The [home zoom island milestone](../../../plans/home-zoom-pill.md#milestone-3-the-home-zoom-island) builds it.

This is the page sub-contract of [Site design](./site-design.md). It fixes
the look of the home, the changelog and the pricing page from the parts of
[Site design components](./site-design-components.md). [Site](./site.md) owns
their routes and their content, and [Site home copy](./site-copy.md) owns the
home copy. [Site delivery islands](./site-delivery-islands.md#script-islands)
owns the islands that make the parts below move.

## Home

- Workspace: on desktop, a 200px Specs panel sits 40px beside the frames
  column, which is at most 1080px wide. The Specs panel is a floating panel
  titled `Specs` whose rows link the page sections in order. It sticks 72px
  below the window top, and the row of the section in view is current. Below
  1200px the panel does not show, and the frames take the width.
- Hero: the heading is the selected text layer. Its `signal` selection has
  eight handles, the name tag `Heading`, a size tag with the layer's rendered
  size and a depicted cursor on its resize handle. On desktop it also has a
  type badge with the face, the weight and the rendered size. A `signal`
  redline measures the gap between the heading and the lead: 60px on desktop
  and 52px on mobile. The lead is at most 29em wide. The two actions follow
  36px below it, and they stack on mobile.
- Spread: under the hero, the drawn demo app lies across the canvas in two
  section boxes. Specs holds the app's screens as phone and desktop artboards
  at 36% zoom. Components holds its component sets and the quiet
  `works with Storybook` label with the Storybook mark. Depicted people and
  agents select and edit artboards. The spread is 830px tall on desktop and
  shows three phone artboards on mobile, and it never scrolls the page
  sideways. The demo app keeps its own warm palette, mixed from the `people`
  and signal roles, in both schemes, and it sets its titles and prices in
  Instrument Serif.
- Features: a section heading and its lead, then the Browse, Review and Edit
  modules, 158px apart. Each module has a kicker with its index, a heading,
  body copy in `textSecondary` at most 44ch wide, and a depicted demo:
  - Browse: a pull request's check card with a filled View changes button,
    joined by a `signal` connector to a depicted viewer window. Its compare
    toolbar lists the product's five compare modes in the product's order,
    and its stage shows the Swipe mode with the divider.
  - Review: a wash of artboards, where a selected component carries a name
    tag and a padding redline, beside a pinned comment and a thread card with
    a filled Approve button.
  - Edit: a depicted tool window with the agent tool active and a live
    session pill. The module's copy sits as a text layer on its dot-grid
    canvas beside an artboard, and the agent's chat with its diff docks at
    the right.
- Open foundation: the closing section. Its kicker and section heading lead
  to its copy, with the action pair, ending in View on GitHub, beside the
  copy. Below them, a frame labelled `Open foundation` sets a code panel with
  a terminal beside an artboard. On desktop a `signal` wire joins a source
  line to the element that it renders, and below 960px the wire leaves. That
  frame carries only its label, with no selection. The facts follow as pills
  at least 38px tall with `signalDeep` icons. The three steps follow as an ordered list of
  small frames joined by `signal` arrows: one row on desktop, and one column
  below 900px.
- Every demo is a depiction. It is hidden from assistive technology, and its
  controls are drawn, not focusable. The built page draws each demo in its
  finished state: the compare rests in Swipe at 50%, Review waits for
  Approve, and Edit shows the agent's change with Publish ready.
- Zoom: the zoom pill of [Site chrome](./site-chrome.md#home-zoom) zooms the
  content of the home, its `main` and its footer frame. The zoom scales the
  content with its layout, as CSS `zoom` does, so the page height, the sticky
  Specs panel, in-page links and focus scrolling work at every zoom. A scale
  transform was rejected, because it keeps the page height of 100%.
  - The tool bar, the status bar, the dot grid and the gap above the footer
    frame keep their size. At every zoom the window picks the composition
    and its steps, and the Specs panel sticks at its place below the tool
    bar.
  - At 100% and below, the content lays out in the room that the zoom gives
    it: the window's width divided by the zoom. So at a small zoom the Specs
    panel keeps its place at the window's start, as in a window wider than
    1440px.
  - Above 100%, the content keeps the layout that it has at 100% in that
    window, and it grows. The page then scrolls sideways, and the tool bar
    and the status bar stay in place. A focused part at a side scrolls into
    view. Cutting off the sides was rejected, because text there goes out of
    reach while its links still take focus. A layout for the smaller room was
    rejected, because it changes every part of the home or ends Zoom in early
    on narrow windows.
  - A measured size tag, type badge or redline value gives its part's size in
    CSS pixels before the zoom, as a design tool gives a layer's size.

## Changelog

- Workspace: on desktop, the 200px Version history panel sits 40px beside the
  frames column, which is at most 1080px wide. Below 1200px the panel does
  not show. Mobile has no panel.
- Head: the title is a selected text layer with eight handles, the name tag
  `Heading`, a size tag and, on desktop, a type badge. The lead is at most
  34ch wide.
- Version history: a floating panel that sticks below the tool bar, whose
  list scrolls inside it. Releases group by month under uppercase `mono`
  month labels. Each row shows the version in `mono` and the date, and a
  release with breaking changes adds a `warning` mark whose hidden text says
  so. A rail of dots joins the rows. The current release's dot is `signal`
  with a halo, and its row is current. The foot links the Atom feed.
- Timeline: a card above the releases, hidden from assistive technology. It
  draws a legend, a month ruler, a diamond keyframe for each release in up to
  three lanes and a `signal` playhead. A patch is hollow, a breaking release
  is `warning`, and the current release is `signal`.
- Filter: a sticky bar of radio options, All, Breaking, Features, Fixes and
  Performance, each with its icon and its note count, and a polite live line
  that counts the shown notes and releases. The checked option is
  `signalFill` with `onSignalFill`, and in forced colours it takes the system
  highlight. Below 1200px the bar stops sticking. On mobile its options form
  rows of two and three 44px targets without icons. An option is at least as
  wide as its label and count, so an option that its row cannot hold moves to
  a row of its own at any text size.
- Release frames: the six newest releases are frames 120px apart, 96px on
  mobile, each labelled with its version and date in `mono`. The head shows
  the `Mokly CLI` label, the version at 64px (40px on mobile), the date, a
  `Latest` signal chip on the newest release, the secondary
  **Read release details ↗** button, and one chip for each note group, which
  links that group. The current frame carries corner handles and a size tag
  that counts its notes.
- Notes: each group's heading sits in a rail, 236px wide at the design width,
  and sticks while its notes scroll. Below 780px the heading sits above its
  notes and does not stick. Notes are 15.5px, and their issue and commit
  links are `mono`.
- Breaking notes sit in a callout tinted with `warningSoft`, with a pinned
  `!` marker and a hint in `warning`. Upgrade notes close the release as a
  closed disclosure.
- Earlier releases: a section box after the frames holds every older release
  as a compact frame, with its notes in a closed disclosure.

## Pricing

- Page: a 1240px column with the canvas gutter. The head sets the title, its
  second line in `textMuted`, beside the lead, with a `signal` redline that
  measures the gap below the title. Below 1100px the lead moves under the
  title.
- Plans: two labelled section boxes, Mokly CLI with the Open source frame and
  Mokly Cloud with the Free and Team frames. The rows of the three frames line
  up. Each plan frame is a `surface` frame with a 2px radius, labelled with
  the plan's path in `mono`. It holds the plan name, a summary, the amount at
  54px in tabular figures, a note, its actions and a list with `signalDeep`
  checks. Team is the selected frame, with corner handles, a `signalDeep`
  label and a size tag. Hovering another frame draws a `signal` ring. Below
  1100px the boxes stack, and on mobile the frames stack 50px apart.
- Compare table: a frame labelled `Plan · props` holds a table with a hidden
  caption, column heads that stick below the tool bar, a row group for each
  topic headed on `surfaceMuted`, and row heads. The Team column takes a
  `signal` tint. A check or a dash is decorative, and each cell also names its
  value in hidden text. On mobile each row sets its head above its three
  values.
- Questions: always-open comment threads in two columns beside a sticky
  intro. Each thread is a card with a 14px radius and `shadow.medium`, with
  the question as a heading, its answer and a `Resolved` signal badge.
- Every control on the page is at least 44px tall.
