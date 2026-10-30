# Design mockups import the UI package by path

- **Severity:** Low (estimate). **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #243 and its completed plan, the follow-up
  of finding 1 of its first review.
- **Location:** the 14 repository-path imports of `@mokly/ui` in 11 files:
  `examples/basic/specs/design/library/chrome/appearance-selector.view.tsx:3`,
  `examples/basic/specs/design/library/chrome/catalogue-navigation-sections.ts:8`,
  `examples/basic/specs/design/library/chrome/catalogue-navigation.view.tsx:8`,
  `examples/basic/specs/design/library/chrome/screen-header.view.tsx:3`,
  `examples/basic/specs/design/library/chrome/top-bar.view.tsx:5`,
  `examples/basic/specs/design/library/controls/comparison-toolbar.view.tsx:6`,
  `examples/basic/design-library/chrome/appearance-selector.css:3-4`,
  `examples/basic/design-library/chrome/catalogue-navigation.css:3-4`,
  `examples/basic/design-library/chrome/screen-header.css:2`,
  `examples/basic/design-library/chrome/top-bar.css:3`, and
  `examples/basic/design-library/controls/comparison-toolbar.css:3-4`. The
  decision in force is at `docs/protocol/mokly-design-components.md:74`.
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
  - The design library renders the appearance selector and the comparison
    toolbar through `@mokly/ui`. Since PR #249 of 2026-10-30, it also renders
    the top bar, the screen header, and the catalogue navigation with its
    tree through the package. The comparison toolbar sheet also imports the
    CSS of the segmented control, which the toolbar renders. The views
    import the package sources by repository path, such as
    `../../../../../../packages/ui/src/appearance-selector/appearance-selector.js`.
    The sheets import the package CSS by repository path too. These imports
    grew from 5 lines at `f93afcea` to 14 lines in 11 files.
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
  - `docs/protocol/mokly-design-components.md:74` states the decision in
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
    later bases. Effort: Small (estimate).
  - **C.** Add a source export condition to `@mokly/ui`, so that a
    package-name import resolves to its sources. The CSS keeps the relative
    import. Effort: Medium (estimate).
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
- **Action:** ask the user, because condition 3 holds (estimate): D is
  Large, and its prerequisite is a separate plan that the user owns.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/ui-package.md?plain=1#L501).
