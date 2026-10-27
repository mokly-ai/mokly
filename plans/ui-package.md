# Shared UI Package

Status: Active. On branch `calummoore/viewer-library-design`, no pull request yet.
The plan closes when its PR merges.

`@mokly/viewer` renders the Browse shell. Its `src/shell` directory holds
193 files: store-coupled containers, presentational components, and the
shell stylesheet as 25 TypeScript string constants, concatenated in a fixed
order and rewritten by a build-time selector transform for embedding. On
`main` at `a9dd1e81`, 34 of the 66 shell component files read no store and
no context. The design mockups under `examples/basic/specs/design/library`
re-implement the same chrome by hand: the top bar, the appearance selector,
the catalogue navigation, and the screen header each have a second markup
file and a second stylesheet there, with browser specs that keep the two
copies in step. Nothing stops a presentational component from importing the
store, and nothing shares one implementation between the product and its
mockups.

This plan adds the `@mokly/ui` workspace package under `packages/ui`: the
shell's presentational components with their stylesheets as real CSS files.
A package component takes props and callbacks only. It has no store, no
context, no fetch, no history, no frame access, and no catalogue read model
type. The viewer depends on the package at the exact shared version and
bundles its CSS into `shell.css` and `styles.css`, so hosts and deliveries
import one stylesheet as before. The design library renders a registered
component through the package where the package provides it. The plan moves
the first slice: the icons, the change mark, the appearance selector, and
the comparison toolbar. The remaining presentational components move in later
plans, one slice each. The embedded selector transform, the shell tokens, and
the store design stay as they are.

Decision 1 (2026-10-27, the user): a separate npm package, and the design
library renders the package components with the package CSS. Rejected: a
directory in the viewer with an import lint, because only a package boundary
stops a relative import of the viewer internals at the resolver. Rejected:
keeping the design library's own copies, because two implementations need
tests to stay aligned and still drift. Reason: one implementation serves the
product and its mockups, and the mockup copies and their stylesheets go away.

Decision 3 (2026-10-27, the user): the DOM test tier is option A,
`happy-dom` and `@testing-library/react` as root dev dependencies. Rejected:
B, `jsdom` with Testing Library, because it is slower and heavier with the
same gaps. Rejected: C, no DOM tier, because every interaction regression in
a package component would then need a browser spec. Reason: the package holds
exactly the components that a DOM in Node can test, and happy-dom is the
fastest such DOM.

Decision 4 (2026-10-27, the user): the boundary lints are option A, rules in
the existing ESLint configuration with no new dependency. In a workspace every
package is symlinked into the root `node_modules`, so an undeclared import of
`@mokly/viewer` from the package resolves and typechecks, and a relative
import into the viewer source fails only at build time. The lints close both
gaps at edit time. Rejected: B, `dependency-cruiser`, because its extra value,
whole-graph cycle checks, layer rules at scale, and a graph output, belongs to
the later layer work, and it costs a dependency, its own resolution config,
and its own gate command. Rejected: C, convention only, because the isolation
that motivates the package would erode on the first convenient import.
Reason: `eslint-plugin-import-x` is installed and already has every rule the
boundary needs.

Decision 5 (2026-10-27, the user): file names in `packages/ui` are option A,
kebab-case such as `top-bar.tsx`, which exports `TopBar`. Rejected: B,
PascalCase, because a case-only rename is invisible to Git on a default macOS
disk and then fails on Linux. Rejected: C, snake_case like the rest of the
repository, because the subpath exports, the CSS file beside each component,
and the design library the package replaces all use kebab-case. Reason: the
file name matches the published subpath, and a lint holds the convention.

Open decisions, asked on 2026-10-27. The plan uses the recommended option in
each TODO and names the TODO that another answer changes.

- Decision 2: the package name. A `@mokly/ui`. B `@mokly/viewer-ui`.
  C `@mokly/components`. Recommended A.
