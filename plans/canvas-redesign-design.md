# Canvas redesign: design record

This file holds the design source, Cal's decisions in force and my design
calls for the [Canvas redesign plan](./canvas-redesign.md). It is a part of
that plan, and the pull request that deletes the plan deletes this file too.
The open decisions are in [decisions 1 to 5](./canvas-redesign-decisions.md)
and [decisions 6 to 12](./canvas-redesign-decisions-viewer.md).

## Design source

The prototype is static HTML, CSS and script. Cal's Mac holds it as
`.context/handoff/mokly-canvas-handoff.tgz` in the `mokly-website-redesign`
workspace folder. Its SHA-256 is
`1a393c9e87d9065fa157733c2c738d2628fb6f9602f66c53db60dda230f5108c`. This
workspace unpacked it into the git-ignored
`.context/canvas-design/site-concepts/`. The main parts:

- `claude/canvas/`: the home page, with `docs/`, `changelog/` and `pricing/`.
  `css/base.css` holds the main light palette, `css/tokens.css` the chrome
  tokens and `css/scheme-dark.css` the dark values.
- `claude/canvas-viewer/`: the viewer prototype. Its `NOTES.md` lists every
  state and a feasibility table.
- `HANDOFF.md`: Cal's decisions in force, with the exact copy and colours.
- Each folder's `NOTES.md`: layout, type, motion, copy and known gaps.

Milestone 1 moves the design into the mockup catalogues. After that the
mockups are the source of truth, and the prototype is only a reference.

## User decisions

Cal made these decisions in the `mokly-cloud` workspace. The handoff file
gives the full list.

- 2026-11-19: Canvas is the direction. The other six concepts are retired.
- 2026-11-19: The site header holds the brand, a file title with a branch
  chip, decorative avatars, Docs, Changelog, Pricing, GitHub and **Get
  started →**. It has no tool glyphs and no scheme control.
- 2026-11-19: The light and dark control sits in the footer of every page.
- 2026-11-19: The home side panel is **Specs**, with the page sections only.
  The home page has no Inspect panel. Changelog has no Inspect panel. Pricing
  has no Layers panel and no seats section.
- 2026-11-19: The hero heading is `Design in code.` at 162px on desktop. The
  lead is `Generate an interactive mockup of your entire app using your
existing React, HTML and CSS components.`
- 2026-11-19: The second hero action is **Download for Mac**. It opens
  `https://github.com/mokly-ai/mokly-desktop/releases`, because every desktop
  release is still a pre-release. The closing keeps **View on GitHub**.
- 2026-11-19: The Browse heading is `A visual diff for every branch.` The
  Review heading is `Sticky comments.` Its body says that each comment is tied
  to its component, so it stays put when the layout changes.
- 2026-11-19: The Components box shows a quiet `works with Storybook` label
  with the official Storybook icon.
- 2026-11-19: Filled green buttons use `#109f5c` with white text. Decision 4
  covers the contrast rule.
- 2026-11-19: In the viewer, the theme toggle leaves the bar. Theme and
  Settings move into the account menu. The right panel gets a tab header that
  also sets what a click does.
- 2026-11-20, in this workspace: skip the Comment and Agent tabs. Follow the
  rest of the design where possible. Check large features that the product
  does not have yet with Cal first. The site may depict features that ship
  before go-live.

- 2026-11-20, in this workspace, the ten decisions of the decisions files:
  - Decision 1, **D**: one Canvas look everywhere, open-source Mokly
    included, generated from one palette source in `@mokly/ui`.
  - Decision 2, **A**: draw the demo app as static components. The "every
    value is real" rule is relaxed until go-live, because the site is not live
    yet, and comments and agents ship before go-live.
  - Decision 3, **A**: add `/pricing` now, with links to `/sign-up`.
  - Decision 4, **A**: keep `#109f5c` with white text, and accept 3:1.
  - Decision 5, **B**: the new mark and the Geist wordmark everywhere.
  - Decision 6, **C**: the full canvas stage with four frames, pan, zoom,
    floating panels, the phone dock and compare on every frame.
  - Decision 7: "it should align with the mockup/design", read as **C**:
    Inspect with the box model, and Changes.
  - Decision 8, **C**: keep Overlay, and add a Swipe mode with the divider.
  - Decision 9, **A**: no presence in the app now. A follow-up item holds it.
  - Decision 10, **C**: a general Markdown fence that renders an HTML sample
    beside its code.

- 2026-11-20, in this workspace: reduce testing. Each delegated workspace runs
  only the tests that cover the files that it changes, and does not run the
  complete gate or wait for CI. The primary branch merges a work item after
  the diff read and those targeted tests. One full test pass runs on the
  primary branch when every milestone is merged. Then the pull request into
  `main` opens, and its CI is the final check.
- 2026-11-20, in this workspace: delegated workspaces open no pull request.
  Each pushes its branch and reports, and the primary branch merges the
  branch directly after the review.

