# Continue extraction into the shared UI package

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #243 and its completed plan, an unchecked
  post-merge task.
- **Location:** `packages/viewer/src/shell`, `packages/ui/src`,
  `packages/viewer/scripts/styles.mjs:5` and `:32-56`,
  `docs/protocol/mokly-design-component-library.md`, and the two stale plan
  lines at `plans/ui-package-shell-views.md:3` and `:34`.
- **Reason:** PR #243 moved only the first slice on purpose, and the slices
  after the chrome slice of PR #249 wait for the later pull requests of
  `plans/ui-package-shell-views.md`.

- **Terms:**
  - **`@mokly/ui`:** the shared UI package under `packages/ui`. It holds the
    presentational components of the Browse shell and their CSS.
  - **Slice:** one group of shell components that moves into `@mokly/ui` in
    one plan and one pull request.
  - **Embedded selector transform:** the build step of `@mokly/viewer` that
    maps document selectors and shell-root `.mbk` selectors to the
    embedding scope, in `packages/viewer/scripts/styles.mjs:5` and `:32-56`.
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
    It put each later slice in its own plan: the chrome components in one
    plan, the controls in a second, the inspector components in a third,
    and the preview components in a fourth. This item's task list first
    repeated that allocation, and its Needs first asked for the user's
    consent for each plan, as the `plans` skill requires.
  - On 2026-10-29 the user asked that every styled view of the shell move to
    `@mokly/ui`, so that no UI lives in `@mokly/viewer`.
    `plans/ui-package-shell-views.md` holds that work. By its design calls
    of 2026-10-29, one plan holds every slice, in a stack of five pull
    requests.
  - PR #249 merged on 2026-10-30 with the chrome slice: the top bar, the
    catalogue navigation with its tree, the screen header, and the segmented
    control. The design library renders them through the package. The
    controls, inspector, preview, and layout and theme slices remain.
  - Decision 12 of the plan of PR #243, which the user made on 2026-10-28,
    keeps `@mokly/ui/styles.css` as the only stylesheet subpath.
  - On 2026-10-30 the user chose option G for decision 4 of the shell views
    plan. Under G, the tokens live on the shell root element, no package
    rule selects the page, and the viewer build drops the `@scope`
    transform. The user rejected a second stylesheet subpath, which would
    have replaced the wording of decision 12. Milestone 18 of that plan does
    this work, in its last pull request.
  - Since PR #249, `packages/viewer/src/shell/README.md` starts with a status
    line for that plan and describes the end state without the transform.
    Before, its line 200 described the transform.
  - On 2026-10-30, after PR #249 merged, two lines of
    `plans/ui-package-shell-views.md` state old facts:
    - Its status line, at line 3, says that PR #249 is open. PR #249 merged
      as `14c6f9ec` on 2026-10-30.
    - Its introduction, at line 34, puts the removal of the embedded
      selector transform out of scope. But the user's choice of 2026-10-30
      drops the transform. The plan's own transform rule, updated that day,
      and its theme work on the shell root with the reset class remove it.
- **Task:** Since 2026-10-29, `plans/ui-package-shell-views.md` holds tasks 2
  to 7 in one plan.
  1. Move the chrome components into `@mokly/ui`. Done by PR #249 on
     2026-10-30.
  2. Move the controls into `@mokly/ui`, in a later pull request of that
     plan.
  3. Move the inspector components, in a later pull request of that plan.
  4. Move the preview components, in a later pull request of that plan.
  5. Move the shell tokens into `@mokly/ui`. Since the user's decision of
     2026-10-30, they live on the shell root element in the stylesheet that
     `@mokly/ui/styles.css` carries. The user's decision of 2026-10-28 keeps
     that file as the only stylesheet subpath. This task first named
     `@mokly/ui/tokens.css`.
  6. Remove the embedded selector transform once every shell rule is
     authored under the root class. Milestone 18 of the shell views plan
     does this in its last pull request.
  7. In each slice, make the design library render the moved components
     through the package, and delete its own copies and their styles.
     PR #249 did this for the chrome slice.
  8. For the owner of `plans/ui-package-shell-views.md`: in a later pull
     request of that plan, correct its two stale lines. Make the status line
     say that PR #249 merged as `14c6f9ec` on 2026-10-30. Make the
     introduction keep the removal of the embedded selector transform in
     scope, as the user's choice of 2026-10-30 does. This is plan upkeep
     after the merge. It is no gate and no prerequisite, and the other work
     does not stop for it.
- **Impact if no action:** The shell and the design library keep two
  implementations of the remaining components. Browser specs must keep the
  copies in step, and the copies still drift.
- **Needs:** Nothing new. The user's request of 2026-10-29 covers every
  remaining slice, and `plans/ui-package-shell-views.md` holds them in one
  plan. The task needs no deployed change and no credentials.
- **Done when:** Every presentational shell component that reads no store
  lives in `@mokly/ui`, the shell tokens ship in the stylesheet that
  `@mokly/ui/styles.css` carries, and the embedded selector transform is
  gone. Until the user's decision of 2026-10-30, this line named
  `@mokly/ui/tokens.css`. The branch that completes the last slice deletes
  this item, as the `plans` skill says for a fixed item. Task 8 is done when
  the two plan lines state the current facts, or when the plan's last pull
  request deletes the plan.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/ui-package.md?plain=1#L533).
