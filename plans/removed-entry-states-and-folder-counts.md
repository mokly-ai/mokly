# Removed Entry States And Closed Folder Counts

Status: Active until its pull request merges. Created 2026-10-05 with the
user's consent, as the design-first group of the path identity review
follow-up.

**Goal:** Fix three Low findings from the
[second path identity review](../docs/reviews/path-identity.md#second-review)
that need design work before code:

- **Finding 7.** A removed component whose variants all moved to other
  components shows an empty `Variant` bar. Its stage tells the user to
  select a comparison, but the page has no comparison control.
- **Finding 12.** A removed entry that was not in a folder shows an empty
  `Location` row in Details.
- **Finding 13.** The mockup navigation helper counts only the rows that it
  draws, and it removes counts that an author types. So 120 folder rows in
  61 artboards (38 screens) show no count, but the product keeps the count
  of a closed folder.

The user grouped findings 7 and 12 as one item (option A) and finding 13 as
another (option A, with a design test).

**Approved approach:**

1. Design both removed-entry states first. Then hide an empty variant bar,
   and list where the variants went. Do not say that no previous version
   exists: the previous versions are with the moved variants. Show
   `Location` only for a removed entry that was inside a folder.
2. Authors always write the rows in a folder. The mockup helper counts them,
   and draws them only when the folder is open. Authors cannot type a count.
   A design test makes sure that every folder row in every artboard has a
   count.

**Architecture:**

- The [branch-point lookup](../docs/protocol/mokly-branch-point-lookup.md)
  gets one more operation, `movedVariants(parent)`. It returns the current
  variants whose accepted move pair names a former variant of that parent.
  A variant's path is its parent's path plus its slug, so the former parent
  is the previous path without its last segment. The lookup works the same
  in Serve, export and the embedded viewer, because each host has the move
  pairs.
- The shell computes the list from the lookup when it renders the stage. The
  workspace data and its hydration JSON do not change.
- The mockup helper derives every folder count from the authored rows. The
  row schema has no `count` field, so the compiler rejects a typed count.

**Decisions (raise before implementing if the user should reconsider):**

1. The new list appears only when a removed parent has no variant row. A
   removed parent that keeps a removed variant keeps its bar, its comparison
   band and the current instruction. Its moved variants appear only at their
   new places.
2. Stage copy: `This component was removed`, then `Its variants moved to new
places.` (`Its variant moved to a new place.` for one), then one link per
   moved variant, labelled `<parent title> › <variant title>`. If another
   kind took every former variant's path, only the heading remains.
3. The new mockup is a component explorer state in a new child gallery,
   `design/components/states/moved-variants/removed-parent`. Its fixture is a
   top-level `Link button` component, so the same artboard also depicts a
   removed entry with no `Location` row.
4. Every existing depiction of a removed entry inside a folder gets a
   `Location` row in the product's metadata-row form, so no mockup
   contradicts the rule.
5. The depicted `Browse shell` and `Changes` folders hold three and two
   screens. They stay closed, so only their counts show.

## Milestone 1: Contracts

Define the complete contract before any mockup or code changes.

Status: Complete.

- [x] Record the user's decision in `docs/reviews/path-identity.md`: second
      review findings 7, 12 and 13, option A, delivered by this plan.
- [x] `mokly-branch-point-lookup.md`: add a `Moved Variants` section for
      `movedVariants`, add it to the consumers, and add shared case 6 (a
      top-level component deleted after its two variants move to two other
      components) to the verification list.
- [x] `mokly-component-workspace-design.md`: define the removed-parent
      presentation (decisions 1 and 2) and name the new artboard.
- [x] `mokly-shell-design.md`: add `Location` to the Details metadata rows,
      shown only for a removed entry that was inside a folder.
- [x] `mokly-catalogue-changes.md`: link the removed-entry Details to that
      rule.
- [x] `mokly-design-component-library.md`: catalogue navigation rows have no
      `count`; the component counts the written rows, keeps the count while
      a folder is closed, draws a folder's rows only while it is open, and
      omits a folder with no rows in a section. The empty state gains an
      optional list of entry links and a `moved-variants` example.
- [x] `mokly-component-design.md`: add the new artboard to the inventory, the
      new child gallery, and the new screen counts.
- [x] `mokly-shell-design-catalogue.md`: describe the depicted `Design`
      folder's rows and the `Location` rows of the removed depictions.
- [x] Link `mokly-moves.md` to the new removed-parent presentation.
- [x] Run Prettier and the protocol, guide and Markdown-link tests.

Verification: Prettier passed. The protocol, guide and Markdown-link run passed
all 17 tests. `mokly-shell-design.md` stays at its 351-line cap and
`mokly-component-design.md` at 250 lines.

## Milestone 2: Mockups

Tags: mockup

Depict both removed-entry states and fix the folder counts in every
artboard.

Status: Not started.

- [ ] Write the design tests first and see them fail:
  - [ ] `tests/design_folder_counts.test.ts`: every folder row in every
        generated design document has a positive count.
  - [ ] `tests/design_navigation_sections.test.ts`: the helper counts the
        written rows of a closed folder without drawing them, draws an open
        folder's rows, never counts a variant row, counts a child folder
        once, omits a folder with no rows in a section, and counts each
        section separately.
- [ ] Change the helper in `catalogue-navigation-sections.ts`, remove `count`
      from the row schema, and give the row view the drawn row type.
- [ ] Write the rows of the depicted `Browse shell` and `Changes` folders,
      replace `NAV_TREE.slice(0, 3)` in the library's `changes` example with
      a complete Changes list, and delete every typed `count`.
- [ ] Extend the library empty state with an optional list of entry links
      and a `moved-variants` saved example, with its styles.
- [ ] Add the `Moved variants` child gallery and its `removed-parent` screen:
      Changes lists `Link button · Removed`, `Quiet · Moved` under Action and
      `Inline · Moved` under Toolbar. The page has no variant bar and no
      comparison band. Its stage lists `Action › Quiet` and
      `Toolbar › Inline`. Details are open and show no `Location`.
- [ ] Add a `Location` row to the existing removed depictions inside a
      folder: the removed screens and variants (`Example › Screens`), the
      removed documents (`Example › Handbook`), the light-only removed
      document (`Account › Billing & Payments`), the removed Compact variant
      (`Example › Components`) and the removed Farewell consumer.
- [ ] Update the screen counts in `examples/basic/README.md` and the design
      docs. Add design tests for the new artboard and the `Location` rows.
- [ ] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      the design unit tests and the component and design browser specs.
- [ ] Smoke-test the changed pages through `npm run dev` at mobile and
      desktop widths.

## Milestone 3: Moved-variant lookup

Add the data operation that the shell needs. No presentation changes.

Status: Not started.

- [ ] Write failing pure tests in `tests/branch_point_lookup.test.ts`: two
      former parents, case folding, kind isolation, manifest order, a
      surviving donor, and no result for case-only renames or unpaired
      variants.
- [ ] Add `movedVariants` to `catalogue_branch_point.ts`.
- [ ] Add shared case `departed-variants` to the branch-point fixture set,
      with its pairs, its removed record and its lookup result in
      `tests/branch_point_fixture_data.test.ts`.
- [ ] Update the shell README.

## Milestone 4: Removed-entry presentation

Tags: ui

Implement the designed states in the shared shell.

Status: Not started.

- [ ] Write failing shell tests first: a removed parent with moved variants
      renders no variant bar, the new copy and the links in the served and
      public shells; a removed parent with a removed variant keeps its bar
      and instruction; a top-level removed entry has no `Location` row, and
      a removed entry in a folder keeps it.
- [ ] Hide an empty variant bar in `workspace_variant_bar.tsx`.
- [ ] Render the moved-variant stage, and add its styles.
- [ ] Show `Location` in `details.tsx` only when the folder titles are not
      empty.
- [ ] Add the `departed-variants` browser checks for Serve, export and the
      embedded viewer at desktop and mobile widths, and extend
      `move_removed_parent_delivery.test.ts` to read the rendered page.
- [ ] Compare the product with the mockups at both widths.

## Milestone 5: Verification, commit, push and review

Status: Not started.

- [ ] Run a real CLI smoke test in a scratch Git repository with
      `serve --base main` and `export --base main` at desktop and mobile
      widths.
- [ ] Run `cargo xtask check`.
- [ ] Record the outcomes and covering tests in the review record, and
      update this plan and `plans/README.md`.
- [ ] Run `git add -A`, commit with Conventional Commits, and push the
      branch.
- [ ] After the push, a fresh reviewer uses
      `docs/implementation-review-prompt.md` against the complete diff from
      `origin/main` and reports findings without changing the
      implementation.

## Post-merge follow-up (non-blocking)

- None.
