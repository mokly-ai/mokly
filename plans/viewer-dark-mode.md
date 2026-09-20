# Viewer Dark Mode

Status: in progress; the documentation and mockup milestones through 2F are
complete: the built-in preview toggle switches every dual-scheme mockup, the
standalone design shows one Appearance control on every top bar, the legacy
head-band scheme depictions are consolidated, the branch carries the merge of
`origin/main`, and the Node CommonJS lexer crash is contained. Milestones 2G
and 2H close the findings from the 2F review; Milestone 3 is next. The user
asked on 2026-09-20 for UI milestones to go to Opus 5 and non-UI milestones
to Codex, each checked by the parent session. Runtime implementation has not
started. The implementation PR's merge is this plan's completion boundary.

Give `@mokly/viewer`, local Serve and static exports a complete Auto/Light/Dark
appearance. The [appearance contract](../docs/protocol/mokly-viewer-appearance.md)
defines the target; [viewer ownership](../docs/protocol/mokly-viewer.md) and
[shell design](../docs/protocol/mokly-shell-design.md) describe the current code.

## Decisions And Scope

- Standalone Browse has one **Appearance** control, Auto/Light/Dark, in the
  top bar. It sets the interface appearance and the effective preview scheme
  together, so the catalogue is all light or all dark. Auto is the default and
  follows the system. The standalone head-band `Light | Dark` switch and the
  component workspace's Dark mode button go away, and a `scheme` URL parameter
  pins a shared link. This replaced the earlier two-control design.
- The embedded viewer takes `theme?: ViewerTheme` from its host and keeps its
  own preview controls, because the host application owns its theme and a
  designer still needs to flip one screen's variant without changing it.
  Preview `colorScheme` keeps its existing default, URLs and fallback there.
- Author the appearance mockups as ordinary dual-scheme entries, using the
  `colorSchemes` configuration, per-entry inheritance, renderer
  `input.colorScheme` and generated light/dark fragments Mokly already has. Its
  existing preview toggle then selects the variant; separate fixed-theme routes
  and the selector depicted inside an artboard are not substitutes for that
  interaction. Keep each mockup's depicted preview scenario independent. This
  changes mockup authoring, not the public viewer theme API.
- Add `theme?: ViewerTheme` to React and server rendering. Embedded hosts own
  the surrounding appearance control and persistence; standalone Browse gets
  the Appearance selector, a saved preference and the URL pin.
- Use one semantic palette for the shared shell and scoped embedded CSS.
  Preserve app independence and the three supported accent overrides.
- Cover navigation, headers, stage, inspector, Props, comparisons, overlays,
  native controls and loading/error states. Pin each frame to its own preview
  scheme, so an embedded light preview inside a dark interface and a
  standalone light-only screen under Dark keep their light indicators.
- Preserve mounted frames, selection, temporary props, active inspection and
  host slots when only appearance changes. Keep exported browsers React-free.
- Work in this repository. Adoption by `mokly-cloud` and replacement of its
  marketing illustration are separate follow-ups, not required milestones.

## Current Implementation Boundaries

- `packages/viewer/src/shell/css_tokens.ts` fixes Light values; sibling CSS
  modules also contain theme-dependent literals. `css.ts` assembles the shell.
- `packages/viewer/scripts/styles.mjs` scopes selectors but hardcodes Light
  fallbacks for inherited accent overrides; it needs scheme-aware defaults.
- `viewer/{component,ready,layout,server}.tsx` own loaded, loading/error and
  SSR roots. The runtime-owned islands must survive a host theme-prop update.
- `client/browse_state.ts`, `workspace.ts`, `viewer/selection.ts` and frame
  mounting code own preview color scheme. Do not turn it into appearance state.
- `shell/document.tsx`, `scripts/build.mjs`, `src/server/client_modules.ts`
  and `src/export/site.ts` own standalone startup and asset delivery.
- `examples/basic/entries/design/` owns mockups, including registered shared
  components; the cloud site's Astro shell is not the viewer implementation.
  The approved mockup palette and its Light corrections are recorded in
  [the semantic palette](../docs/protocol/mokly-viewer-palette.md); the shell's
  own `css_tokens.ts` still ships the uncorrected Light values.

## Execution Rules

Complete mockups before UI implementation. Add tests that capture existing
failures before correcting them. Add newly discovered TODOs to the appropriate
open milestone; do not reopen completed milestones. If backend work blocks a
tagged milestone, insert a new backend milestone immediately after it, then a
new tagged milestone carrying the blocked TODOs, as required by `AGENTS.md`.
Keep delivery plumbing separate from the UI milestone and keep every milestone
buildable with its relevant tests passing. Do not add a cloud token dependency.

