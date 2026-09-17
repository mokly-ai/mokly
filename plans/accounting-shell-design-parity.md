# Accounting Shell Design Parity

Bring the served Mokly Browse shell back to the refined design that lives in
the Accounting repository (`docs/mockups/src/mockbook` plus `mockbook.css` and
`styles.css` at `/Users/calummoore/projects/futex/accounting`), and adopt
`@firna/ui` in the example catalogue the same way Accounting's product screens
use it. The extracted shell drifted from that design: flat device frames, a
too-small fluid desktop viewport, glyph-character nav icons, non-interactive
breadcrumbs, a different top bar and details panel, and no expand-to-wide-view
control on the browser frame.

Target design (from Accounting, treated as the source of truth):

- Full-height application shell (`100vh`, internal scrolling) with a 48px top
  bar: sage brand mark, centred search, Browse/Review segmented modes.
- 248px catalogue navigation with `CATALOGUE` head, `Collapse all`, an
  All/Changed filter with a count, inline SVG folder/screen/page/flow icons,
  per-depth indent guides, child counts, and a sage active pill.
- Screen head above the stage: linked breadcrumb trail (`›` separators), title,
  and a monospace id chip linking to the stable `/id/<id>` route.
- Realistic device chrome on a dotted stage: a 390×844 dark-bezel phone frame
  with notch and home pill, and a browser frame (max-width 1180px, height
  760px) with traffic lights, a monospace address pill, and an
  expand-to-overlay toggle (Escape or outside click collapses).
- A use-case flow view with numbered steps, catalogue links, and one browser
  frame per step; a collapsible bottom details inspector with a two-column
  body (description/rationale left, labelled metadata rows right).
- Inter as the shell typeface, packaged with the shell (OFL licensed).

## Milestone 1 — Shell design protocol docs

Rewrite the shell design contract to specify the Accounting-parity design and
align the runtime contract's Browse Shell section with it.

- [x] Rewrite `docs/protocol/mokly-shell-design.md`: tokens (`--chrome-*`
      family, Inter/mono stacks), consumer-tunable accent trio defaults, layout
      (100vh shell, 48px top bar, 248px nav, internal scroll regions), device
      chrome dimensions, expand-overlay behavior, nav iconography and guides,
      breadcrumb linking, details inspector, and the review-artifact legacy
      class subset that must stay styled.
- [x] Update `docs/protocol/mokly-runtime.md` Browse Shell section: nav
      filter placement, linked breadcrumbs, frame expansion, region-scoped
      scroll restoration, font asset route, and client module list.
- [x] Validate Markdown and internal links.

## Milestone 2 — Design mockups for the parity shell

Tags: mockup

Update the example design catalogue (the visual spec for the shell) to depict
the Accounting-parity design before implementation.

- [x] Update `examples/basic/entries/design/parts/*` (shell, nav, stage,
      review) to the new top bar, nav (SVG icons, guides, filter, counts),
      screen head, device chrome, and details inspector depictions.
- [x] Update the Browse view/state screens and Review screens under
      `examples/basic/entries/design/` to compose the updated parts.
- [x] Update the authored design stylesheets
      (`examples/basic/generated/design*.css`) to the ported palette, frames,
      and layout.
- [x] Rebuild the example catalogue and commit regenerated fragments.

## Milestone 3 — Shell server enablers

Backend groundwork the redesigned shell needs; no visual changes yet.

- [x] Port the Accounting nav-tree model (nested groups from `navPath`,
      legacy-page directory folding with Overview leaves, crumb-trail route
      resolution) into `src/server/shell/nav_tree.ts` with unit tests.
- [x] Package and serve the Inter variable font (OFL license file included) at
      `/__mokly/fonts/InterVariable.woff2` via a build asset-copy step, and
      register the new client module in the served-module allowlist.
- [x] Keep the review-artifact CSS contract working: preserve `--mb-*` tokens
      and the legacy class subset the generated Review pages inline.

## Milestone 4 — Shell UI parity implementation

Tags: ui

Implement the ported design in the served shell.

- [x] Replace the shell markup modules with React SSR components
      (`renderToStaticMarkup`) ported from Accounting: document scaffold, top
      bar, catalogue nav with inline SVG icons and indent guides, screen head
      with linked breadcrumbs and id chip, frames stage, use-case flow, legacy
      embed, details inspector, home/missing/review-launcher views.
- [x] Replace the shell stylesheet with the ported Accounting CSS (tokens,
      top bar, nav, stage and device frames, expand overlay, flow, details,
      empty states) split into ≤~350-line modules, with `aria-current` /
      `aria-pressed` selectors for the shell's accessible state hooks, the
      responsive drawer below 900px, and reduced-motion rules.
- [x] Extend the client modules: frame expand/collapse (button, outside
      click, Escape), Collapse all, search that force-opens groups and
      restores their prior state, address copy-to-clipboard, nav-filter
      changed-count behavior, and region-scoped scroll capture/restoration
      for history navigation and live-reload recovery.
- [x] Update unit and browser tests for the new markup and behaviors, and add
      coverage for expansion, breadcrumb links, SVG icons, and desktop frame
      sizing.

## Milestone 5 — @firna/ui in the example catalogue

Adopt `@firna/ui` in the bundled example the way Accounting consumes it, so the
package proves the consumer contract against the real Firna stack.

- [x] Add `@firna/ui`, `react-native-web`, and the peers its used subpaths
      need as development dependencies.
- [x] Give `examples/basic` an Accounting-style renderer adapter: sage theme
      tokens, `SharedUiThemeProvider`, `renderToStaticMarkup`, and
      react-native-web `AppRegistry` style collection.
- [x] Configure `moduleResolution` aliases/conditions/mainFields in the
      example config and rebuild the product screens (Welcome, Details) with
      `@firna/ui` controls.
- [x] Update example and package documentation for the adapter pattern.

## Milestone 6 — Review artifact chrome parity (follow-up)

Tags: ui

The static Review artifact pages keep their `mb-*` structure and inherit the
new palette and typography through shared stylesheet tokens. Full parity with
the restyled Review design mockups (browser-frame compare panes, seg-control
toolbars) is deferred here.

- [ ] Restyle the Review artifact index and compare pages to the ported
      design chrome and update the artifact CSS module.
- [ ] Update the Review browser regressions for the new artifact markup.

## Milestone 7 — Verification and handoff

- [x] Run `npm test`, `npm run test:browser`, `npm run example:check`, and
      smoke-test the served shell against the Accounting reference
      screenshots.
- [x] Run `cargo xtask check`.
- [x] Commit with Conventional Commits, push the branch.
- [x] Run `cargo xtask review` after the push and report findings without
      auto-fixing them.