- Decision 6: the cascade layer. A package rules in `@layer mokly.components`,
  so an unlayered host rule or shell layout rule wins without specificity
  games. B unlayered rules at a fixed position in the concatenation, as today.
  Recommended A. B removes the layer TODO of milestone 3 and the appearance
  contract TODO of milestone 1.

Evidence goes under `.context/ui-package/`.

Contract owners:

- [Embeddable viewer contract](../docs/protocol/mokly-viewer.md), the
  package set and the package boundary.
- [Viewer appearance](../docs/protocol/mokly-viewer-appearance.md), the host
  stylesheet precedence.
- [Design components](../docs/protocol/mokly-design-components.md), the
  source ownership of the design library.
- [npm release](../docs/protocol/npm-release.md), the package set and the
  publication order.
- [Developer test commands](../docs/protocol/developer-test-commands.md) and
  [CI test timing](../docs/protocol/ci-test-timing.md), the test roots.
- [Package boundary](../docs/architecture/package-boundary.md).
- The [viewer README](../packages/viewer/README.md), the
  [shell README](../packages/viewer/src/shell/README.md), the new
  `packages/ui/README.md`, and the
  [design library README](../examples/basic/specs/design/library/README.md).

## Milestone 1: Documentation and protocol

State the package, its boundary, and decision 1, so that the review can
check the code against them.

- [ ] Update the Package And Props section of `docs/protocol/mokly-viewer.md`:
      `@mokly/ui` holds presentational shell components and their
      stylesheets. A package component takes props and callbacks only, with
      React as its only peer. It reads no store, no catalogue read model
      type, no network, no history, and no frame. The viewer depends on it at
      the exact shared version and bundles its CSS, so `shell.css` and
      `styles.css` stay the only stylesheets a delivery or a host loads.
      Record decision 1 next to the rule.
- [ ] Update `docs/protocol/mokly-viewer-appearance.md`: package component
      rules sit in the `mokly.components` cascade layer, and an unlayered
      host rule wins over them. Decision 6, option A.
- [ ] Update the Viewer Package Boundary of
      `docs/architecture/package-boundary.md`: the UI package component, its
      responsibility, and the dependency direction CLI, viewer, UI package.
- [ ] Update `docs/protocol/npm-release.md`: the package set includes
      `@mokly/ui`, and the publication order is the platform packages, the UI
      package, the viewer, then the CLI.
- [ ] Update the Scope and the Catalogue And Source Ownership sections of
      `docs/protocol/mokly-design-components.md`: an inventory component that
      the UI package provides renders the package component through its
      `defineComponent` registration, and its public stylesheet is the
      package stylesheet. The `design-library/G/S.css` rule applies to the
      other components. Record decision 1 next to the rule.
- [ ] Update `docs/protocol/developer-test-commands.md` and
      `docs/protocol/ci-test-timing.md`: the Node test roots include
      `packages/ui/tests/`.
- [ ] Update `AGENTS.md`: the package list, the test roots, the build order,
      the Product section, and the kebab-case file name rule of
      `packages/ui` from decision 5.
- [ ] Write `packages/ui/README.md` with the sections of the documentation
      skill: Responsibilities, What This Package Does, Quick Start,
      Development, Key Code, Related Docs. Update the Responsibilities,
      Development, and Key Code sections of `packages/viewer/README.md`, the
      moved-component paragraphs of `packages/viewer/src/shell/README.md`,
      and the scope sentence of
      `examples/basic/specs/design/library/README.md`.
- [ ] Confirm that `docs/protocol/mokly-imported-styles.md` already covers a
      package stylesheet under `node_modules/@mokly/ui/`. Change it only if
      the workspace symlink needs a rule.

## Milestone 2: Package skeleton and tooling

Create the package and wire it into the build, the checks, the tests, and
the release, with no component in it yet. The product does not change.