This initial documentation-only change needs Markdown validation, a diff review,
commit and push, then the repository's implementation-review prompt. Runtime
and mockup implementation must pass `cargo xtask check` before completion.

## Post-merge follow-up (non-blocking)

Publish through the existing viewer-first release process and smoke the published
packages. A separate cloud change can pin that release, pass the app's appearance
into the viewer, and decide whether the marketing stage should use the real
viewer. These tasks do not block the implementation PR or plan closure.

## Milestone 1: Document the complete target (complete)

Record the behavior before changing the product or its mockups.

- [x] Inspect the public API, shared CSS/scoping, frame lifecycle, standalone
      startup, mockup ownership and existing theme tests.
- [x] Define the two settings, Auto default, host API, standalone preference,
      first paint, accessibility, preview isolation and acceptance matrix in
      `docs/protocol/mokly-viewer-appearance.md`.
- [x] Link the planned contract from current viewer/shell docs and the package
      README without claiming that dark appearance is already implemented.
- [x] Add this plan to the active index and record remaining work below.

## Milestone 2: Design the complete appearance states (complete)

Tags: mockup

Deliver deterministic mobile and desktop mockups for the full target before
changing runtime UI. Existing examples remain usable throughout.

- [x] Audit the registered components in
      `examples/basic/entries/design/library` and shared shell/workspace helpers.
      Add explicit appearance context and reusable selector composition there.
- [x] Record Light/Dark semantic swatches and status/control pairs in the
      appearance contract, with contrast calculations; document any necessary
      Light contrast corrections. Keep device-screen tokens independent.
- [x] Add the Appearance overview and the States, Workspaces and Status pages
      specified in the contract, each with matching source directories, at most
      five owning screens, and distinct mobile/desktop screen components.
- [x] Reuse existing screen and registered component implementations, retain
      existing scheme destinations, and link new screens from Browse and the
      relevant inspector/comparison contexts. Flows reuse owning screens only.
