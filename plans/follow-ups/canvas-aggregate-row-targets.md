# Canvas catalogues set aggregate row targets by hand

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 1,
  finding 3. It is the wider fix C with E of the finding check, which the
  branch split off its direct fix.
- **Location:**
  - `examples/basic/specs/design/canvas/parts/catalogue.tsx:62-85`, where
    `CanvasCatalogue` gives each row its link.
  - `examples/basic/specs/design/canvas/stories/parts/branch.ts:183-222`, the
    local rule of the stories branch.
  - `examples/basic/specs/design/canvas/components/parts/branch.ts:82-98`,
    the Action row that three branches share, and `:141-158` and `:205-238`,
    the rows and targets of the removal branch.
  - `examples/basic/specs/design/parts/variant_nav_data.ts:31` and `:52`, and
    `examples/basic/specs/design/canvas/outcomes/parts/removed_branches.ts:147`,
    the rows of Welcome's variant group.
  - `examples/basic/specs/design/library/chrome/catalogue-navigation.tsx:22-50`,
    the row schema, and
    `examples/basic/specs/design/library/chrome/catalogue-navigation-sections.ts:107`,
    which always sets `changedVariants: false`.
  - `examples/basic/specs/design/library/chrome/catalogue-navigation.view.tsx:60-66`,
    which marks as current each row that opens the shown artboard.
  - `docs/protocol/mokly-design-links-navigation.md:11-12` and `:66-89`, the
    section "Screen Variants", and
    `docs/protocol/mokly-component-design-inventory.md:117-119`.
- **Reason:** C changes the shared Canvas catalogue and the rows of two other
  branches, the removal branch and the removed-variant branch.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Changes filter:** the catalogue filter that lists changed, added,
    moved, and removed entries. The All filter lists the whole catalogue.
  - **Aggregate row:** an unmodified parent row that the Changes filter shows,
    because its list holds a changed, added, or removed variant.
  - **Picture:** a drawn control without an address. A Canvas mockup draws a
    control as a picture when no artboard shows its outcome.
  - **Branch fixture:** the rows and the row targets of one depicted branch,
    such as the stories branch in `canvas/stories/parts/branch.ts`.
- **Background:**
  - The section "Changes Rows" of `docs/protocol/mokly-variant-navigation.md`
    says that an aggregate row "opens its first visible changed variant". A
    parent that changed itself keeps the parent as the destination.
  - `packages/viewer/src/shell/changes_activation.ts:97-124` implements this
    rule, and a removed variant counts as a changed row. The browser test
    "Changes opens the first changed variant of an unmodified parent", at
    `tests/browser/comparison_variants.spec.ts:44`, covers it.
  - The design links rule at `docs/protocol/mokly-design-links-navigation.md:11-12`:
    a control opens the Canvas artboard that shows its outcome. A control
    without one is a depiction, a picture.
  - `CanvasCatalogue` draws every Canvas catalogue. The selected row opens the
    shown artboard. Each other row opens its entry in the view's `targets`, or
    keeps its own `to`. A row with neither is a picture.
  - The design library view marks as current the selected row and each row
    that opens the shown artboard. So a second link to the shown artboard
    draws a second selected row.
  - Three Canvas branches hold an aggregate row: the Menu on the stories
    branch, the Action on the removal branch, and Welcome on the
    removed-variant branch.
  - A fixture marks an aggregate row with `changed: true`, the same field as a
    changed parent. The Action branch, the direct-change branch, and the
    removal branch share one Action row, `ACTION_ROWS`. The Action changed on
    the first two branches only.
  - The shipped tree marks an aggregate row with `data-changed-variants="true"`
    and no `data-changed`. `tests/browser/comparison_variants.spec.ts:51` and
    `tests/browser/serve_removed_evidence.spec.ts:183` check this. The design
    library draws `data-changed="true"`, because `rowLink` always sets
    `changedVariants: false`.
- **Problem:** Each branch fixture must work out the target of its aggregate
  row by hand, and no shared code knows which rows are aggregate rows. The
  stories fixture first sent the Menu row of the Changes filter to the Menu's
  own page in All. The branch fixed that on 2026-11-25 with a local rule. The
  removal branch still draws its Action row as a picture where the product
  opens the removed Compact.
