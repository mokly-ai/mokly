# Canvas indexes predate the Storybook stories folder

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 1,
  finding 5.
- **Location:**
  - `docs/protocol/mokly-shell-canvas-inventory.md:7-12`, the folder summary,
    and `:80-83`, the family totals.
  - `examples/basic/README.md:173-175`, the same totals.
  - `docs/protocol/mokly-shell-design-catalogue.md:32-64`, the section
    "Depicted Branches" and its table.
  - `docs/protocol/mokly-shell-design.md:155-157`, the order of the Details
    rows.
- **Reason:** The branch that found it may edit only the component and
  controls design pages. So the orchestrator of the Storybook support plan
  edits these pages after that branch merges into
  `calummoore/mokly-storybook-integration`.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Canvas family:** the design mockups of the Canvas viewer, authored
    under `examples/basic/specs/design/canvas/`, whose entry paths start with
    `design/canvas/`.
  - **Saved variant:** a design entry that belongs to a screen, through its
    catalogue field `variantOf`.
  - **Stories branch:** the depicted branch of the Storybook stories mockups,
    whose catalogue also holds the Menu stories file.
- **Background:**
  - On 2026-11-25, the branch
    `calummoore/storybook-milestone-1a-canvas-mockups-omnr` added the Canvas
    folder `design/canvas/stories`, "Storybook stories". The folder holds two
    screens and two saved variants.
  - The branch also added the saved variants
    `design/canvas/props/states/later-edit` and
    `design/canvas/props/states/later-pending`.
  - Three pages list the family. The Canvas inventory lists six folders, the
    loading, search and evidence inventory lists three, and the component
    design inventory lists three.
  - The three folders of the component design inventory are Component
    explorer, Props and controls, and Storybook stories.
  - Their tables list 22, 9, and 12 screens, and 28, 16, and 27 saved
    variants. That is 43 screens and 71 saved variants in twelve folders.
  - The source agreed on 2026-11-25. `examples/basic/specs/design/canvas/`
    held 43 `defineScreen` calls, 71 saved variants in its `artboardStates`
    calls, and twelve `_folder.json` files. The twelve folders are the
    `Canvas viewer` folder and eleven child folders.
  - Line 7 of `docs/protocol/mokly-shell-canvas-inventory.md` still says "six
    of the family's eleven folders". The sentence after it names only two
    folders of the component design inventory.
  - Line 81 of that page says "The family holds 41 screens and 67 saved
    variants."
  - `examples/basic/README.md:173-174` says "41 screens and 67 saved variants
    in eleven folders".
  - The table of the section "Depicted Branches" of
    `docs/protocol/mokly-shell-design-catalogue.md` names each depicted branch
    of its own: its change, its Changes count, and its Canvas states. It has
    no row for the stories branch.
  - `docs/protocol/mokly-shell-design.md:155-157` gives the order of the
    Details rows of Inspect: "Path, Source, Address, Moved from, Schemes,
    Changed views, Tags, Related docs, Dependencies and Used by".
  - The stories mockups draw a Story row directly after Source, then a
    Storybook row. The section "Storybook Stories" of
    `docs/protocol/mokly-component-design.md` gives these rows.
  - The shell does not draw these two rows yet. The status line of
    `docs/protocol/mokly-component-design.md` says so. It links the plan
    milestone that adds them, "Milestone 28: The Storybook link in the shell"
    of `plans/storybook-support.md`.
- **Problem:** The family totals, the folder summary, the branch table, and
  the order of the Details rows describe the catalogue before the stories
  folder.
- **Impact if no action:** Readers get obsolete totals, an incomplete list of
  the depicted branches, and an incomplete order of the Details rows.
- **Root question:** How do readers find the complete set of Canvas designs,
  their depicted branches, and the Details rows?
- **Options:** The letters follow the options of the review finding and of
  its finding check on the source branch. On 2026-11-25 the branch chose D
  of the check: the orchestrator applies A after the merge.
  - **A.** Keep the totals, and update every page. Effort: Small.
    - Recount from the source first. Count the `defineScreen` calls and the
      saved variants under `examples/basic/specs/design/canvas/`. Or count
      the `design/canvas/` entries in the `mokly-viewer/index.json` of a
      fresh build, where an entry with `variantOf` is a saved variant.
    - In `docs/protocol/mokly-shell-canvas-inventory.md:7-12`, write "six of
      the family's twelve folders". Name the Component explorer, Props and
      controls, and Storybook stories folders of the component design
      inventory.
    - In `docs/protocol/mokly-shell-canvas-inventory.md:81`, write that the
      family holds 43 screens and 71 saved variants.
    - In `examples/basic/README.md:173-174`, write the same totals, in twelve
      folders.
    - In the section "Depicted Branches" of
      `docs/protocol/mokly-shell-design-catalogue.md`, add a row for the
      stories branch.
    - Its Change cell: the catalogue also holds the Menu stories file, its
      Expanded story could not render, and the branch adds its Disabled
      story. Its Changes count: `2: Expanded and Disabled`. Its Canvas states:
      `design/canvas/stories/failed`, `design/canvas/stories/storybook`, and
      their variants.
    - In `docs/protocol/mokly-shell-design.md:155-157`, add the Story and
      Storybook rows directly after Source.
    - That page then gives rows that the shell does not draw yet. So it needs
      a status line that links
      `../../plans/storybook-support.md#milestone-28-the-storybook-link-in-the-shell`,
      as the status line of `docs/protocol/mokly-component-design.md` does.
    - That page has 248 lines. The repository gate fails a changed protocol
      page above 250 lines, and `xtask/protocol-document-caps.json` holds no
      exception. So the edit adds at most two lines, or it splits the page,
      as the `documentation` skill says.
  - **B.** Remove the repeated family totals. Let the index point to the
    owning inventories and to the description of the stories branch. Readers
    follow these links for the details. B removes text that is on
    `origin/main`, so it needs the user's approval. Effort: Small.
  - **C.** Do A, but remove the family totals in place of updating them.
    These are the "eleven" at line 7 and the sentence at line 81 of the
    Canvas inventory, and the totals of the example README. The totals then
    cannot go stale again. C removes text that is on `origin/main`, so it
    needs the user's approval. Effort: Small.
- **Left out:**
  - Removing the new designs: it undoes the mockup milestone.
  - Moving the stories states into an existing folder: the Component
    explorer and the Props and controls folders each hold five screens. That
    is the cap at `docs/protocol/mokly-shell-canvas-inventory.md:82-83`.
  - A generator, a test, or a lint of the totals: `AGENTS.md` forbids a test
    that asserts the words of a protocol page, and a new gate needs the
    user's approval.
- **Wider fix:** None. The `documentation` skill already requires related
  pages to agree with the change.
- **Previous examples:** Commit `3e09c6150` added a design variant and left a
  copied test count stale, as
  [design-screen-lists-single-source.md](design-screen-lists-single-source.md)
  records.
- **Recommendation:** A. It makes the indexes agree with the authored
  catalogue, keeps their format, and removes no text from `origin/main`.
- **Action:** fix after merge, apply A, because the pages lie outside the
  files that the branch that found it may edit.
