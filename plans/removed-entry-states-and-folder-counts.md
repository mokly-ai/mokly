# Removed Entry States And Closed Folder Counts

Status: Active until its pull request merges. Created 2026-10-05 with the
user's consent, as the design-first group of the path identity review
follow-up. Milestones 1–5 are complete and pushed. The gate passes except for
the fixed fixture budget of third-review item 8 on this machine. The fresh
review found six Low findings, which await the user's decision.

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

Status: Complete.

- [x] Write the design tests first and see them fail:
  - [x] `tests/design_folder_counts.test.ts`: every folder row in every
        generated design document has a positive count. It failed on the
        documented 120 rows before the fix and checks 801 folder rows.
  - [x] `tests/design_navigation_sections.test.ts`: the helper counts the
        written rows of a closed folder without drawing them, draws an open
        folder's rows, never counts a variant row, counts a child folder
        once, omits a folder with no rows in a section, and counts each
        section separately. Four of its seven tests failed before the fix.
- [x] Change the helper in `catalogue-navigation-sections.ts`, remove `count`
      from the row schema, and give the row view the drawn row type.
- [x] Write the rows of the depicted `Browse shell` and `Changes` folders,
      replace `NAV_TREE.slice(0, 3)` in the library's `changes` example with
      a complete Changes list, and delete every typed `count`, including the
      tag-filter rows that the runtime prop check rejected.
- [x] Extend the library empty state with an optional list of entry links
      and a `moved-variants` saved example, with its styles.
- [x] Add the `Moved variants` child gallery and its `removed-parent` screen:
      Changes lists `Link button · Removed`, `Quiet · Moved` under Action and
      `Inline · Moved` under Toolbar. The page has no variant bar and no
      comparison band. Its stage lists `Action › Quiet` and
      `Toolbar › Inline`. Details are open and show no `Location`.
- [x] Add a `Location` row to the existing removed depictions inside a
      folder: the removed screens and variants (`Example › Screens`), the
      removed documents (`Example › Handbook`), the light-only removed
      document (`Account › Billing & Payments`), the removed Compact variant
      (`Example › Components`) and the removed Farewell consumer.
- [x] Contract gap found while depicting the Props tab: the product tells a
      page without variants to choose an available saved variant. Define
      `This component has no saved variants to edit.` in
      `mokly-component-workspace-design.md`, and depict it.
- [x] Update the screen counts in `examples/basic/README.md` and the design
      docs. Add `tests/design_removed_entry_states.test.ts` for the new
      artboard and the `Location` rows.
- [x] Update the counts that design tests pin: 40 component design screens,
      70 component variants and 112 design screens. Let the documented
      count test read a one-word count such as `forty`.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      the design unit tests and the component and design browser specs.
- [x] Smoke-test the changed pages through `npm run dev` at mobile and
      desktop widths.

Verification: `npm run example:check` reports 476 valid files. All design and
component-design unit tests pass, including the attribution run with the new
40-screen and 70-variant scopes. Before and after the helper change, the only
changed navigation rows in the 61 affected artboards are the two closed-folder
counts and the library's `changes` example. 49 component and design browser
tests pass. In Serve, the new artboard and the home artboard render at 1440 and
390 pixels with no page error.

## Milestone 3: Moved-variant lookup

Add the data operation that the shell needs. No presentation changes.

Status: Complete.

- [x] Write failing pure tests in `tests/branch_point_lookup.test.ts`: two
      former parents, case folding, kind isolation, manifest order, a
      surviving donor, and no result for case-only renames or unpaired
      variants.
- [x] Add `movedVariants` to `catalogue_branch_point.ts`.
- [x] Update the shell README.

Verification: the new lookup test failed before the operation existed. All
seven lookup tests and both guard tests pass.

## Milestone 4: Removed-entry presentation

Tags: ui

Implement the designed states in the shared shell.

Status: Complete.

