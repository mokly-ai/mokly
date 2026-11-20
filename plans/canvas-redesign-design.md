# Canvas redesign: design record

This file holds the design source, Cal's decisions in force and my design
calls for the [Canvas redesign plan](./canvas-redesign.md). It is a part of
that plan, and the pull request that deletes the plan deletes this file too.
The open decisions are in [decisions 1 to 5](./canvas-redesign-decisions.md)
and [decisions 6 to 10](./canvas-redesign-decisions-viewer.md).

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