## Design calls

These are my calls, made on 2026-11-20. Cal can change any of them.

- The scheme choice persists in `localStorage`, and `?scheme=` still selects
  a scheme for screenshots. The prototype carried `?scheme=` across every
  link, which changes canonical addresses. The site still sets no cookie.
- `/docs/` stays the Getting started overview. The prototype opened Install
  only because it built two pages.
- The docs search moves into the Layers panel, as designed. `⌘K` and `/`
  open it on every docs page.
- Code panels stay dark in both schemes, as designed, and keep 4.5:1 text.
- Fonts are self-hosted: Geist, Geist Mono and, for the depicted demo app,
  Instrument Serif. All three use the SIL Open Font License.
- The changelog filter, the version history scroll spy and the home demos are
  small same-origin script islands. Each page reads fully without script.
- Small design parts that the product lacks go in, because Cal asked for the
  design where possible: `⌘K` for viewer search, a Theme choice in the
  account menu, and next and previous change.
- Every animation honours reduced motion and shows the finished state.
- The docs tree keeps 44px rows, not the design's 31px. `site.md` and
  `site-design.md` ask for 44px targets, and the rows still read as a dense
  Layers panel.
- `mokly serve` keeps its Appearance control in the bar, restyled, because
  the standalone shell has no account menu. Only the cloud moves Theme into
  the account menu. The frame scheme preview stays a stage control.
- Inspect keeps Usage and the nested component tree as collapsible sections
  under the design's sections. The design has no place for them, and
  removing them would delete functionality that `origin/main` has.
- The home Browse demo draws the Swipe mode with its divider, and lists the
  five compare modes of the product.

- Mockup calls of the Milestone 1 workspaces, 2026-11-20: Canvas Browse
  designs are a new `design/canvas` family beside today's screens; desktop
  frames are 1280 × 800 and mobile frames 390 × 844; the Frames filter
  replaces the viewport choice and holds Highlight components; Props on a
  variant set edits the selected frame's variant; a desktop page narrower than
  900px draws the compact layout; the cloud check uses the side panel until
  Milestone 13 moves it into the Changes tab; Share is the one filled button
  of a viewer screen; the account menu's Settings opens the settings index;
  the switcher marks the reader's row Current; the site desktop layout steps
  between 700px and 1440px; the docs Edit on GitHub link opens the tracked
  `docs/guides/` source. The workspace reports in `.context/canvas-redesign/`
  hold the full lists.
- The catalogue's Changes filter keeps the folder tree, restyled, and does
  not take the prototype's status groups, because the tree keeps each change
  in its folder with its variants and moved rows. Cal can choose the groups.

- Calls on Milestone 2's items, 2026-11-21. Each keeps today's behaviour or
  follows the merged mockups, so none waits for Cal:
  - 13: the Frames filter is local view state, like the zoom. `viewport` and
    `colorScheme` keep their meaning, and in the compact layout they name the
    picked frame. No public type changes.
  - 14: each folder segment of Inspect's Path row is a breadcrumb.
  - 15: a saved variant opens its parent's variant set with that variant's
    Light frame selected.
  - 16: a component frame shows the desktop view, sized to its content.
  - 17: a primary click on a link in a frame navigates unless Highlight
    components is on, as today. Every other click in Inspect selects.
  - 18: the Components section lists the frame that holds the selection,
    else the first shown frame.
  - 19: Milestone 16 brings the other protocol pages in line now.
  - 23: Sign out closes the account menu. A failure opens the Account
    settings pane, which shows it.
  - 24, 26 and 28: Milestone 15 fixes the mockups: 3:1 boundaries on two
    controls, a language-only tab on ordinary code panels, and the sample's
    Desktop view.
  - 25: the shell brand page follows the code: the embedded compact bar hides
    the brand.
  - 27: Milestone 5 removes the mockups build from the site's checks and
    deployment, with the stage.

- Calls on Milestones 7 and 16, 2026-11-21:
  - Sample fence: each sample renders while the Markdown renders, through a
    plain `mokly build --no-changes`. Each view is a `srcdoc` frame with
    `sandbox="allow-same-origin"` and no script, so the sample island can
    read its elements. Views drop Mokly's own viewer scripts. Only installed
    package guides render samples.
  - A variant set has a Mobile toggle in its Frames filter, off by default,
    with the change dot when a hidden mobile view changed.
  - Selecting a variant navigates to its path. The address and the right
    panel then describe that variant; with no frame selected they describe
    the parent.
  - A component with saved variants starts its set with a row for its own
    example.
  - A variant set reads each shown variant's entry detail, as use-case steps
    do.
  - The host `sidePanel` stays a column at the right edge below the top bar,
    in both layouts.
  - Each compared frame's outcome is a line in the Changes tab's comparison
    details.
  - The Changes tab's host slot is `changesStart`.

