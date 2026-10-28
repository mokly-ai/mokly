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

Decision 2 (2026-10-27, the user): the package name is option A, `@mokly/ui`
in the directory `packages/ui`. Rejected: B, `@mokly/viewer-ui`, because it
names the current owner and reads wrong once another package uses it.
Rejected: C, `@mokly/components`, because the catalogue term "components"
means a consumer's registered components. Reason: the name is short and
collides with no product term.

Decision 6 (2026-10-27, the user): package rules sit in the
`mokly.components` cascade layer, option A, so an unlayered host rule or
shell layout rule wins over them without specificity games. Rejected: B,
unlayered rules at a fixed position in the concatenation as today, because
file order would then decide ties between package, shell, and host rules.
Reason: host theming becomes predictable, and the viewer is pre-1.0, so the
precedence change is acceptable.

Open decisions found during milestone 2, asked on 2026-10-27:

- Decision 7: `@mokly/ui` has no npm registration and no trusted publisher,
  so the first release would stop at its publish step. A register it by
  hand at `0.0.0` with its trusted publisher and update `npm-bootstrap.md`.
  B extend the bootstrap scripts to pack a reviewed `@mokly/ui` `0.0.0`
  archive like the native packages and update the doc. Recommended B. The
  registration itself needs a maintainer with npm access and is post-merge.
- Decision 8: the elapsed-time lint of `ci-test-timing.md` is active for
  `tests/` and now `packages/ui/tests/`, but not for `packages/viewer/tests/`,
  which the contract names; the gap predates this plan. A add
  `packages/viewer/tests/**` to the lint, zero findings today. B narrow the
  contract to the covered paths. Recommended A. It widens a lint, so it
  waits for the user.

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

- [x] Update the Package And Props section of `docs/protocol/mokly-viewer.md`:
      `@mokly/ui` holds presentational shell components and their
      stylesheets. A package component takes props and callbacks only, with
      React as its only peer. It reads no store, no catalogue read model
      type, no network, no history, and no frame. The viewer depends on it at
      the exact shared version and bundles its CSS, so `shell.css` and
      `styles.css` stay the only stylesheets a delivery or a host loads.
      Record decision 1 next to the rule.
- [x] Update `docs/protocol/mokly-viewer-appearance.md`: package component
      rules sit in the `mokly.components` cascade layer, and an unlayered
      host rule wins over them. Decision 6, option A. Done on 2026-10-27 in
      the stylesheet paragraph of `docs/protocol/mokly-viewer.md` instead,
      beside the `styles.css` rule, because the appearance contract stands at
      248 lines, two under its cap, and the viewer contract owns the host
      stylesheet rule.
- [x] Update the Viewer Package Boundary of
      `docs/architecture/package-boundary.md`: the UI package component, its
      responsibility, and the dependency direction CLI, viewer, UI package.
- [x] Update `docs/protocol/npm-release.md`: the package set includes
      `@mokly/ui`, and the publication order is the platform packages, the UI
      package, the viewer, then the CLI.
- [x] Update the Scope and the Catalogue And Source Ownership sections of
      `docs/protocol/mokly-design-components.md`: an inventory component that
      the UI package provides renders the package component through its
      `defineComponent` registration, and its public stylesheet is the
      package stylesheet. The `design-library/G/S.css` rule applies to the
      other components. Record decision 1 next to the rule.
- [x] Update `docs/protocol/developer-test-commands.md` and
      `docs/protocol/ci-test-timing.md`: the Node test roots include
      `packages/ui/tests/`. Also `docs/protocol/ci-verification.md`, which
      names the strict discovery roots.
- [x] Update `docs/protocol/npm-release-management.md` and
      `docs/protocol/npm-release-operations.md`: the eight-package set and
      the publication order, found while editing the release contract.
- [x] Update `AGENTS.md`: the package list, the test roots, the build order,
      the Product section, and the kebab-case file name rule of
      `packages/ui` from decision 5.