- [x] Update design inventories, configured stylesheet ownership, destinations,
      relevant design protocols, `examples/basic/README.md` and library guidance.
      Clarify Appearance versus Preview color scheme in all affected copy.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`
      and relevant design/library tests. Visually smoke changed pages using
      `npm run dev`, in both viewport variants. Keep matching generated output
      tracked and include it in the final commit; never hand-edit generated HTML.

Delivered: `examples/basic/entries/design/browse/appearance/` adds sixteen
screens across the overview and the States, Workspaces and Status groups, each
with its own mobile and desktop component. `parts/appearance.tsx` gives every
artboard an explicit appearance, and `library/chrome/appearance-selector` is a
new registered component the top bar composes when a screen supplies the
setting. `design.css` now carries one semantic palette with a Dark counterpart
for every role, `design-stage.css` carries independent preview tokens, and
`docs/protocol/mokly-viewer-palette.md` records the swatches, the computed
contrast and the three Light corrections, guarded by
`tests/design_appearance.test.ts`. The prop field's native input styling moved
into its own stylesheet so the component renders correctly in any host.

## Milestone 2A: Switch mockups with Mokly's built-in toggle (complete)

Tags: mockup

The initial mockups hardcode Light or Dark on each artboard and opt out of dark
rendering, so the existing preview toggle leaves them unchanged and shows Light
only. Correct that authoring choice by adopting behavior Mokly already has:
per-entry `colorSchemes`, the renderer's `input.colorScheme`, generated
light/dark fragments and the preview control that swaps between them. No new
switching mechanism, theme state or viewer runtime change is involved.
Milestone 2 stays completed as the historical delivery; this follow-up is
required before runtime UI work begins.

- [x] Update the plan and appearance contract to require generated light/dark
      mockup variants controlled by the existing outer preview toggle, preserving
      the separately agreed `theme="auto" | "light" | "dark"` runtime API.
- [x] Add failing regression tests before the fix: appearance entries must
      publish mobile/desktop × light/dark fragments, and the existing preview
      toggle must change the current artboard's actual colors at the same route.
- [x] Remove the light-only opt-out from the appearance screens and the two
      shared component samples whose subject is appearance, so they inherit the
      configured schemes. Pass the renderer's existing `input.colorScheme`
      through one shared context to their artboard roots instead of hardcoding
      the depicted appearance or copying a screen's JSX for each theme. That
      context carries the render input only; it is not a second theme system.
- [x] Keep each screen's nested preview scenario independent: Light preview,
      Dark preview and light-only fallback examples must keep the intended inner
      screen while their surrounding artboard changes with the outer toggle.
      An inner light-only example must not make the entire mockup light-only.
- [x] Consolidate redundant branch-added fixed-theme scenes into scenario-based
      entries and use theme-neutral titles/descriptions. Update links, hierarchy,
      inventories, registered samples and READMEs. Preserve routes and features
      already present on `origin/main`, both viewport components, the canonical
      overview, and the maximum of five owning screens per page.
- [x] Treat the Appearance selector drawn inside an artboard as the design of
      the future standalone control. Do not use it, a new outer control, route
      navigation or frame-local scripts to replace Mokly's existing toggle.
      Keep generated examples deterministic from the requested render scheme,
      including the Auto scenario, without reading the machine's system theme.
- [x] Run the existing-toggle browser regression on a normal screen, a panel or
      comparison, and the nested light-only example in both viewports. Verify
      Dark → Light → Dark changes generated fragment URLs and computed artboard
      colors without changing the selected entry, and that the outer frames no
      longer show a false Light only fallback for these dual-scheme mockups.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      relevant tests and `cargo xtask check`. Visually smoke through `npm run dev`
      using the existing toggle, inspect mobile/desktop screenshots in
      `.context/`, and include regenerated HTML/manifest output in the change.
- [x] After checks pass, include all updated docs, sources, tests and generated
      artifacts with `git add -A`, commit and push this branch. Then review the
      complete diff against `origin/main` with
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md),
      report findings without automatic fixes, and stop before Milestone 3.

Delivered: the fifteen appearance screens and the two appearance-related
registered samples dropped their `colorSchemes: ["light"]` opt-out, so
`mokly build` writes Light and Dark files for both viewports and Browse's
existing preview control swaps them at the same route.
`parts/appearance.tsx` now passes the renderer's `input.colorScheme` to
`DesignAppearanceScope`, which stamps `data-mbk-appearance`; no artboard names a
theme. The States page consolidated five fixed-theme scenes into four scenarios:
`light-preview`, `dark-preview`, `light-only` and `auto`.
`tests/design_appearance_variants.test.ts` and
`tests/browser/design_appearance_toggle.spec.ts` guard the fragments, the
artboard colors and the Dark → Light → Dark interaction.

## Milestone 2B: One Appearance control in the mockups (complete)

Tags: mockup

The delivered appearance artboards draw two scheme controls: the Appearance
selector in the top bar and the preview theme icon in the screen header. The
user chose one control that sets the interface and the previews together.
Correct the appearance section so each artboard draws only the top-bar
Appearance selector and its previews follow the artboard's scheme. Milestone
2A's generated Light/Dark variants and Browse's built-in toggle are unchanged;
this is mockup authoring, not runtime work, and the viewer API is unchanged.

- [x] Update the design-links and shell-design contracts, the workspace,
      example and library READMEs and the protocol index for the single
      control: remove the appearance scheme pairs and the removed scenarios,
      describe previews following the artboard, and keep every statement
      consistent with the appearance contract.
- [x] Add failing tests first: appearance artboards contain no head-band or
      toolbar scheme control and exactly one Appearance selector; the selector
      reads Auto on the Auto screen and the rendered scheme elsewhere; Welcome,
      comparison and flow previews use the dark device treatment only in the
      Dark render; the light-only Details subject keeps light frames and shows
      its fallback caption only in the Dark render.
- [x] Make the registered `controls/view-controls` scheme control optional so
      a caller can omit it, leaving the legacy Browse, Changes and component
      artboards unchanged. Compose the appearance header without it and drop
      `schemeLinks` from the appearance navigation states.
- [x] Remove `design-appearance-light-preview` and
      `design-appearance-dark-preview`; keep `light-only` and `auto` in
      `states/`. Repoint their references, `DESTINATIONS`, navigation states,
      inventories and the design-links table at the remaining screens.
- [x] Derive each preview's treatment from the rendered scheme through the
      shared scaffold rather than per-screen `dark` flags: `ExampleWorkspace`,
      `WelcomeShot`, the comparison panes and the flow's first step follow the
      artboard, while the Details subject stays light-only. Keep the Auto
      artboard's selector on Auto in both renders.
- [x] Keep every screen's mobile and desktop components, the canonical
      overview, at most five owning screens per page, registered-component
      reuse and no left-edge accent rails. Keep the two dual-scheme registered
      samples and update their descriptions and the library guidance.
- [x] Extend the built-in-toggle browser regression to assert the depicted
      previews change with the artboard, the light-only caption appears only
      under Dark, and no second scheme control exists, in both viewports.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      relevant tests and `cargo xtask check`. Visually smoke through
      `npm run dev` with the existing toggle, save paired Light/Dark screenshots
      under `.context/` for the overview, Auto, light-only, side-by-side and
      flow screens in both viewports, and include regenerated output.
- [x] After checks pass, `git add -A`, commit and push this branch. Then review
      the complete diff against `origin/main` with
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md),
      report findings without automatic fixes, and stop for the user's mockup
      review before Milestone 2C.

Delivered: every appearance artboard now draws one scheme control, the
registered `chrome/appearance-selector` in its top bar, and its depicted screen
header carries the viewport control alone. `controls/view-controls` gained an
optional scheme control so the legacy Browse, Changes and component artboards
keep the theme icon they already depict. The shared scaffold derives each
preview from the rendered scheme: Welcome, the comparison panes and the flow's
first step are dark in the Dark render, while the light-only Details subject
keeps its light frames and names that fallback only under Dark. The Auto
artboard reads Auto in both renders. `design-appearance-light-preview` and
`design-appearance-dark-preview` are removed and the appearance navigation
states no longer carry `schemeLinks`, leaving 81 design screens.

## Milestone 2C: Align the legacy scheme depictions (complete)

Tags: mockup

`design-browse-dark-scheme`, `design-browse-light-only`,
`design-review-dark-scheme` and the component explorer's toolbar Dark mode
switch depict the head-band and workspace preview controls that the standalone
runtime drops. Align them with the single-control model after the user has
reviewed Milestone 2B, so every mockup matches the target before UI work.
The recommended shape is consolidation: the canonical Welcome, Details and
changed Welcome screens render in both schemes like the appearance entries,
which subsumes the three legacy scheme screens.

- [x] Confirm with the user whether the three legacy scheme screens are
      consolidated into dual-scheme renders of `design-browse-screen`,
      `design-browse-details-screen` and `design-review-changed`, or kept as
      explicit embedded-viewer depictions. Record the decision here and in the
      shell-design and design-links contracts before changing entries.

Decision, 2026-09-19: consolidate. The user approved removing
`design-browse-dark-scheme`, `design-browse-light-only` and
`design-review-dark-scheme` — the only routes this plan removes from
`origin/main` — because the canonical Welcome, Details and changed Welcome
screens now render in both schemes and subsume them. The user also approved
removing the component explorer's depicted Dark mode switch in the same
milestone. No design artboard depicts a scheme control after this milestone, so
`controls/view-controls` loses its scheme control and the design catalogue has
no authored scheme pairs.

- [x] Apply the decision: update or remove the entries, their `DESTINATIONS`,
      navigation states, the MiniWelcome/MiniDetails scheme-dependent links,
      inventories and the design-links pair table. Preserve every route on
      `origin/main` unless the user approves its removal.
- [x] Remove the depicted Dark mode switch from the component explorer toolbar
      depictions and from the `controls/view-controls` samples that show it,
      and update the component design contracts accordingly.
- [x] Add or update inventory, link and both-scheme tests; run the example
      build and check, relevant tests and `cargo xtask check`; smoke through
      `npm run dev`; commit and push; then review with
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      against `origin/main` and report findings without fixing them.

Delivered: `design-browse-screen`, `design-browse-details-screen` and
`design-review-changed` now render in both schemes, so the existing preview
toggle shows the selected Welcome, the light-only Details subject and the
side-by-side compare under either appearance at their own routes.
`design-browse-dark-scheme`, `design-browse-light-only` and
`design-review-dark-scheme` are removed with them. `controls/view-controls` has
no scheme control at all, the component explorer's depicted Dark mode switch is
gone and its preview caption now names the artboard's own scheme, leaving 78
design screens, 63 saved variants and no authored scheme link pairs.

## Milestone 2D: Draw the Appearance control on every top bar (complete)

Tags: mockup

Milestone 2B introduced the Appearance selector as an opt-in prop that only the
appearance group passes, so 83 artboards draw a top bar but 13 draw the control.
Standalone Browse always holds one Appearance control, so the depicted top bar
component should own it instead of each screen opting in.

- [x] Add a test that every design artboard drawing a top bar draws exactly one
      Appearance control, and confirm it fails on the 70 artboards that do not.
- [x] Make `chrome/top-bar` own the control: require its `appearance` prop,
      always render the selector, and default the value in the shared `TopBar`
      to the scheme the artboard was rendered for. Keep `Shell`'s
      `appearanceChoice` as the override the Auto artboard uses, and drop the
      now-redundant explicit values and `top-bar` `appearance` variant.
- [x] Update the shell design, design links, design component library and
      component design contracts, plus `examples/basic/README.md`, the library
      README and any counts the change moves.
- [x] Run the example build and check, unit and browser tests, and
      `cargo xtask check`; smoke both viewports through `npm run dev`,
      including a narrow top bar and a component-explorer artboard.
- [x] Commit and push, then review with
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      against `origin/main` and report findings without fixing them.

Delivered: `chrome/top-bar` requires its `appearance` prop and always composes
the selector, and the shared `TopBar` defaults the value to the scheme the file
was rendered for. All 83 artboards with a top bar now draw exactly one
Appearance control, up from 13; `Shell`'s `appearanceChoice` remains only as the
override the Auto artboard uses. The `top-bar` `appearance` sample became
`auto-appearance`, since every other sample now depicts the control too.

## Milestone 2E: Fix the mockup review findings (complete)

Tags: mockup

The post-push reviews of Milestones 2B, 2C and 2D left findings the user
chose to fix before runtime work. All of them are mockup authoring, tests or
design documentation; none changes the viewer package.

- [x] Make `design-changes-current`, `design-changes-overlay` and
      `design-review-difference` dual-scheme like `design-review-changed`, so
      every comparison-mode link out of the dark changed artboard resolves to
      a dark fragment. Add the invariant to `tests/design_links.test.ts`: a
      link out of a dark fragment resolves to the target's dark fragment when
      one exists, and no dual-scheme screen links into a light-only sibling in
      its own comparison family. Update the inventories and design-links copy.
- [x] Let the registered `chrome/top-bar` sample default its `appearance` to
      the render context's scheme when a fixture omits it, so the dark gallery
      samples read Dark. Keep the explicit `auto-appearance` sample. Record the
      rule once in the design component library contract: a dual-scheme sample
      derives the props whose subject is the scheme from its render context.
- [x] Export the dual-scheme sample set from
      `examples/basic/entries/design/library/metadata.ts` and use it in
      `tests/design_library_inventory.test.ts` and
      `tests/design_appearance_variants.test.ts` instead of restating it.
- [x] Replace the comparison-band probe in
      `tests/browser/design_comparison_eligibility.spec.ts` with the expected
      surface colour per scheme from `tests/helpers/design_palette.ts`.
- [x] Add a comment to `tests/fixtures/design-library/screens.json`'s test
      stating that baseline entries may only be removed with recorded user
      approval, naming this plan as the precedent for the three removed routes.
- [x] Replace the stale counts in `docs/protocol/mokly-design-components.md`'s
      Delivery Status with a pointer to the generated manifest as the source
      of screen, fragment, component and variant counts.
- [x] Extract the scheme branch of `view-controls.view.tsx` into a small
      sub-component if any nested ternary remains after Milestone 2C; skip if
      the file already reads as one decision per expression.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      the design unit and browser suites and `cargo xtask check`; smoke the
      dark changed artboard's comparison links and the top-bar gallery through
      `npm run dev`, save screenshots under `.context/` prefixed `m2e-`, and
      include regenerated output.
- [x] After checks pass, `git add -A`, commit and push; then review the
      complete diff against `origin/main` with
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      and report findings without fixing them.

Delivered: the Welcome comparison family — `design-changes-current`,
`design-changes-overlay`, `design-review-changed` and
`design-review-difference` — is dual-scheme, so every comparison-mode link out
of the dark changed artboard lands on a dark document. `tests/design_links.test.ts`
now asserts both invariants. The `top-bar` sample falls back to the render
context's scheme, so its dark gallery samples read Dark, and
`DUAL_SCHEME_SAMPLES` is exported from `library/metadata.ts` for both tests.
The comparison-band spec asserts the concrete surface colour per scheme from
`design_palette.ts` and now visits dark fragments too. The baseline fixture
carries its removal rule, and `mokly-design-components.md` points at the
generated manifest instead of restating counts. `view-controls.view.tsx` needed
no change: Milestone 2C left one decision per expression and no nested ternary.

## Milestone 2F: Merge main and stabilise the gate (complete)

Bring the branch up to date with `origin/main` before runtime work, and stop
the pre-existing Node crash from turning green gates red. Nothing here changes
product behaviour.

- [x] Fetch `origin/main`, capture the branch tip, and audit main's additions
      since the merge base as `AGENTS.md` requires. Merge `origin/main` into
      this branch (no rebase; the branch is shared) and resolve every conflict
      path by path, keeping main's inspector CSS fix, `xtask/src/check.rs`
      changes and the verification scripts. Regenerate the example catalogue
      if generated output conflicts; never hand-merge generated HTML.
- [x] Reproduce the intermittent Node fatal error (a V8 `ToLocalChecked`
      crash during CommonJS export pre-parsing) in
      `tests/watch_resource_boundaries.test.ts` under the CI Node version
      (22.14.0) and the local Node 24. Identify the CommonJS import the CJS
      lexer trips on, and fix it at the source: convert or preload the
      offending module so the test runner never exercises the crashing path.
      Do not add a retry loop. If the crash proves to be a Node bug with no
      source-level fix, pin the CI and local Node version to one that does not
      crash and document the reason in `docs/protocol/ci-verification.md`.
- [x] Close the three findings from the Milestone 2E review: add one
      sentence to `docs/protocol/mokly-design-links.md` stating that the
      depicted dark set is representative and the runtime's single preference,
      not per-screen dark renders, keeps a whole session dark; export the
      comparison families from `parts/navigation_states.ts` (the existing
      `welcomeModes` and `appearanceModes` records) and derive the
      `COMPARISON_FAMILIES` list in `tests/design_links.test.ts` from them;
      extract the per-fragment body of
      `tests/browser/design_comparison_eligibility.spec.ts` into one local
      function that labels every assertion with the fragment.
- [x] Stabilise the component-design browser check surfaced by the merged full
      gate: wait for one selected canvas, then assert the disabled action
      through its viewport-labelled preview instead of a transient global
      `:visible` selector.
- [x] Keep the public install and CI guides aligned with the safe Node 24 lane
      while preserving their reader-facing copy and version-literal contracts.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      `npm test`, the browser suite and `cargo xtask check` on the merged
      branch; run the watch resource test ten times in a row to confirm it no
      longer crashes.
- [x] Confirm `git diff --diff-filter=D --name-status <merge-base>..HEAD`
      lists only the approved removals, then `git add -A`, commit and push;
      then review the complete diff against `origin/main` with
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      and report findings without fixing them.

## Milestone 2G: Align control boundaries and mockup copy (complete)

Tags: mockup

The Milestone 2F review found two mockup defects: hover, selected and checked
control boundaries use `--mbk-accent-edge`, which the palette contract does
not allow for control boundaries and which reaches only 1.46:1 in Light, and
several descriptions still describe the superseded independent-preview model.

- [x] Make the Appearance selector hover, the checked or hovered view
      controls and the selected inspector tab draw their boundary with an
      approved control token, `--chrome-control-edge` or `--mbk-sage-deep`,
      in the authored design styles, and regenerate the outputs. Do not weaken
      the 3:1 rule; if a boundary is genuinely decorative because the state
      has another 3:1 indicator, record that exception in the palette
      contract instead.
- [x] Extend `tests/design_appearance.test.ts` to audit the token pairs the
      hover, selected, checked and focus states actually use in the generated
      library styles, so a control that adopts a sub-3:1 boundary fails.
- [x] Align the copy with the single-control model: the Appearance collection
      descriptions in `browse/appearance/index.tsx`, the side-by-side and
      difference rationales in `workspaces/screens.tsx`, item 16 of
      `docs/protocol/mokly-design-component-library.md`, and any other
      description that says appearance leaves previews unchanged. Keep
      independence wording only for embedded viewer inputs and genuine
      light-only fallbacks.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      the design unit and browser suites and `cargo xtask check`. Smoke the
      changed controls in both schemes through `npm run dev`, save screenshots
      under `.context/` prefixed `m2g-`, and include regenerated output.
- [x] Commit and push, then review the complete diff against `origin/main`
      with
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      and report findings without fixing them.

Delivered: the Appearance selector hover, the hovered or checked view controls
and the selected inspector tab draw their boundary with `--mbk-sage-deep`,
which reaches 7.08:1 in Light and 8.79:1 in Dark on the accent surface they
fill. `--chrome-control-edge` was not usable there: it reaches only 2.99:1 on
`--mbk-accent-surface`, so the palette contract now names `--mbk-sage-deep` as
the token a state boundary uses and records the new pair. The Added, Changed
and Removed status badges keep their tinted outlines as a recorded exception,
because each names its own state in 5.62:1 or better text inside a distinct
fill; `tests/design_appearance.test.ts` audits every state rule in the
generated library styles against that exception list, so a new control with a
sub-3:1 boundary fails. The Appearance collection descriptions, the
side-by-side and difference rationales and item 16 of the component library
contract now describe one setting taking the chrome and the screens together;
independence wording survives only for embedded viewer inputs and the
light-only fallback.

## Milestone 2H: Correct the Node compatibility policy

The upstream fix for the CommonJS lexer crash (`cjs_lexer::Parse` handling an
empty `MaybeLocal`, nodejs/node#63885) shipped in Node 24.19.0, so the
affected releases are 24.14.0 through 24.18.x. Milestone 2F excluded 24.19
and 24.20 as well, and the CLI preflight still accepts the affected releases.

- [ ] Set the supported range to exclude exactly 24.14.0 through 24.18.x in
      `package.json` `engines`, `docs/protocol/ci-verification.md`, the
      install guide and the release and package docs, citing the upstream fix.
      Keep the CI lanes on 22.14.0 and 24.21.0.
- [ ] Enforce the same range in a minimal CLI bootstrap that runs before other
      modules load, and add a test that the CLI check, `engines` and the CI
      runtime list agree.
- [ ] If the sandbox still runs an affected Node release, install the pinned
      24.21.0 release for local gates so they match CI, and record the
      requirement in the developer setup docs.
- [ ] Run `npm run build`, `npm test`, the browser suite and
      `cargo xtask check`; commit and push; then review the complete diff
      against `origin/main` with
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      and report findings without fixing them.

## Milestone 3: Implement shared viewer appearance

Tags: ui

Deliver complete embedded appearance and shared system-aware styling. Standalone
manual preference controls are connected after the asset-delivery milestone.
Commit and push after the checks pass, then review the complete diff against
`origin/main` with `docs/implementation-review-prompt.md` and report findings
without fixing them, as every milestone in this plan does.

- [ ] Add the public `ViewerTheme` type and `theme` prop to React/server entry
      types and examples. Apply theme data on every ready/loading/error root and
      in the first-party server-rendered envelope, without remounting islands.
- [ ] Add focused tests for accepted preferences, bad stored values, unavailable
      storage and repeated initialization/cleanup. Keep storage access separate
      from pure normalization and out of embedded React initialization.
- [ ] Implement and fixture-test the standalone startup entry and preference
      helper. Resolve the effective appearance in the documented order,
      including the `scheme` URL pin and live system changes under Auto, and
      apply it to the root and the existing frame scheme swap before paint or
      as early as each frame's first load allows, at most once. Guard it to
      opted-in standalone documents and bind opted-in Appearance controls when
      the DOM is ready. Do not reference an undelivered asset from markup.
- [ ] Implement one package-owned semantic palette from
      [the recorded swatches](../docs/protocol/mokly-viewer-palette.md),
      including its three Light corrections, and replace theme-dependent
      literals in shell CSS, embedded extensions and viewer-owned overlays.
      Add a focused color-literal rule and token-pair contrast tests to prevent
      the same class of missing-theme styles from recurring.
- [ ] Update stylesheet scoping and scheme-aware accent fallbacks. Verify host
      and slot boundaries, inherited overrides, multiple roots, focus, status,
      tooltips, native controls and forced-color behavior in both appearances.
- [ ] Rename the embedded preview controls' accessible names and tooltips to
      Preview color scheme or Dark preview in `shell/head.tsx`,
      `shell/workspace_controls.tsx` and their tests. Keep them rendering in
      embedded roots with existing eligibility, URL semantics and light-only
      fallback; their standalone removal is Milestone 5.
- [ ] Set effective preview `color-scheme` on every frame before loading it.
      Separate device-screen indicators from shell ink and preserve comparison
      canvases/compositing across appearance changes, including dynamic frames.
- [ ] Use CSS for live Auto changes and test explicit theme-prop overrides.
- [ ] Add regression coverage proving appearance changes preserve frame/session
      identity, props, focus/scroll, picking/highlights/markers and comparison
      state with no new preview/comparison requests or selection/pick events.
- [ ] Run focused React/SSR, shell, client, frame-adapter and browser suites.
      If a new design gap appears, schedule a new tagged mockup milestone before
      implementing its affected UI; keep existing mockups aligned.

## Milestone 4: Deliver the standalone startup asset

Expose the tested startup asset through Serve and export. Existing pages remain
usable while the next UI milestone connects the manual preference control.
Commit and push after the checks pass, then review the complete diff against
`origin/main` with `docs/implementation-review-prompt.md` and report findings
without fixing them.

- [ ] Bundle the classic startup entry in `packages/viewer/scripts/build.mjs`.
      Update the explicit server module allowlist and export/preview asset
      inventories, without adding a new HTTP API or changing catalogue schemas.
- [ ] Test asset serving and export root/subpath URL portability. Confirm that
      the packaged startup asset has no imports requiring React, Node or the CLI,
      and needs no inline-script exception or additional sandbox permissions.
- [ ] Build both packages and run focused asset/export/package-boundary tests;
      the new asset must exist and be deliverable before markup references it.

## Milestone 5: Connect standalone appearance controls

Tags: ui

Complete the standalone experience: one Appearance control that sets the
interface and the previews together, with the same palette and tested
preference behavior as the shared viewer, early restoration and recovery.
Commit and push after the checks pass, then review the complete diff against
`origin/main` with `docs/implementation-review-prompt.md` and report findings
without fixing them.

- [ ] Implement the standalone Appearance selector from the shared control
      composition. Add the opt-in startup hook and script before the stylesheet
      in `shell/document.tsx`; render the selector in every standalone
      document, including light-only catalogues; keep embedded hosts' own
      controls separate.
- [ ] Make the selector drive both the root theme and the existing preview
      scheme application: the document mark, screen and flow frame swaps,
      component samples, comparison frames, fallback captions and recovery
      state. Remove the standalone top-bar and head-band scheme switch and the
      workspace Dark mode button with their placement CSS, drop the clamp that
      depends on a scheme control existing, and update the Browse client tests
      and the shared browser helpers.
- [ ] Apply the startup precedence: `scheme` URL pin, then stored override,
      then initial theme, then Auto; a user selection wins for the document's
      lifetime; Auto follows live system changes and re-applies the preview
      scheme. Keep light-only catalogues caption-free under Dark.
- [ ] Keep Appearance reachable on home, unavailable and light-only catalogues
      at mobile and desktop widths, without obscuring search or menu access.
- [ ] Preserve appearance through navigation, evidence refresh and watched
      recovery. Exercise storage failures without losing the current choice;
      hide the manual selector until initialized and retain CSS with JavaScript
      off, where frames keep their server-rendered light sources.
- [ ] Verify pin/saved/initial/Auto precedence, full reload, live system
      changes, explicit overrides, keyboard control, early paint and at most
      one first-load frame swap against Serve and a static export. Update the
      runtime and shell-design Color Scheme sections to the shipped behavior
      and run the relevant shell, navigation and export browser suites.

## Milestone 6: Verify, commit, push and review

Deliver a tested change with accurate documentation and a complete review diff.

- [ ] Run the appearance matrix in `tests/browser`. Standalone: Auto, Light,
      Dark and a `scheme` pin against mixed and light-only catalogues at
      mobile/desktop widths, including component samples and comparisons.
      Embedded: Light/Dark theme × Light/Dark preview, Auto and explicit
      overrides, same-origin/postMessage frames, two roots, SSR,
      loading/error/retry, native controls and active inspection.
- [ ] Smoke the running server via `npm run dev`, including watched/full reloads,
      navigation, Props and each comparison mode. Smoke exports hosted at root
      and subpaths, slow startup/first paint, storage denial and JavaScript off.
      Save screenshots under `.context/` and inspect the rendered result.
- [ ] Exercise clean packed React and SSR consumers using the existing package
      smoke workflow; confirm explicit Light retains the established layout and
      approved colors, and embedded preview output stays independent of theme.
- [ ] Update delivered API examples and current-status wording in the package
      and workspace READMEs, viewer/runtime/shell protocols and example docs.
      Keep the three public accent overrides documented. Prepare the plan-index
      completion transition for the implementation PR's merge.
- [ ] Run `npm run build`, `npm run example:build`, `npm run example:check` and
      relevant focused tests, then `cargo xtask check`. Require all checks to
      pass; record any real environment blocker and checks already completed.
- [ ] After checks pass, inspect the complete diff and generated output against
      `origin/main`; run `git add -A`, commit using Conventional Commits with a
      title of at most 50 characters, and push the current branch. Include all
      newly created files and regenerated artifacts in the commit and push.
- [ ] Only after the push, use
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`, including staged,
      unstaged and untracked files. Report numbered findings with severity,
      feature context, impact, lettered solution options and a recommended
      scope. Do not change the implementation or automatically fix findings.