- Calls on Milestones 10 and 15, 2026-11-21:
  - Box model: a single element root ignores comments and whitespace text;
    an element with no client rects has no box model; the content size comes
    from unrounded values, clamped at zero, then rounded. The probe now fills
    its 9 KiB budget.
  - The upgrade guide and the release cutover runbook name frame wire
    version 4, with an upgrade step from 3.
  - The HTML sample band keeps its natural height in each view, so the page
    below it moves when the reader switches views.
  - Ordinary docs code panels show no line numbers. Only the HTML sample
    fence numbers its lines.

- Calls on Milestone 3, 2026-11-21:
  - Filled primary actions keep `#109f5c` with white text at rest and on
    hover, in both schemes. A hovered primary action lifts 1px instead of
    darkening, as in the prototype. The app and the mockups draw no solid
    control-library badge, and a test checks it.
  - The cloud mockups keep a hosted Inter face only for the drawn `@mokly/ui`
    parts until Milestone 17.
  - The shell takes the new mark shape and the 640-weight wordmark now, in
    its current theme colours. Milestone 17 moves them to the signal colours.
  - Controls use 8px and surfaces 10px radii.
  - The social card embeds the committed light lockup, and its title uses a
    system font.

- 2026-11-22, Cal: to speed up, Milestone 11 starts before 18 and 22 merge,
  new browser tests run 3 times instead of 10, and the orchestrator decides
  design and scope questions and reports them.
- The calls on Milestones 17, 19 and 22 are in the
  [viewer design calls](./canvas-redesign-design-viewer.md).
- The calls on the site milestones 4, 5, 6, 8 and 9 are in the
  [site design calls](./canvas-redesign-design-site.md).

## Contract owners

- [Site](../docs/protocol/cloud/site.md),
  [Site home copy](../docs/protocol/cloud/site-copy.md),
  [Site design](../docs/protocol/cloud/site-design.md),
  [Site docs](../docs/protocol/cloud/site-docs.md),
  [Site delivery](../docs/protocol/cloud/site-delivery.md),
  [Site mockups](../docs/protocol/cloud/site-mockups.md) and
  [Marketing site](../docs/protocol/cloud/marketing-site.md).
- [Design tokens](../docs/protocol/cloud/design-tokens.md) and
  [Design token colors](../docs/protocol/cloud/design-tokens-color.md).
- [Viewer chrome](../docs/protocol/cloud/viewer-chrome.md),
  [Viewer host](../docs/protocol/cloud/viewer-host.md),
  [Folio viewer](../docs/protocol/cloud/folio-viewer.md),
  [Settings dialog](../docs/protocol/cloud/settings-dialog.md),
  [Product navigation](../docs/protocol/cloud/product-navigation.md) and
  [Product mockups: viewer](../docs/protocol/cloud/product-mockups-viewer.md).
- [Shell design](../docs/protocol/mokly-shell-design.md),
  [Shell brand](../docs/protocol/mokly-shell-brand.md),
  [Viewer palette](../docs/protocol/mokly-viewer-palette.md),
  [Viewer appearance](../docs/protocol/mokly-viewer-appearance.md),
  [Component inspector design](../docs/protocol/mokly-component-inspector-design.md)
  [Comparison panes](../docs/protocol/mokly-comparison-panes.md),
  [Shell device chrome](../docs/protocol/mokly-shell-device-chrome.md),
  [Viewer selection](../docs/protocol/mokly-viewer-selection.md),
  [Frame probe](../docs/protocol/mokly-frame-probe.md),
  [Frame probe wire](../docs/protocol/mokly-frame-probe-wire.md) and
  [Guides](../docs/protocol/mokly-guides.md).
- The [site README](../apps/site/README.md), the
  [UI package README](../packages/ui/README.md) and the
  [mockups README](../docs/mockups/README.md).

Replaced ways:

- Hand-kept colour values → one palette source in `@mokly/ui` (decision 1).
  Consumers: `packages/tokens`, the `@mokly/ui` theme, the `mokly-html`
  Markdown style and `examples/basic/design.css`. Milestone 1 adds Canvas as
  a named palette for the mockups. Milestone 3 adds the source, moves every
  consumer to it and deletes the Folio values.
- The inspector below the preview → the right panel (decision 7).
  Consumers: the shell layout, the compact sheet and the inspector browser
  specs. Moved and deleted in Milestone 12. The older Browse design mockups
  that draw it move as decision 11 says.
- The one-frame stage → the canvas stage (decision 6). Consumers: the shell,
  the view controls, the comparison stage, the cloud stage overlay, their
  specs and the older Browse design mockups (decision 11). Moved in
  Milestones 11 and 12. Deleted in Milestone 12.
- After Milestone 12, a mockup milestone moves the Canvas design library parts
  onto the new `@mokly/ui` components, as pull requests #249 to #254 did.
- The real dogfood stage on the home page → the Canvas spread, under decision 2. Consumers: `apps/site/scripts/stage.mjs`, `src/stage.ts` and their
  tests. Moved and deleted in Milestone 5.