- [x] Write `packages/ui/README.md` with the sections of the documentation
      skill: Responsibilities, What This Package Does, Quick Start,
      Development, Key Code, Related Docs. Update the Responsibilities,
      Development, and Key Code sections of `packages/viewer/README.md`, the
      moved-component paragraphs of `packages/viewer/src/shell/README.md`,
      and the scope sentence of
      `examples/basic/specs/design/library/README.md`. The Key Code entries
      of the new README and the viewer README name the package files as
      code spans until milestone 3 creates them, so the link test stays
      green at each milestone end.
- [x] Add the repository's status line to each touched protocol,
      architecture, and README page except `ci-test-timing.md`, which
      already carries the Rust rebuild plan's line. Milestone 5 removes them.
- [x] Confirm that `docs/protocol/mokly-imported-styles.md` already covers a
      package stylesheet under `node_modules/@mokly/ui/`. Change it only if
      the workspace symlink needs a rule. Confirmed on 2026-10-27: a package
      stylesheet uses its dependency name, a repository package uses the
      side's mapped copy under the sidecar module rules, and the symlink
      policy is shared with the JavaScript graph. No change.

## Milestone 2: Package skeleton and tooling

Create the package and wire it into the build, the checks, the tests, and
the release, with no component in it yet. The product does not change.

- [x] Create `packages/ui`: `package.json` with the name of decision 2,
      `type: module`, React and React DOM `>=19.0.0` peers,
      `sideEffects: ["*.css"]`, `files: ["dist", ...]`, and an `exports` map
      with one subpath per component plus `./styles.css`. No index file: the
      TypeScript skill allows a barrel only as a package entry, and subpaths
      make it unnecessary.
  - [x] `tsconfig.json` and `tsconfig.build.json` like the viewer's.
  - [x] `scripts/build.mjs`: `tsc`, copy each component's CSS beside its
        JavaScript, and write `dist/styles.css` from every component CSS in
        alphabetical order.
  - [x] `build`, `typecheck`, and `test` scripts like the viewer's.
- [x] Wire the root: `workspaces` with `packages/ui` first, `npm run build`
      in the order UI package, viewer, CLI, `typecheck`, and the workspace
      builds in `xtask/src/check/commands.rs` in the same order.
- [x] Wire the release: `release-please-config.json` extra files for the
      package version, the viewer's pin, and the lockfile paths, and the
      package set of `scripts/release/versions.mjs`, `manifest.mjs`,
      `targets.mjs`, the smoke scripts, and `.github/workflows/ci.yml`.
- [x] Add `@mokly/ui` to the viewer's `dependencies` at the exact shared
      version. Extend `packages/viewer/scripts/build.mjs` to read the package
      `styles.css` and include it in `shell.css` and in the embedded
      `styles.css`. Add the case to the existing styles test: the embedded
      transform wraps a `@layer` block in `@scope` unchanged.
- [x] Add the boundary lints of decision 4 to `eslint.config.js`:
  - [x] `import-x/no-extraneous-dependencies` for `packages/ui/src` with
        `packageDir` set to the package, so a component imports only what
        `packages/ui/package.json` declares: `react` and `react-dom`. This
        is the rule that the workspace symlinks make necessary.
  - [x] `import-x/no-relative-packages` for `packages/ui` and
        `packages/viewer`, so neither package reaches the other by a
        relative path.
  - [x] `import-x/no-restricted-paths` for `packages/viewer` with a zone
        that forbids `packages/ui/src`, beside the `exports` map that already
        limits the viewer to the published subpaths.
  - [x] A local rule under `scripts/eslint/`, like the four rules there,
        that requires kebab-case file names under `packages/ui/src` and
        `packages/ui/tests` (decision 5). Cover each rule with a case in
        the ESLint rule tests, as the timing lint does.
- [x] Add the DOM test tier of decision 3: install `happy-dom` and
      `@testing-library/react` as root dev dependencies with `npm install`,
      so that the manifest and the lockfile change together. Add
      `packages/ui/tests/dom.ts`, which registers one happy-dom window per
      test process and sets `IS_REACT_ACT_ENVIRONMENT`, and the
      `packages/ui/tests` root in `scripts/verification/evidence.mjs`. Each
      DOM test imports `dom.ts` first. The dependency audit passes.
