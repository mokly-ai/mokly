# Design mockups import the UI package by path

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #243 and its completed plan, the follow-up
  of finding 1 of its first review.
- **Location:** the 27 repository-path imports of `@mokly/ui` in the 22
  files of the design library:
  `examples/basic/specs/design/library/canvas/frame_compare.tsx:7-8`,
  `examples/basic/specs/design/library/chrome/appearance-selector.view.tsx:3`,
  `examples/basic/specs/design/library/chrome/catalogue-navigation-sections.ts:8`,
  `examples/basic/specs/design/library/chrome/catalogue-navigation.view.tsx:8`,
  `examples/basic/specs/design/library/chrome/top-bar.view.tsx:5`,
  `examples/basic/specs/design/library/controls/change-status.view.tsx:4`,
  `examples/basic/specs/design/library/controls/tag-chip.view.tsx:3`,
  `examples/basic/specs/design/library/controls/tag-picker.view.tsx:5`,
  `examples/basic/specs/design/library/inspector/metadata-row.tsx:6`,
  `examples/basic/specs/design/library/inspector/metadata-row.view.tsx:1`,
  `examples/basic/specs/design/library/inspector/prop-field.view.tsx:1`,
  `examples/basic/specs/design/library/preview/empty-state.view.tsx:3`,
  `examples/basic/design-library/canvas/canvas-frame.css:8-9`,
  `examples/basic/design-library/chrome/appearance-selector.css:3-4`,
  `examples/basic/design-library/chrome/catalogue-navigation.css:3-4`,
  `examples/basic/design-library/chrome/top-bar.css:4`,
  `examples/basic/design-library/controls/change-status.css:2`,
  `examples/basic/design-library/controls/tag-chip.css:2`,
  `examples/basic/design-library/controls/tag-picker.css:4`,
  `examples/basic/design-library/inspector/metadata-row.css:4-5`,
  `examples/basic/design-library/inspector/prop-field.css:3`, and
  `examples/basic/design-library/preview/empty-state.css:3`. The
  decision in force is at `docs/protocol/mokly-design-components.md:75-78`.
- **Reason:** On 2026-10-28 the user chose repository-path imports for now,
  and no choice approves the switch, which needs the core fix for built
  repository packages in Changes.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **`@mokly/ui`:** the shared UI package under `packages/ui`. It holds the
    presentational components of the Browse shell and their CSS.
  - **Design library:** the shared mockup components under
    `examples/basic/specs/design/library`, with their styles under
    `examples/basic/design-library`.
  - **Built repository package:** a workspace package whose `exports` point
    to its `dist` build output, which Git ignores.
- **Background:**
  - The design library renders the appearance selector through
    `@mokly/ui`. Since PR #249 of 2026-10-30, it also renders the top bar
    and the catalogue navigation with its tree through the package. It also
    renders the change status, the tag chip, the tag picker, the metadata
    row, the prop field, the empty state, and the comparison panes through
    the package. The appearance selector sheet also imports the CSS of the
    change mark, which the selector renders. The views
    import the package sources by repository path, such as
    `../../../../../../packages/ui/src/appearance-selector/appearance-selector.js`.
    The sheets import the package CSS by repository path too. These imports
    grew from 5 lines at `f93afcea` to 27 lines in 22 files.
  - On 2026-10-28 the user chose this repository-path import, option A,
    "for now". A package-name import resolves to `dist`, and the base side
    of a later Changes comparison renders from Git, which has no `dist`. The
    base would fail to bundle, and Changes would go unavailable.
  - The user rejected package-name imports with Changes unavailable on later
    bases, option B. The user rejected for now a source export condition,
    option C, because the CSS would still need the relative import, and the
    release manifest check would need an exception.
  - Option D, the core fix for built repository packages in Changes, is a
    separate plan that the user picks up.
  - `docs/protocol/mokly-design-components.md:75-78` states the decision in
    force: the repository path, not the package name.
- **Problem:** The mockups reach the package through deep relative paths
  instead of its public name. The Rust design fixtures and the packed
  consumer smoke test copy `packages/ui/src` for the same reason.
- **Impact if no action:** The mockups do not test the public entry points
  of `@mokly/ui`. A broken export can pass the mockup checks, and each new
  package component adds more deep paths.
- **Root question:** How do the design mockups use `@mokly/ui` through its
  public name while each Changes side still bundles from its own files?
- **Options:**
  - **A.** Keep the repository-path imports, as the user chose on
    2026-10-28. Effort: Small.
  - **B.** Import by package name, and accept that Changes is unavailable on
    later bases. Effort: Small.
  - **C.** Add a source export condition to `@mokly/ui`, so that a
    package-name import resolves to its sources. The CSS keeps the relative
    import. Effort: Medium.
  - **D.** After the core fix for built repository packages lands, import
    `@mokly/ui` by package name in the design library. Update the design
    components contract. Effort: Large.
- **Left out:** None. The options keep the letters of the user's decision of
  2026-10-28.
- **Wider fix:** D. Built repository packages in Changes let every
  workspace package be imported by name on both sides.
- **Previous examples:** The Rust design fixtures and the packed consumer
  smoke test both copy `packages/ui/src`.
- **Recommendation:** D. It removes the deep paths without losing Changes,
  once its prerequisite lands.
- **Action:** ask the user, because D changes the repository-path import
  decision of 2026-10-28 in docs/protocol/mokly-design-components.md. The user
  also reserved its core prerequisite as a separate plan.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/ui-package.md?plain=1#L501).
