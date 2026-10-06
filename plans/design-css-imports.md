# Design CSS Imports

Status: Active. Not started. Created 2026-10-06 with the user's consent, from
an investigation of `main` at `f66c274`. Milestone 2 changes Mokly product code
before the mockup milestone; Decision 10 explains why. The questions in
[Decisions To Confirm](#decisions-to-confirm) need the user's answer before
Milestone 2 starts.

## Goal

Move the design catalogue's hand-written CSS out of `examples/basic/generated/`
and deliver it through Mokly's imported CSS instead of linked public
stylesheets. In the end state:

- Each stylesheet sits beside the component or helper module that owns it, and
  that module imports it, for example `import "./top-bar.css"`.
- The manual stylesheet setup is deleted.
- `examples/basic/generated/` holds only build output, and Git ignores all of
  it.
- Every design and example view keeps its pixels, except corrections that the
  user approves.
- An edit to a component's own CSS stays attributed to that component in
  Changes, as it is today.

A separate change that is not yet approved may move `examples/basic` to a root
`mokly.config.ts` with a root `specs/` tree. This plan does not depend on it. If
that rename lands first, the paths in this plan move mechanically, for example
`examples/basic/generated/**` becomes `specs/generated/**`.

## Current State

Verified on `main` at `f66c274`:

- `examples/basic/generated/` is the example's `mockupsDir`. It is Mokly's
  output directory and the root that Serve and export publish. Since #70
  (2026-09-15), generated HTML, `mokly-manifest.json` and `mokly-generated/`
  are ignored derived output.
- Git tracks 31 hand-written CSS files there (3,859 lines, about 81 KB):
  `design.css`, `design-stage.css`, `design-documents.css`, `design-review.css`,
  `design-review-scroll.css`, `design-components.css`, six
  `design-component-*.css` sheets, `design-library.css`, 16 sheets under
  `design-library/{group}/{slug}.css`, `styles.css` and
  `example-components.css`.
- These sheets reach views through the linked-stylesheet model and this manual
  setup:
  - the 78-line route-glob `stylesheets` table in
    `examples/basic/mokly.config.ts` (lines 55–132); Mokly uses the first
    matching rule;
  - `libraryStyleFiles`, `libraryStyleCandidates` and `withLibraryStyles` in
    `specs/design/library/style_files.ts`, and the style lists in
    `specs/design/components/parts/styles.ts`;
  - `DesignStyleCollector` and `useDesignStyle` in
    `specs/design/library/style_context.tsx`: `renderer.tsx` creates one
    collector per render, each library view requests its sheet, and the
    renderer links only requested sheets, also for live prop edits in Serve;
  - the `watch.rules` list, which names all 31 sheets one by one;
  - four CSS entries in `review.sharedImpact`;
  - CSS paths in screen `dependencies` (`specs/design/metadata.ts`,
    `specs/catalogue.tsx`) and in component `ownedDependencies`
    (`specs/design/library/metadata.ts`,
    `src/components/{action,toolbar}/*.mokly.tsx`).
- Every design view links `design.css` and `design-stage.css` first, then the
  library sheets that render, then layout sheets. Seven route families differ
  in their shared and layout sheets.
- Imported CSS delivery (#125, 2026-10-02) is used only by `WorkspaceNote`.
  Four example entries reach CSS. No design entry reaches CSS, and the renderer
  does not reach CSS.
- The tracked sheets contain no `url()` and no `@import`. No design entry uses
  `definePage`; only the example `getting-started` page does. The renderer
  emits the entry stylesheet links that Mokly passes.
- A fresh clone without `examples/basic/generated/` is valid: Build and derived
  Check both succeed when `mockupsDir` does not exist.

## Findings

The decisions below depend on these facts. Measurements used the current
example build, Mokly's `analyzeStylesheetChange` rule matcher and an
approximate cascade check that ignores media conditions and state
pseudo-classes. Milestone 3 repeats them on the migrated build.

1. **Owned imported CSS loses component attribution.** A fixture compared an
   owned linked sheet with an owned imported sheet for the same component and
   screen:

   | Delivery | Edited rule matches | Changes rows                | Affected consumers |
   | -------- | ------------------- | --------------------------- | ------------------ |
   | Linked   | The component       | `action`                    | `home`             |
   | Linked   | Only `home`         | `action`                    | `home`             |
   | Imported | The component       | `action/default` and `home` | None               |
   | Imported | Only `home`         | `home`                      | None               |

   `withoutDeliveredSourceImpact` (`src/review/imported_changes.ts`) removes a
   changed private source when a generated bundle changed. No component owns a
   generated bundle route, so `ComponentDependencyPolicy` and `ownedCssReasons`
   find no owner. A plain migration would list consuming design screens
   directly and break the attribution table in
   `docs/protocol/mokly-design-components.md`.

2. **The renderer reaches CSS-owning design modules.** `renderer.tsx` →
   `library/host.tsx` → `components/parts/workspace.tsx` → `parts/stage.tsx` →
   `library/preview/device-frame.tsx` → `device-frame.view.tsx`. Mokly links
   renderer CSS to every view, before the entry bundle.
3. **Three sheets have global selectors.** `design.css` has `:root`, `*`,
   `*::before`, `*::after` and `body`. `design-stage.css` has `:root`.
   `styles.css` has `:root`, `body`, `main` and `nav`.
4. **Scope matters for shared sheets.** If added to views that do not link them
   today: `design-component-details.css` (`.ce-design code`) matches 166
   Browse, Changes and Appearance view files; `design-components.css` has
   `.ce-design a`; `design-review.css` matches 7 Browse view files.
   `design-component-view.css` and `design-review-scroll.css` contain rules
   that the matcher cannot resolve, so they are not proven neutral.
5. **Library sheets are almost neutral.** 14 of 16 library sheets match nothing
   in design views that do not link them. `device-frame.css` styles
   `.mbk-frame-scheme-note`, which `parts/markdown.tsx` and
   `parts/removed_preview.tsx` also render. `catalogue-navigation.css` has one
   `@keyframes` rule, which rule analysis cannot resolve.
6. **Two current inconsistencies will surface.** In the dark
   `design/browse/appearance/states/light-only-{current,document}` files, the
   scheme note renders without `device-frame.css`. If that sheet reaches these
   views, the note gets `font-weight: 500`. Five Browse screens render the
   comparison toolbar or comparison details without `design-review.css`:
   `index-entries/member-changes`, `publication/changes`,
   `variants/variant-changes`, `variants/variant-removed` and
   `variants/variant-reparented`. Imports can add the compact mobile toolbar
   sizing and the details spacing that every Changes screen already has.
7. **Eleven sheet pairs are order-sensitive.** Equal-specificity rules in both
   sheets set the same property on the same element. Today's order wins:

   | First sheet                                      | Second sheet                     | Properties                      |
   | ------------------------------------------------ | -------------------------------- | ------------------------------- |
   | `design.css`                                     | `design-library.css`             | `display`, `height`, `overflow` |
   | `design-stage.css`                               | `design-components.css`          | `padding`                       |
   | `design-stage.css`                               | `design-review-scroll.css`       | `min-height`, `height`, `flex`  |
   | `design-review.css`                              | `design-review-scroll.css`       | `height`, `top`                 |
   | `design-review.css`                              | `design-component-inspector.css` | `margin`                        |
   | `design-library/inspector/inspector.css`         | `design-component-workspace.css` | `overflow`                      |
   | `design-library/chrome/catalogue-navigation.css` | `design-components.css`          | `color`, `text-decoration`      |
   | `design-library/preview/empty-state.css`         | `design-component-details.css`   | `font-size`                     |
   | `design-components.css`                          | `design-component-controls.css`  | `background`, `color`           |
   | `design-component-inspection.css`                | `design-component-view.css`      | `pointer-events`                |
   | `design-component-inspector.css`                 | `design-component-controls.css`  | `margin`                        |

8. **PostCSS changes one sheet.** The example's PostCSS config runs on imported
   CSS. Autoprefixer adds `-webkit-appearance: none;` to
   `inspector/inspector.css`. Tailwind leaves all 31 sheets unchanged.
9. **Formatting and lint apply after the move.** `.prettierignore` excludes
   `examples/basic/generated`, and 21 of the 31 sheets are not
   Prettier-formatted. ESLint `import/first` rejects an import after an
   `export ... from` line; `import/order` keeps side-effect imports in place.
10. **22 test files depend on the old setup.** Two more break at run time.
    Most other path matches are synthetic fixtures. The second test in
    `tests/design_library_styles.test.ts` asserts nothing, because its
    `design-ui-` filter matches no entry.
11. **Bundles repeat shared CSS.** Mokly emits one bundle per entry module, and
    47 design entry modules exist. Shared sheets repeat in each bundle, so
    generated output can grow by a few MB (it is about 22 MB today).

## Decisions

1. **Delivery rule.** A view links exactly the bundle of its entry module. The
   bundle holds every stylesheet that the entry's import graph reaches, in
   first-reachability order. Rendering no longer selects sheets. This is a
   superset of today's library delivery. Findings 4–6 show where it is not
   neutral.
2. **Ownership needs product support.** Milestone 2 adds this contract: a
   component that names a private imported sheet, or a directory that holds
   it, in `ownedDependencies` owns it exactly like an owned linked sheet.
   - The owner keeps its `dependency` reason when bundle bytes change.
   - Changed bundle rules that come from an owned source count as the owner's
     CSS. A consumer view where the owner is a paired instance is affected
     through the owner and gets no direct reason.
   - Rules from unowned sources keep rule-level attribution.
   - A rule that Mokly cannot trace to exactly one source stays consumer
     evidence.
   - Source provenance works for both sides, including derived baselines that
     older Mokly versions built.
   - For the same edit, owned linked and owned imported sheets give the same
     Changes rows, affected consumers and exclusions. Only evidence paths
     differ.
3. **The renderer reaches no stylesheet.** Renderer CSS would reach every view
   (Finding 3). It would also precede every entry bundle, which inverts pairs
   such as pair 6 in Finding 7.
   `LibraryHost` moves to the entry side. A CSS-free page host registry that
   the renderer reads replaces the static import chain in Finding 2. The
   library page module registers the host and imports its own sheet. A test
   checks that the build has no renderer stylesheet route.
4. **Global sheets.** The renderer imports none of them.
   - `design.css` and `design-stage.css` move beside a new
     `examples/basic/specs/design/parts/foundation.ts`, which imports them in
     that order. Every design entry module imports the foundation first.
   - `styles.css` moves to `examples/basic/src/styles.css`.
     `specs/catalogue.tsx` and the Action and Toolbar entry modules import it
     first. No design entry reaches these modules.
   - `example-components.css` moves to `examples/basic/src/components/`.
     `action.tsx` and `toolbar.tsx` import it, and both registrations keep
     shared ownership.
5. **Cascade order.** The import rules keep the order-sensitive pairs:
   - Every design entry module imports the foundation first.
   - A module imports its own stylesheet after its other imports, so the CSS
     of the modules that it composes comes first.
   - A module whose sheet overrides another sheet imports that sheet before its
     own. This is allowed only when both always reach the same views, or when
     the extra delivery is neutral.
   - When that would add a non-neutral sheet to a view, the conflict is fixed
     in CSS, and pixel parity proves the result.
   - A permanent test checks that the foundation comes first and that each
     order-sensitive pair keeps its order in every view.
   - CSS cascade layers are not used. Dark design views carry unlayered head
     styles (the react-native-web reset and the renderer's
     `main a{color:…}`). Unlayered styles beat every layered rule, so layers
     would change link colors.
6. **Locations.** File names stay the same, and the directory shows the owner.
   Paths are relative to `examples/basic/`. An importer without a directory in
   the table sits in the new directory. Milestone 3 confirms the importers
   with the delivery audit and records the final table.

   | Sheet today                         | New directory                             | Initial importers                                           |
   | ----------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
   | `design-library/{group}/{slug}.css` | `specs/design/library/{group}/`           | `{slug}.view.tsx`                                           |
   | `design.css`, `design-stage.css`    | `specs/design/parts/`                     | `foundation.ts`                                             |
   | `design-documents.css`              | `specs/design/parts/`                     | `markdown.tsx`, `mini_account.tsx`, `mini_invoice.tsx`      |
   | `design-review.css`                 | `specs/design/parts/`                     | `compare.tsx`, `details.tsx`                                |
   | `design-review-scroll.css`          | `specs/design/parts/`                     | `compare_scroll.tsx`, `mini_app_shell.tsx`                  |
   | `design-components.css`             | `specs/design/components/parts/`          | `component_layout.tsx`, `preview.tsx`, `controls.tsx`       |
   | `design-component-inspection.css`   | `specs/design/components/parts/`          | `screen_preview.tsx`, `highlight.tsx`                       |
   | `design-component-details.css`      | `specs/design/components/parts/`          | `component_details.tsx` and the usage and tree modules      |
   | `design-component-inspector.css`    | `specs/design/components/parts/`          | `inspector.tsx`                                             |
   | `design-component-workspace.css`    | `specs/design/components/parts/`          | `workspace.tsx`                                             |
   | `design-component-view.css`         | `specs/design/components/parts/`          | `preview.tsx`                                               |
   | `design-component-controls.css`     | `specs/design/components/controls/parts/` | `panel.tsx`                                                 |
   | `design-library.css`                | `specs/design/library/`                   | The library page module                                     |
   | `styles.css`                        | `src/`                                    | `specs/catalogue.tsx`, the Action and Toolbar entry modules |
   | `example-components.css`            | `src/components/`                         | `action/action.tsx`, `toolbar/toolbar.tsx`                  |

   The usage and tree modules are `instance_tree.tsx`, `component_usage.tsx`,
   `comparison_details.tsx` and `screen_details.tsx`.

7. **Declarations.** Library components own `{slug}.view.tsx` and `{slug}.css`
   at their new paths. Screens and folders drop CSS paths from `dependencies`,
   because imports already record these sources. Delete the `stylesheets`
   table and the `watch.rules` list; imported CSS edits already rebuild and
   reload. Delete the four CSS entries in `review.sharedImpact`; keep
   `examples/basic/renderer.tsx` and `examples/basic/src/components/**`.
8. **Visual changes.** No view may change its pixels, except corrections that
   the user approves (Q2). Pixel parity covers every generated view file.
9. **Depicted evidence.** `specs/design/parts/review.tsx` shows
   `generated/styles.css` five times as depicted fixture data. It links
   nothing. It stays, because it depicts a linked public stylesheet, which
   Mokly still supports.
10. **Milestone order.** AGENTS.md puts the mockup milestone second. AGENTS.md
    also requires a working product at the end of each milestone. The mockup
    work cannot meet that rule before Milestone 2 (Finding 1), so Milestone 2
    comes first. Q1 offers the alternative.

## Decisions To Confirm

- **Q1. Plan structure.** (A) Keep Milestone 2 in this plan, before the mockup
  milestone, as written. (B) Move Milestone 2 unchanged to its own plan and PR,
  which merges first. Recommendation: A. It follows the request to keep
  product work in its own milestone here, and each milestone leaves a working
  product. Choose B for smaller PRs and strict milestone order.
- **Q2. Surfaced inconsistencies (Finding 6).** (A) Accept both as
  corrections, with before and after screenshots in the PR. (B) Keep today's
  pixels: give the non-frame scheme notes their own class, and keep
  `design-review.css` away from the five Browse screens. Recommendation: A for
  both. The compact mobile toolbar is documented comparison-toolbar behavior.
- **Q3. Library page host.** (A) An entry-side page host registry in the
  example (Decision 3). (B) A new Mokly API for component page hosts, in a
  separate plan. Recommendation: A. B is a larger public API change.
- **Q4. Unresolved owned rules where the owner does not render.** (A) Keep the
  conservative result: a `@keyframes` edit in `catalogue-navigation.css` keeps
  every view that imports the navigation in Changes. (B) Exclude owned rules
  where the owner is absent. Recommendation: A. B is unsound when an
  ownership declaration is wrong.
- **Q5. Evidence paths.** After this change, Details names generated bundle
  routes for the example's CSS edits. (A) Accept for now and plan a follow-up
  that shows the changed source sheet (it needs mockups and UI work). (B) Add
  that work to this plan. Recommendation: A.

## Milestone 1 — Contract documentation

Update the docs so that they define the complete contract for Milestones 2
and 3. No code changes.

- [ ] Add `docs/protocol/mokly-imported-styles-ownership.md` (at most 250
      lines) and register it in `docs/protocol/README.md`. Define Decision 2:
      ownership of private sheets and directory roots; owner reasons when
      bundle bytes change; per-rule source provenance for head and baseline
      bundles, including derived baselines that older Mokly versions built;
      consumer suppression and affected evidence for paired owners; exact
      screen declarations; owners that do not render; shared ownership; CSS
      Modules; nested `@import`; sheets that a renderer reaches; untraceable
      rules; determinism; and any manifest or result schema change.
- [ ] Record which ownership source produced each reason, so that
      [Configurable Changes Listing](./configurable-changes-listing.md) can map
      it to a setting.
- [ ] Link the new contract and remove contradictions in
      `mokly-css-attribution.md` (Analysis scope),
      `mokly-css-attribution-membership.md` (explicit ownership of an imported
      source is not inferred ownership), `mokly-component-changes.md`
      (Dependencies And Styles), `mokly-imported-styles-assets.md` (Changes
      paragraph), `mokly-component-review.md` (if reason paths change),
      `docs/guides/authoring/styles.md`, `docs/guides/authoring/components.md`,
      `src/review/README.md` and `src/build/README.md`.
- [ ] Rewrite the design catalogue contract in `mokly-design-components.md`.
      In Catalogue And Source Ownership, `G/S.css` sits beside `G/S.view.tsx`,
      which imports it. In Styles And Change Attribution, replace the collector,
      candidate pool, configured order and unused-child paragraphs (lines
      183–208) with Decisions 1 and 3–7. Keep the attribution table.
- [ ] Update `mokly-design-component-library.md` (lines 196–201),
      `mokly-component-design.md` (lines 222–229), `mokly-runtime.md` (lines
      15–17), `mokly-derived-baselines.md` (lines 50–52),
      `mokly-viewer-palette.md` (lines 7–9) and, if a sheet name changes,
      `packages/viewer/src/shell/README.md` (lines 412–413).
- [ ] Update `examples/basic/README.md` (stylesheet, tracking, watch and
      attribution paragraphs), `examples/basic/specs/design/library/README.md`
      (Authoring, Styles And Hosts, Verification), `examples/basic/notes.md`
      (lines 134–136), `src/build/README.md` (lines 274–275) and the
      AGENTS.md Mockups paragraph (lines 159–171): Git ignores all of
      `examples/basic/generated/`, and authored CSS lives beside its owner.
- [ ] Record the location table, the import rules and the order-sensitive
      pairs in the library README.
- [ ] Keep every protocol doc within its size rule. A new doc has at most 250
      lines. A capped doc may not grow; when it shrinks, lower its cap in
      `tests/protocol_doc_sizes.test.ts`.
- [ ] Run `npx prettier --check` on every changed Markdown file. Then run
      `npm run build` and each doc test with
      `node --import tsx --test tests/<name>.test.ts`: `protocol_doc_sizes`,
      `protocol_structure`, `protocol_split_links`, `protocol_doc_history`,
      `markdown_links`, `component_protocol_docs`, `guides_*` and
      `imported_styles_low_contract`.
- [ ] Review the diff for consistency across the protocol set. Commit
      (`docs: define imported design CSS contract`) and push.

## Milestone 2 — Owned imported stylesheet attribution

Mokly attributes an edit to a component's owned imported sheet to that
component, with the same Changes result as an owned linked sheet. The design
catalogue does not change.

- [ ] Write failing tests first in `tests/changes_imported_ownership*.test.ts`
      (each file below 300 lines). Compare owned linked and owned imported
      delivery for the same edits, in committed and derived modes, through
      `computeCatalogueChanges` and `compareReview`. Cover:
  - [ ] a rule that the component renders, and a rule that only a screen
        renders;
  - [ ] a formatting-only edit;
  - [ ] shared ownership by two components, and a directory-root owner;
  - [ ] a CSS Module and a nested `@import`;
  - [ ] an exact screen declaration;
  - [ ] an owner that a view imports but does not render, with a resolved
        rule and with a `@keyframes` rule;
  - [ ] one edit to an owned sheet and an unowned sheet together;
  - [ ] an owned sheet that the renderer reaches.
- [ ] Record per-rule source provenance for each generated stylesheet route on
      the head side. Do not change generated bytes.
- [ ] Derive baseline provenance with the same method, without metadata from
      the baseline build.
- [ ] Keep owner evidence when bundle bytes change
      (`src/review/imported_changes.ts`). Attribute owned rules through
      `ComponentDependencyPolicy` (`src/review/component_metadata.ts`) and
      `ownedCssReasons` (`src/review/component_resource_attribution.ts`).
- [ ] Keep one classification policy: Browse, watched updates, complete and
      selected comparisons, export and publication give the same result. Add
      export and publication cases.
- [ ] Measure example classification time before and after, and record both
      values here. Avoid a notable regression.
- [ ] Smoke test: serve a small consumer with an owned imported sheet through
      `node dist/cli/bin.js serve`, edit the sheet, and confirm that Changes
      lists the component and shows the screen as affected.
- [ ] Update the READMEs from Milestone 1 if the implementation adds detail.
- [ ] Run `npm run build`, the focused and full unit tests, `npm run lint`,
      `npm run format:check`, `npm run typecheck`, `npm run example:build`,
      `npm run example:check` and `cargo xtask check`. Commit
      (`feat(review): attribute owned imported CSS`) and push.

## Milestone 3 — Design catalogue imports its CSS

Tags: mockup

Move the 31 sheets beside their owners, import them, and delete the manual
setup. Every view keeps its pixels, except approved corrections.

- [ ] Capture the baseline first. Build `origin/main` in a worktree under
      `.context/`. Record each view's ordered link list. Save a full-page
      screenshot of every generated view file under `design/` and `example/`
      (mobile files at 390×844, desktop files at 1280×800, Light and Dark
      files). Keep the scripts in `.context/`.
- [ ] Resolve the scheme-note class reuse in `parts/markdown.tsx` and
      `parts/removed_preview.tsx` as Q2 decides.
- [ ] Make the renderer CSS-free (Decision 3). Keep `DesignRenderedScheme`
      CSS-free. Add a test that the example build has no renderer stylesheet
      route. Check that every library variant still renders inside its host,
      in Build, on-demand Serve and transient prop renders.
- [ ] Format the 21 unformatted sheets in place with Prettier in a
      format-only commit (override `.prettierignore` for this run), so that
      the move keeps identical bytes.
- [ ] Move the 31 sheets with `git mv` to the locations in Decision 6.
- [ ] Wire the imports by Decisions 4 and 5. Library views import
      `./{slug}.css` after their other imports. Every design entry module
      imports `parts/foundation.ts` first. Add the dependency imports that the
      order-sensitive pairs need.
- [ ] Delete the manual setup:
  - [ ] `style_files.ts`, `style_context.tsx` and every `useDesignStyle` call;
        retype `DUAL_SCHEME_SAMPLES` without `LibraryStyle`;
  - [ ] the collector in `renderer.tsx`; the renderer emits `input.stylesheets`
        directly;
  - [ ] the style lists in `specs/design/components/parts/styles.ts`;
  - [ ] the `stylesheets` table, the `watch.rules` list and the CSS entries in
        `review.sharedImpact`.
- [ ] Update the declarations (Decision 7) in `specs/design/metadata.ts`,
      `specs/catalogue.tsx`, `specs/design/library/metadata.ts`,
      `src/components/action/action.mokly.tsx` and
      `src/components/toolbar/toolbar.mokly.tsx`.
- [ ] Replace the four example lines in `.gitignore` with
      `/examples/basic/generated/`. Confirm that
      `git ls-files examples/basic/generated` prints nothing, and that Build
      and Check pass after `rm -rf examples/basic/generated`.
- [ ] Add one shared location helper in `tests/helpers/design_styles.ts`. Merge
      the palette reader from `tests/helpers/design_palette.ts` into it, and add
      the per-component lookup that `tests/helpers/design_library.ts` needs.
      Every test uses the helper, not a hard-coded path.
- [ ] Update the tests that read sheet bytes: `brand_logo.test.tsx`,
      `design_links_inventory.test.ts`, `design_appearance.test.ts`,
      `design_boundaries.test.ts`, and the browser specs
      `design_comparison_eligibility`, `design_comparison_scrolling` and
      `design_scroll_together`.
- [ ] Update the tests that check links. `design_library_styles.test.ts` and
      `design_document_styles.test.ts` check bundle contents instead of link
      names. `browser/component_design_navigation.spec.ts` intercepts the
      bundle route.
- [ ] Update the attribution tests. `component_design_attribution.test.ts`,
      `design_library_attribution.test.ts` and
      `helpers/design_library_fixture.ts` edit the moved source, rebuild, and
      expect today's Changes membership.
- [ ] Replace `design_library_style_collector.test.tsx` with delivery tests.
      Record the deletion in the PR description.
- [ ] Update the tracking tests. `example_baseline.test.ts` expects no tracked
      file under `examples/basic/generated/`. Simplify
      `helpers/example_sources.ts` and `documents_example_sources.test.ts`.
- [ ] Fix the vacuous ownership test in `design_library_styles.test.ts`. Make
      it fail first, then assert `{slug}.view.tsx` and `{slug}.css` ownership
      for all 16 components.
- [ ] Update `design_library_inventory.test.ts`,
      `design_appearance_variants.test.ts`, `helpers/example_baseline.ts` (the
      `design-library` profile) and `browser/design_library_export.spec.ts`.
      Confirm that `browser/design_library.spec.ts` passes unchanged.
- [ ] Add permanent tests:
  - [ ] delivery completeness: each class in a generated view that an authored
        sheet styles reaches that view;
  - [ ] cascade order: the foundation comes first, and each order-sensitive
        pair keeps its order in every view where both appear;
  - [ ] unused child: a closed Top bar picker and an empty Tag picker stay out
        of Changes for a resolved Tag chip rule edit;
  - [ ] a browser test: opening the Top bar tag picker through Props in Serve
        shows styled chips.
- [ ] Run the audits on the migrated build and record the results here:
  - [ ] delivery delta: each sheet that a view gains matches nothing in it or
        is an approved correction, and each sheet that a view loses matched
        nothing in it;
  - [ ] order conflicts: run the cascade check for design and example views;
        each order-sensitive pair keeps today's order, and the order test
        gains each new pair;
  - [ ] pixel parity: compare every screenshot with the baseline; fix each
        difference or record it as an approved correction.
- [ ] Record the size of `examples/basic/generated/mokly-generated/` and the
      example Build time, before and after.
- [ ] Check the docs from Milestone 1 against the final result: the importer
      table, the order-sensitive pairs, and the test names in the library
      README Verification section.
- [ ] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      the changed tests, `npm run lint`, `npm run format:check`,
      `npm run typecheck` and `cargo xtask check`. Commit
      (`refactor(example): import design CSS by owner`) and push.

## Milestone 4 — Verification, commit, push and review

- [ ] Run the complete gate: `npm run build`, `npm run example:build`,
      `npm run example:check`, `npm test`, `npm run test:browser`,
      `npm run lint`, `npm run format:check`, `npm run typecheck` and
      `cargo xtask check`. Fix each failure until all pass.
- [ ] Smoke test through `npm run dev` after `rm -rf examples/basic/generated`:
  - [ ] open screens from each design family and the example in Mobile and
        Desktop, Light and Dark;
  - [ ] change props of the Top bar and the Tag picker in Props;
  - [ ] edit a moved sheet and confirm the rebuild and reload;
  - [ ] edit `top-bar.css` and confirm that Changes lists Top bar and shows
        the consuming screens as affected;
  - [ ] compare changed screens in Overlay and Difference modes.
- [ ] Build the PR preview with
      `npm run preview:build -- --include-changes --base origin/main`. The
      changed links cause a one-time Changes jump. Confirm in Overlay and
      Difference that the pixels do not change.
- [ ] Check mainline preservation with `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`. List each approved
      deletion in the PR description.
- [ ] Run `git add -A`, commit with a Conventional Commit title, and push the
      branch.
- [ ] After the push, review the complete local diff against `origin/main`
      with
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
      Report each finding with a number, a severity, a plain explanation, the
      impact of doing nothing, lettered options and a recommendation. Do not
      change the implementation.

## Post-merge follow-up (non-blocking)

- Confirm that a later branch's first Changes comparison against the merged
  `main` shows no stylesheet-only changes.
- Plan the Q5 follow-up, which shows the changed source sheet in Details.
- If the root `mokly.config.ts` change lands later, move this plan's paths
  mechanically.
