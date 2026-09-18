# Viewer Dark Mode

Status: planned; documentation milestone complete, implementation not started.
The implementation PR's merge is this plan's completion boundary.

Give `@mokly/viewer`, local Serve and static exports a complete Auto/Light/Dark
appearance. The [appearance contract](../docs/protocol/mokly-viewer-appearance.md)
defines the target; [viewer ownership](../docs/protocol/mokly-viewer.md) and
[shell design](../docs/protocol/mokly-shell-design.md) describe the current code.

## Decisions And Scope

- Default viewer appearance to Auto. Keep it independent of preview
  `colorScheme`, which retains its existing default, URLs and fallback behavior.
- Add `theme?: ViewerTheme` to React and server rendering. Embedded hosts own
  the surrounding appearance control and persistence; standalone Browse gets
  an Appearance selector and a saved preference.
- Use one semantic palette for the shared shell and scoped embedded CSS.
  Preserve app independence and the three supported accent overrides.
- Cover navigation, headers, stage, inspector, Props, comparisons, overlays,
  native controls and loading/error states. Pin each frame to its own preview
  scheme, including a light phone's status indicators inside a dark interface.
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

## Milestone 2: Design the complete appearance states

Tags: mockup

Deliver deterministic mobile and desktop mockups for the full target before
changing runtime UI. Existing examples remain usable throughout.

- [ ] Audit the registered components in
      `examples/basic/entries/design/library` and shared shell/workspace helpers.
      Add explicit appearance context and reusable selector composition there.
- [ ] Record Light/Dark semantic swatches and status/control pairs in the
      appearance contract, with contrast calculations; document any necessary
      Light contrast corrections. Keep device-screen tokens independent.
- [ ] Add the Appearance overview and the States, Workspaces and Status pages
      specified in the contract, each with matching source directories, at most
      five owning screens, and distinct mobile/desktop screen components.
- [ ] Reuse existing screen and registered component implementations, retain
      existing scheme destinations, and link new screens from Browse and the
      relevant inspector/comparison contexts. Flows reuse owning screens only.
- [ ] Update design inventories, configured stylesheet ownership, destinations,
      relevant design protocols, `examples/basic/README.md` and library guidance.
      Clarify Appearance versus Preview color scheme in all affected copy.
- [ ] Run `npm run build`, `npm run example:build`, `npm run example:check`
      and relevant design/library tests. Visually smoke changed pages using
      `npm run dev`, in both viewport variants. Keep matching generated output
      tracked and include it in the final commit; never hand-edit generated HTML.

## Milestone 3: Implement shared viewer appearance

Tags: ui

Deliver complete embedded appearance and shared system-aware styling. Standalone
manual preference controls are connected after the asset-delivery milestone.

- [ ] Add the public `ViewerTheme` type and `theme` prop to React/server entry
      types and examples. Apply theme data on every ready/loading/error root and
      in the first-party server-rendered envelope, without remounting islands.
- [ ] Add focused tests for accepted preferences, bad stored values, unavailable
      storage and repeated initialization/cleanup. Keep storage access separate
      from pure normalization and out of embedded React initialization.
- [ ] Implement and fixture-test the standalone startup entry and preference
      helper. Guard it to opted-in standalone documents; restore on the root
      before paint, then bind opted-in Appearance controls when the DOM is ready.
      Do not reference an undelivered asset from production markup.
- [ ] Implement one package-owned semantic palette and replace theme-dependent
      literals in shell CSS, embedded extensions and viewer-owned overlays.
      Add a focused color-literal rule and token-pair contrast tests to prevent
      the same class of missing-theme styles from recurring.
- [ ] Update stylesheet scoping and scheme-aware accent fallbacks. Verify host
      and slot boundaries, inherited overrides, multiple roots, focus, status,
      tooltips, native controls and forced-color behavior in both appearances.
- [ ] Clarify preview-control names in `shell/head.tsx`,
      `shell/workspace_controls.tsx` and matching tests/mockups. Retain existing
      preview eligibility, URL semantics and light-only fallback behavior.
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

Complete the standalone experience with the same palette and tested preference
behavior as the shared viewer, including early restoration and recovery.

- [ ] Implement the standalone Appearance selector from the shared control
      composition. Add the opt-in startup hook and script before the stylesheet
      in `shell/document.tsx`; keep embedded hosts' own controls separate.
- [ ] Keep Appearance reachable on home, unavailable and light-only catalogues
      at mobile and desktop widths, without obscuring search or preview controls.
- [ ] Preserve appearance through navigation, evidence refresh and watched
      recovery. Exercise storage failures without losing the current choice;
      hide the manual selector until initialized and retain CSS with JavaScript off.
- [ ] Verify saved/initial/Auto precedence, full reload, live system changes,
      explicit overrides, keyboard control and early paint against Serve and a
      static export. Run the relevant shell, navigation and export browser suites.

## Milestone 6: Verify, commit, push and review

Deliver a tested change with accurate documentation and a complete review diff.

- [ ] Run the appearance matrix in `tests/browser`: Light/Dark viewer ×
      Light/Dark preview at mobile/desktop widths; Auto and explicit overrides;
      light-only catalogues; same-origin/postMessage frames; two embedded roots;
      SSR, loading/error/retry, native controls and active inspection.
- [ ] Smoke the running server via `npm run dev`, including watched/full reloads,
      navigation, Props and each comparison mode. Smoke exports hosted at root
      and subpaths, slow startup/first paint, storage denial and JavaScript off.
      Save screenshots under `.context/` and inspect the rendered result.
- [ ] Exercise clean packed React and SSR consumers using the existing package
      smoke workflow; confirm explicit Light retains the established layout and
      approved colors, and preview output stays independent of appearance.
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
