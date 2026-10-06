# Documentation

Rules for README files, the docs under `docs/`, protocol docs, and mockups.
[`AGENTS.md`](../../AGENTS.md) holds the always-on rule that docs and mockups
stay aligned with the implementation; this document holds the structure and
content rules.

## Readme (README.md)

- Summary of the key features of the project (not a long list of every single feature)
- User facing interface documentation (e.g. CLI, API, etc)
- Developer get started
- Key code jumping in points
- Links to protocol docs and plans

## Rust Crate READMEs

- Treat every Rust crate `README.md` as user-facing documentation that should be good enough to publish on crates.io
- Start with a short statement of what the crate is for, where it fits in the workspace, and when a caller should depend on it
- Document the crate's public behavior and integration boundary, not just its internal implementation details
- Every Rust crate README must include these sections, in this order:
  - `## Responsibilities`
  - `## What This Crate Does`
  - `## Quick Start`
  - `## Development`
  - `### Key Code`
  - `### Related Docs`
- `## Quick Start` must include example code or runnable commands, not just prose
- For binary crates or user-facing tools, document the CLI or external interface in the README, not just internal architecture
- Keep examples and guidance aligned with the real public API and current behavior; do not describe internals that callers cannot use directly
- Keep crate READMEs concise and high-signal; explain the main use cases and boundaries rather than listing every file or every minor feature
- When a crate has important neighboring crates, name them and explain the boundary between them so ownership is clear

## Docs (./docs)

- Docs must be kept up to date with implementation at all times
- Any discovered gaps in the docs during implementation should involve an update to the protocol docs
- Must be consistent with itself (i.e. no conflicting statements)
- Must cover entire impl (i.e. no guess work should be needed)
- Any time you make a change to the code, think about whether a doc could be clarified or enhanced
- Docs may be nested in multiple directories

## Protocol Docs (./docs/protocol) aka Specs

- These define the specs contract with code
- Should be as detailed as possible
- Must remained aligned with impl
- Must be complete, there should be no guess work needed during impl
- If there are bugs in the code, review whether the specs need to be better defined
- Keep each doc short (~250 lines)

## Mockups (./docs/mockups)

- Mockups are part of the spec and must stay aligned with the implementation at all times
- Any work that requires design implementation must update an existing mockup or create a new one first, before the implementation lands
- Every mockup must include two variants: a mobile variant and a web/desktop variant
- A generated screen-spec mockup page may render no more than five screen
  mockups. If a product area needs more states, screens, or flows, split it into
  linked nested sub-pages instead of adding a sixth mockup to the same page.
  User-flow sequence pages are exempt because they reuse screens from the owning
  screen-spec pages.
- Non-terminal mockup pages (pages with child mockup pages) must render one
  canonical "best representation" screen for that page, then list links to the
  child sub-pages underneath. Put each child page in its own matching directory
  so the `docs/mockups` generated output and `docs/mockups/src/pages` source
  tree mirror the visible mockup page hierarchy. Pure gallery/catalog index
  pages are exempt from the canonical-screen requirement.
- When creating or changing mockups, consider where each screen sits in the
  wider app. Do not build an isolated mockup that cannot be reached from
  another relevant screen, flow, or navigation surface, and keep new mockups
  visually and structurally consistent with existing screens.
- Mockup screens must not contain implementation hints, engineering notes, or
  explanatory annotations inside the rendered screen area. Put implementation
  hints below the screen or in a separate non-screen section.
- Mokly's example catalogue under `examples/basic/generated/` is generated from
  the structured definitions under `examples/basic/specs/` using
  `examples/basic/mokly.config.ts`. Canonical entry modules end in `.mockup.ts`
  or `.mockup.tsx`; shared TSX components and page-render helpers live alongside
  them in the example source tree. Definitions and helpers should compose TSX
  components, not large raw HTML strings or generated static-tree data. When
  changing example entries, the renderer, configuration, or configured styles,
  run `npm run build`, run `npm run example:build`, run
  `npm run example:check`, and visually smoke-test the changed pages through
  `npm run dev`. The example uses the default derived output mode: generated
  HTML and `mokly-manifest.json` under `examples/basic/generated/` are ignored
  local artifacts validated by `npm run example:check`. Commit only the tracked
  authored CSS there; never force-add ignored generated output.
- Do not hand-edit Mokly-owned generated HTML or `mokly-manifest.json` as source
  of truth. Update the entry, imported helper, renderer, or shared component
  first, then regenerate the example catalogue.
- Each app screen must be its own component: one screen = one component, for
  both the mobile and web/desktop variants. Screen components are the reusable
  building blocks that user flows compose, so do not inline a screen's markup
  directly into a flow.
- User flows:
  - A user flow is designed to show a sequence of screens across a scenario
    flow (the steps a user takes through a scenario), not a single standalone
    screen.
  - User flows in mockups must use ONLY existing screen components, and each
    must link back to the screen component it uses. If a flow needs a screen
    that does not exist yet, do not create it inside the flow: first add the
    screen component to the relevant app screen-spec section so it renders as a
    standalone screen on its owning app mockup page, then import that component
    into the user flow and link back to it. A user flow is never the original
    home of a screen.
  - Each screen shown in a user flow must have a link back to its original
    standalone screen mockup.