- [ ] Create `packages/ui`: `package.json` with the name of decision 2,
      `type: module`, React and React DOM `>=19.0.0` peers,
      `sideEffects: ["*.css"]`, `files: ["dist", ...]`, and an `exports` map
      with one subpath per component plus `./styles.css`. No index file: the
      TypeScript skill allows a barrel only as a package entry, and subpaths
      make it unnecessary.
  - [ ] `tsconfig.json` and `tsconfig.build.json` like the viewer's.
  - [ ] `scripts/build.mjs`: `tsc`, copy each component's CSS beside its
        JavaScript, and write `dist/styles.css` from every component CSS in
        alphabetical order.
  - [ ] `build`, `typecheck`, and `test` scripts like the viewer's.
- [ ] Wire the root: `workspaces` with `packages/ui` first, `npm run build`
      in the order UI package, viewer, CLI, `typecheck`, and the workspace
      builds in `xtask/src/check/commands.rs` in the same order.
- [ ] Wire the release: `release-please-config.json` extra files for the
      package version, the viewer's pin, and the lockfile paths, and the
      package set of `scripts/release/versions.mjs`, `manifest.mjs`,
      `targets.mjs`, the smoke scripts, and `.github/workflows/ci.yml`.
- [ ] Add `@mokly/ui` to the viewer's `dependencies` at the exact shared
      version. Extend `packages/viewer/scripts/build.mjs` to read the package
      `styles.css` and include it in `shell.css` and in the embedded
      `styles.css`. Add the case to the existing styles test: the embedded
      transform wraps a `@layer` block in `@scope` unchanged.
- [ ] Add the boundary lints of decision 4 to `eslint.config.js`:
  - [ ] `import-x/no-extraneous-dependencies` for `packages/ui/src` with
        `packageDir` set to the package, so a component imports only what
        `packages/ui/package.json` declares: `react` and `react-dom`. This
        is the rule that the workspace symlinks make necessary.
  - [ ] `import-x/no-relative-packages` for `packages/ui` and
        `packages/viewer`, so neither package reaches the other by a
        relative path.
  - [ ] `import-x/no-restricted-paths` for `packages/viewer` with a zone
        that forbids `packages/ui/src`, beside the `exports` map that already
        limits the viewer to the published subpaths.
  - [ ] A local rule under `scripts/eslint/`, like the four rules there,
        that requires kebab-case file names under `packages/ui/src` and
        `packages/ui/tests` (decision 5). Cover each rule with a case in
        the ESLint rule tests, as the timing lint does.
- [ ] Add the DOM test tier of decision 3: install `happy-dom` and
      `@testing-library/react` as root dev dependencies with `npm install`,
      so that the manifest and the lockfile change together. Add
      `packages/ui/tests/dom.ts`, which registers one happy-dom window per
      test process and sets `IS_REACT_ACT_ENVIRONMENT`, and the
      `packages/ui/tests` root in `scripts/verification/evidence.mjs`. Each
      DOM test imports `dom.ts` first. The dependency audit passes.
- [ ] Check: `npm run build`, `npm run typecheck`,
      `cargo xtask check --suite repository`, and `npm run package:smoke`,
      which must install the new package into its consumer. Save the output
      under `.context/ui-package/skeleton/`.

## Milestone 3: First components

Tags: ui

Move the icons, the change mark, the appearance selector, and the comparison
toolbar with their CSS. Markup and class names do not change, so the viewer's
string-rendered tests and the browser specs keep passing. The screens do not
change, and the approved artboards stay the reference, so no mockup precedes
this milestone. Milestone 4 adopts the package components in the mockups
after they exist.

- [ ] `icons`: move `IconSvg`, `ChevronIcon`, and the glyphs of
      `src/shell/icons.tsx` and `src/shell/workspace_icons.tsx` to
      `packages/ui/src/icons/icons.tsx`, exported as `@mokly/ui/icons`. The
      viewer imports them from there.
- [ ] `change-mark`: move `src/shell/view_changed_mark.tsx` to
      `packages/ui/src/change-mark/change-mark.tsx` with the ids and the
      wording it reads from `src/shell/view_marks.ts`. The appearance
      selector renders it.