- [x] Check: `npm run build`, `npm run typecheck`,
      `cargo xtask check --suite repository`, and `npm run package:smoke`,
      which must install the new package into its consumer. Save the output
      under `.context/ui-package/skeleton/`.
- [x] Done on 2026-10-27 by the delegated Opus 5.5 agent and checked. Its
      choices: `@happy-dom/global-registrator` joins the dev dependencies;
      `tests/dom.ts` also runs Testing Library cleanup after each test,
      because node:test has no global `afterEach`; the root `tsconfig.json`
      includes `packages/ui`; the boundary rules use the import plugin's
      node resolver with a `.js` to `.ts` alias for the two packages;
      `no-relative-packages` exempts the shared `tests/helpers`; the
      kebab-case rule also checks directory names; `css.ts` exports
      `shellCss` and `standaloneShellCss` and the unused
      `STANDALONE_SHELL_CSS` is gone; the CLI prepack builds the UI package
      first; the release smoke checks that `@mokly/ui/styles.css` resolves.
      Three protocol passages that named the old build order and the three
      archives are aligned: `ci-verification-repository.md`,
      `developer-test-commands.md`, and `packed-consumer-smoke.md`. The root
      `README.md` lists the package.

## Milestone 3: First components

Tags: ui

Move the icons, the change mark, the appearance selector, and the comparison
toolbar with their CSS. Markup and class names do not change, so the viewer's
string-rendered tests and the browser specs keep passing. The screens do not
change, and the approved artboards stay the reference, so no mockup precedes
this milestone. Milestone 4 adopts the package components in the mockups
after they exist.

- [x] `icons`: move `IconSvg`, `ChevronIcon`, and the glyphs of
      `src/shell/icons.tsx` and `src/shell/workspace_icons.tsx` to
      `packages/ui/src/icons/icons.tsx`, exported as `@mokly/ui/icons`. The
      viewer imports them from there.
- [x] `change-mark`: move `src/shell/view_changed_mark.tsx` to
      `packages/ui/src/change-mark/change-mark.tsx` with the ids and the
      wording it reads from `src/shell/view_marks.ts`. The appearance
      selector renders it.
- [x] `appearance-selector`: move `src/shell/appearance.tsx` to
      `packages/ui/src/appearance-selector/appearance-selector.tsx`. The two
      context reads become props: the id prefix, today from
      `useShellIdentifier`, and the changed-views mark, today from
      `useActiveWorkspace`. The viewer keeps `appearance.tsx` as the wrapper
      that reads both contexts and renders the package component. Move the
      `.mbk-appearance` rules from `src/shell/css_nav_search.ts` to
      `appearance-selector.css`.
- [x] `comparison-toolbar`: move `src/shell/comparison_toolbar.tsx` to
      `packages/ui/src/comparison-toolbar/comparison-toolbar.tsx`. The
      package declares its own `ComparisonMode` union, and the viewer's
      `use_comparison.ts` type narrows to it. Move the `.mbk-diff-toolbar`
      rules from `src/shell/css_review.ts` to `comparison-toolbar.css`.
- [x] Cascade layer (decision 6): each package stylesheet declares its rules
      in `@layer mokly.components`. The viewer's `css_tokens.ts` declares the
      layer order first, so the layer exists before any unlayered shell rule.
- [x] Add a test of the viewer's restricted-path rule against a real file in
      `packages/ui/src`, now that one exists; the milestone 2 test used a
      stub resolver.
- [x] Turn the Key Code code spans of `packages/ui/README.md` and the
      `../ui/src` entry of `packages/viewer/README.md` into links now that the
      files exist.
- [x] Tests in `packages/ui/tests` with Testing Library: the appearance menu
      opens, selects, closes on Escape, and reports the choice through its
      callback, with the roles and names the shell specs query; the toolbar
      mode group, the Scroll together switch, and Refresh report through
      their callbacks. Move the viewer tests that cover only the moved markup.
      Keep every assertion.
