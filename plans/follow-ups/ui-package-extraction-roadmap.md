# Continue extraction into the shared UI package

- **Severity:** Low (estimate). **Effort:** Large (estimate).
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #243 and its completed plan, an unchecked
  post-merge task.
- **Location:** `packages/viewer/src/shell`, `packages/ui/src`,
  `packages/viewer/src/shell/README.md:200`, and
  `docs/protocol/mokly-design-component-library.md`.
- **Reason:** PR #243 moved only the first slice on purpose, and each later
  slice needs its own plan.

- **Terms:**
  - **`@mokly/ui`:** the shared UI package under `packages/ui`. It holds the
    presentational components of the Browse shell and their CSS.
  - **Slice:** one group of shell components that moves into `@mokly/ui` in
    one plan and one pull request.
  - **Embedded selector transform:** the build step of `@mokly/viewer` that
    maps document selectors and shell-root `.mbk` selectors to the
    embedding scope, as `packages/viewer/src/shell/README.md:200` describes.
- **Background:**
  - On 2026-10-27 the user chose a separate npm package for the shell's
    presentational components. The user also chose that the design library
    renders the package components with the package CSS. One implementation
    then serves the product and its mockups.
  - A package component takes props and callbacks only. It has no store, no
    context, no fetch, no history, no frame access, and no catalogue read
    model type.
  - On `main` at `a9dd1e81`, 34 of the 66 shell component files read no
    store and no context.
  - PR #243 merged on 2026-10-29 with the first slice: the icons, the change
    mark, the appearance selector, and the comparison toolbar. It kept the
    embedded selector transform, the shell tokens, and the store design.
  - The plan of PR #243 set the order of the later slices by the design
    library inventory in `docs/protocol/mokly-design-component-library.md`.
- **Task:**
  1. Move the chrome components into `@mokly/ui`, in one plan.
  2. Move the controls, in a second plan.
  3. Move the inspector components, in a third plan.
  4. Move the preview components, in a fourth plan.
  5. Move the shell tokens into `@mokly/ui/tokens.css`.
  6. Remove the embedded selector transform once every shell rule is
     authored under the root class.
  7. In each slice, make the design library render the moved components
     through the package, and delete its own copies and their styles.
- **Impact if no action:** The shell and the design library keep two
  implementations of the remaining components. Browser specs must keep the
  copies in step, and the copies still drift.
- **Needs:** The user's consent for each plan, as the `plans` skill requires.
  The task needs no deployed change and no credentials.
- **Done when:** Every presentational shell component that reads no store
  lives in `@mokly/ui`, the shell tokens ship as `@mokly/ui/tokens.css`, and
  the embedded selector transform is gone.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/ui-package.md?plain=1#L533).