- [ ] `appearance-selector`: move `src/shell/appearance.tsx` to
      `packages/ui/src/appearance-selector/appearance-selector.tsx`. The two
      context reads become props: the id prefix, today from
      `useShellIdentifier`, and the changed-views mark, today from
      `useActiveWorkspace`. The viewer keeps `appearance.tsx` as the wrapper
      that reads both contexts and renders the package component. Move the
      `.mbk-appearance` rules from `src/shell/css_nav_search.ts` to
      `appearance-selector.css`.
- [ ] `comparison-toolbar`: move `src/shell/comparison_toolbar.tsx` to
      `packages/ui/src/comparison-toolbar/comparison-toolbar.tsx`. The
      package declares its own `ComparisonMode` union, and the viewer's
      `use_comparison.ts` type narrows to it. Move the `.mbk-diff-toolbar`
      rules from `src/shell/css_review.ts` to `comparison-toolbar.css`.
- [ ] Cascade layer (decision 6): each package stylesheet declares its rules
      in `@layer mokly.components`. The viewer's `css_tokens.ts` declares the
      layer order first, so the layer exists before any unlayered shell rule.
- [ ] Tests in `packages/ui/tests` with Testing Library: the appearance menu
      opens, selects, closes on Escape, and reports the choice through its
      callback, with the roles and names the shell specs query; the toolbar
      mode group, the Scroll together switch, and Refresh report through
      their callbacks. Move the viewer tests that cover only the moved markup.
      Keep every assertion.
- [ ] Check: `npm run build`, the targeted viewer tests, the browser specs
      `tests/browser/browse_appearance_navigation.spec.ts`,
      `tests/browser/design_appearance_toggle.spec.ts`, and the comparison
      toolbar specs, then the mockup check command of `AGENTS.md`, because
      the shell stylesheet changed. Smoke test through `npm run dev`: the
      Appearance control and the comparison toolbar in Light and Dark, in the
      standalone shell and in the embedded fixture. Save screenshots under
      `.context/ui-package/components/`.

## Milestone 4: Design library adoption

Tags: mockup

The design library renders the two registered components through the
package and drops its own copies. Decision 1 approves the deletions.

- [ ] `chrome/appearance-selector`: `appearance-selector.view.tsx` renders
      `@mokly/ui/appearance-selector`. Delete the hand-written markup and
      `examples/basic/design-library/chrome/appearance-selector.css`. The
      component's `stylesheets` field names the package stylesheet by its
      dependency path under the imported-styles contract. Delete the icons in
      `specs/design/parts/icons.tsx` that only this view used, and record the
      search.
- [ ] `controls/comparison-toolbar`: the same for its view file and its
      stylesheet.
- [ ] `tests/design_boundaries.test.ts` and `tests/helpers/design_styles.ts`:
      the audited boundaries of the adopted components read the package CSS.
- [ ] The design browser specs keep passing. Replace an assertion that only
      compared the mockup copy with the shell control by one against the
      shared implementation.
- [ ] Mockup check: `npm run build`, then
      `npx mokly build --config examples/basic/mokly.config.json --strict --out ../../.context/example`.
      Smoke test through `npm run dev`: the Shared components pages of both
      components, the Appearance artboards, and the Changes diff-controls
      artboards, in both viewports and both schemes. Save screenshots under
      `.context/ui-package/mockups/`.

## Milestone 5: Verification, commit, review, and pull request

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] After the first release that carries `@mokly/ui`, install
      `@mokly/viewer` into a clean consumer and confirm that `@mokly/ui`
      resolves and that `styles.css` carries the component rules.
- [ ] Later plans, one slice each, in the order of the design library
      inventory: the chrome components, the controls, the inspector
      components, then the preview components. Then the shell tokens as
      `@mokly/ui/tokens.css`. Then remove the embedded selector transform
      once every shell rule is authored under the root class.