- [x] Check: `npm run build`, the targeted viewer tests, the browser specs
      `tests/browser/browse_appearance_navigation.spec.ts`,
      `tests/browser/design_appearance_toggle.spec.ts`, and the comparison
      toolbar specs, then the mockup check command of `AGENTS.md`, because
      the shell stylesheet changed. Smoke test through `npm run dev`: the
      Appearance control and the comparison toolbar in Light and Dark, in the
      standalone shell and in the embedded fixture. Save screenshots under
      `.context/ui-package/components/`.
- [x] Done on 2026-10-27 by the delegated Opus 5.5 agent and checked. Its
      choices: `ChangeMark` takes `id`, `kind`, `marked`, and `text`, and
      its styles move to `change-mark.css`; `AppearanceSelector` takes
      `value`, `changed`, `changedId`, `changedText`, `hidden`, and an
      optional `onChange`, while the standalone startup script keeps
      applying the choice; the package `ComparisonMode` type is the one the
      viewer's comparison presentation reuses; each package stylesheet
      repeats the narrow breakpoint, which a viewer test compares with
      `layout_breakpoint.ts`; one narrow-screen rule for the mode buttons
      stays unlayered in `css_review.ts`, because inside the layer it would
      lose to `.mbk-seg button`; the embedded transform merges the layer
      blocks into one, which a test records. The computed styles of 36
      states and the embedded fixture matched the baseline exactly. The
      moved toolbar test keeps every assertion in the package.

## Milestone 4: Design library adoption

Tags: mockup

The design library renders the two registered components through the
package and drops its own copies. Decision 1 approves the deletions.

Delegated on 2026-10-27 to an Opus 5.5 agent, which built and verified the
full adoption, then reverted it to the patch
`.context/ui-package/mockups/prototype-option-a.patch` because decision 9
blocks it. In the tree already: `ComparisonToolbar` gained `modeHref` and
`interactive`, so a static band draws a mode as a link, a button, or inert
text and Refresh as a picture, with the product output unchanged, and the
shell's unlayered narrow rule covers the three forms. Evidence is under
`.context/ui-package/mockups/`.

Open decision 9, asked on 2026-10-28: how the mockups import the package.
The `stylesheets` field of a registration accepts only paths inside
`examples/basic`, so the protocol's "dependency path" cannot work. A
package-name import resolves to `dist`, which Git ignores, so the base side
of every later Changes comparison fails to bundle and Changes goes
unavailable. A import the package sources by repository path,
`packages/ui/src/{name}/{name}.tsx` and `.css`, and change the protocol
sentence to say so; the patch does this. B keep package-name imports and
accept that Changes is unavailable for the design entries on later bases.
C add a source export condition to `@mokly/ui` and enable it in the example
configuration; the release manifest check and its contract change too.
D extend the core so a registration accepts a package specifier and a base
side can build a repository package. Recommended A.

Open findings of the adoption, each a difference from the approved
artboards, asked on 2026-10-28: 1 the shipped selector draws a right
chevron where the artboards drew a down chevron (A accept in the mockups,
B change the product in a separate change); 2 below 900px the shipped
selector is always compact, so the `compact` flag has no effect in mobile
documents (A accept, B a mockup override that restores the full face, C a
`compact` prop on the package component); 3 link and inert-text modes are
1px shorter than before, like the shipped buttons (A accept, B drop the
rule); 4 the knob edge and the Refresh colour follow the shipped control
(A accept).

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

- [ ] Remove the status lines that milestone 1 added, because the behaviour
      is implemented.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Register `@mokly/ui` on npm with its trusted publisher before the first
      release that carries it, under decision 7.
- [ ] Give the unused-export and public-export ratchets a baseline for
      `packages/ui` once a release tag carries the package.
- [ ] After the first release that carries `@mokly/ui`, install
      `@mokly/viewer` into a clean consumer and confirm that `@mokly/ui`
      resolves and that `styles.css` carries the component rules.
- [ ] Later plans, one slice each, in the order of the design library
      inventory: the chrome components, the controls, the inspector
      components, then the preview components. Then the shell tokens as
      `@mokly/ui/tokens.css`. Then remove the embedded selector transform
      once every shell rule is authored under the root class.