- **Screenshot:** The finding asked for a picture of the page that the Menu
  row opens from desktop Failed story in Changes. It boxes the All filter and
  the selected Menu row there. No picture was saved. Before the direct fix,
  the Menu row opened `design/canvas/stories/storybook`, the Menu's own page
  in the All filter.
- **Impact if no action:** Each new grouped change in a Canvas fixture can
  again send its parent row to the wrong artboard. The mockups then depict
  the wrong behaviour for a grouped change.
- **Root question:** How does every Canvas catalogue in the Changes filter
  send an aggregate row where the product sends it?
- **Options:** The letters follow the options of the review finding and of
  its finding check on the source branch. A and B pointed the Menu row at
  fixed or looked-up destinations in each Changes tab. The check replaced
  them with D, because on Expanded's own artboards they linked the Menu row
  to the shown artboard. The branch applied D in
  `canvas/stories/parts/branch.ts`.
  - **C.** Give the shared catalogue the rule for aggregate rows. Effort:
    Medium.
    - Add a row field that marks an aggregate row, such as
      `changedVariants`. Add it to the row schema of the design library's
      `catalogue-navigation`.
    - Map that field in `rowLink` in place of `false`. The depicted row then
      carries `data-changed-variants="true"`, as the shipped tree does.
      Remove `changed: true` from each aggregate row.
    - In the Changes filter, let `CanvasCatalogue` give a marked row the
      target of its first changed or removed variant row. Take the target of
      that row for the tab that the right panel shows.
    - Migrate the fixtures of the three branches, and remove the local rule
      of the stories fixture.
    - Split the shared Action row. It is a changed parent on two branches and
      an aggregate row on the removal branch.
    - The sample rows of `variant_nav_data.ts:31`, which the design library
      draws as pictures, can carry the mark too.
    - State the shared rule in the section "Screen Variants" of
      `docs/protocol/mokly-design-links-navigation.md`. Let the stories
      bullet at `docs/protocol/mokly-component-design-inventory.md:117-119`
      follow it.
  - **D.** Keep a local rule in each fixture, as the stories fixture does now.
    The parent row opens the artboard of its first changed variant on the
    same tab. It is a picture where that variant is the selected row. The
    next fixture must repeat the rule, and the removal branch lacks it today.
    Effort: Small for each fixture.
  - **E.** In `CanvasCatalogue`, draw a row as a picture when its link opens
    the shown artboard. The selected row keeps its link. Alone, E corrects no
    wrong target. In the build of 2026-11-24, no design view of 664 marked
    two catalogue rows current, so E alone changes no view. Effort: Small.
  - **F.** Replace the target tables of every fixture with one registry of
    Canvas artboards, by entry, filter, and tab. Each catalogue then derives
    every row link, the aggregate target, and the picture. F migrates every
    Canvas catalogue fixture and the design links table. Effort: Large.
- **Left out:**
  - Hiding the parent row in the Changes filter: the variant navigation
    contract requires the parent group.
  - A picture on every artboard of a branch: where an artboard shows the
    outcome, it breaks the design links rule.
  - A change to the product: it already follows the rule, and its browser
    test covers it.
  - A design catalogue check for the class: it needs the mark that C adds,
    and a new check needs the user's approval.
- **Wider fix:** C with E. On the artboards of the first changed variant, the
  target that C derives is the shown artboard, so C needs the guard of E.
- **Previous examples:**
  - Commit `549ab00a9` added the first-changed-variant rule to the product on
    2026-09-20.
  - Commit `54e0a948e` sent the Menu row of the stories branch to the Menu's
    own page.
  - `design/canvas/outcomes/removed-variant` draws Welcome's aggregate row as
    a picture by hand, because its first changed variant is the selected row.
- **Related:** [removal-branch-action-row-target.md](removal-branch-action-row-target.md)
  records the wrong Action row of the removal branch. C with E also fixes it,
  so the branch that applies C with E deletes that item too.
- **Recommendation:** C with E. One rule in the shared catalogue sends every
  aggregate row where the product sends it. E keeps the artboards of the
  first changed variant free of a second selected row.
- **Action:** fix after merge, apply C and E, because C changes the shared
  catalogue and the rows of artboards outside the Storybook mockups.