- [x] Add shared case `departed-variants` to the branch-point fixture set,
      with its pairs, its removed record and its lookup result in
      `tests/branch_point_fixture_data.test.ts`. It moved here from
      Milestone 3 because its browser checks need the new presentation.
- [x] Write failing shell tests first: a removed parent with moved variants
      renders no variant bar, the new copy and the links in the served and
      public shells; a removed parent with a removed variant keeps its bar
      and instruction; a top-level removed entry has no `Location` row, and
      a removed entry in a folder keeps it.
- [x] Hide an empty variant bar in `workspace_variant_bar.tsx`.
- [x] Render the moved-variant stage, and add its styles.
- [x] Show `Location` in `details.tsx` only when the folder titles are not
      empty.
- [x] Show `This component has no saved variants to edit.` in Props when a
      page has no variant row.
- [x] Add the `departed-variants` browser checks for Serve, export and the
      embedded viewer at desktop and mobile widths, and extend
      `move_removed_parent_delivery.test.ts` to read the rendered page.
- [x] Compare the product with the mockups at both widths.

Verification: the new shell test failed on the empty variant bar before the
fix, and the extended delivery test failed in Serve and export. With the fix,
both shell tests, all three delivery boundaries, the removed-preview shell
tests and the guard pass. The `departed-variants` case passes in Serve,
export and the embedded viewer at 1280 and 390 pixels (6 of 6), and all six
fixture-data cases pass. Type checks, ESLint and Prettier pass. The product
page matches the mockup's structure at both widths: no variant bar or
comparison band, the heading, the moved-variant links and Details without
`Location`.

## Milestone 5: Verification, commit, push and review

Status: Complete.

- [x] Run a real CLI smoke test in a scratch Git repository with
      `serve --base main` and `export --base main` at desktop and mobile
      widths. A top-level Link button was deleted after its Quiet and Inline
      variants moved to Action and Toolbar. In both hosts at 1280 and 390
      pixels, its page has no variant bar or comparison band, reads
      `Its variants moved to new places.`, links `Action › Quiet` and
      `Toolbar › Inline`, and has no `Location` row. Props reads
      `This component has no saved variants to edit.` Each link opens the
      moved variant. The only console errors are Chrome's expected
      blocked-script reports from the viewer's sandboxed `/static/` frames.
- [x] Merge `origin/main` (#133). Main removed `plans/README.md` with the
      user's approval; take that deletion for the one conflict, and keep this
      plan's index note in its status paragraph. The remerge diff lists only
      that path, and the branch deletes no file from main.
- [x] Run `cargo xtask check`. The repository and package suites pass. The
      first run stopped in the unit suite, where one fixed time budget (third
      review item 8) failed: the PostCSS report test took 2,591.7 ms against
      2,500 ms. The branch changes no file under `src/`, and in isolation
      the test passed two of three runs. The unmodified second run passed
      all 4,233 unit tests, and then 836 of 850 browser tests. The 14
      failures share the `ordinaryPreview` fixture, whose fixed 300 s setup
      limit (also item 8) this machine exceeds. With that limit raised
      locally and not committed, the fixture export took 337 s and 304 s on
      this branch and 296 s and 291 s on `origin/main`, and all 14 tests
      passed on both. The gate stops at the browser suite, so
      `cargo xtask check --suite hydration` ran separately and passed all 265
      tests. Logs are in `.context/gate.log`, `.context/gate2.log`,
      `.context/gate2-hydration.log` and `.context/preview-*.log`.
- [x] Record the outcomes and covering tests in the review record, and
      update this plan's status paragraph.
- [x] Run `git add -A`, commit with Conventional Commits, and push the
      branch.
- [x] After the push, a fresh reviewer uses
      `docs/implementation-review-prompt.md` against the complete diff from
      `origin/main` and reports findings without changing the
      implementation. The reviewer confirmed the approved fixes and found six
      Low findings, recorded in the
      [review record](../docs/reviews/path-identity.md#design-follow-up-review)
      for the user's decision. No finding was fixed during the review.

## Post-merge follow-up (non-blocking)

- None.
