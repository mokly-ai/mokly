# Path Identity Follow-up

Status: Active. Created 2026-10-05 with the user's consent. This plan fixes
the open review items of [Path Identity](./path-identity.md), which merged in
PR #131 (`c4138a0`). The work uses the existing workspace branch
`calummoore/filenav-review-items` and one new pull request. Milestone 1 is
complete.

## Scope And Decisions

The verified and merged review items, their evidence and the user's decisions
are in the
[review record](../docs/reviews/path-identity.md#follow-up-decisions). The
user approved the recommended option for every item except these:

- Item 3 (a link fragment to a file that is not HTML stops the build) waits
  for the user's decision. This plan does not include it.
- Items 8 and 12 (pages for removed entries, and the mockup folder counts)
  are skipped. They stay open in the review record.

| Item | Decision                                                    | Milestones  |
| ---- | ----------------------------------------------------------- | ----------- |
| 1    | C: shared lookup in all layers, then distinct path types    | 3, 4, 9, 10 |
| 2    | A: read each record's own snapshot side paths               | 5           |
| 4    | A: pair moved resources from the references in both renders | 5           |
| 5    | A: lists keep the saved choice under a filter               | 2, 6        |
| 6    | B: one contract list of the events that reset the mode      | 7           |
| 7    | B: count work, not time; one time-limit rule                | 8           |
| 9    | A and B: plain-text crumb, and an immediate reveal end      | 6           |
| 10   | A: remove the parent check for component pages              | 4           |
| 11   | A: reject the invalid move record when Mokly reads it       | 3           |
| 13   | A: new search summary, guide rule, drift test               | 1, 8        |
| 14   | B: one console capture, a guard test, exact rule            | 8           |
| 15   | A: close the previous plan and correct the evidence labels  | 1           |

Items 6 and 9 change behaviour only. Item 5 removes a list button that one
approved mockup shows, so Milestone 2 updates that mockup before the UI work.
Backend, tooling, mockup and UI work stay in separate milestones.

## Milestone 1: Contracts, guides and plan close-out

Update every contract, guide and record that the later milestones implement.
Documentation only. Complete.

- [x] Close [Path Identity](./path-identity.md): set its status to complete,
      move it to Completed in [the plan index](./README.md), and point to
      this plan for open work. Add this plan to Active.
- [x] Record the follow-up decisions in the review record, and correct the
      Milestone 18 evidence labels (item 15).
- [x] Group 1 contracts (items 1, 10, 11): one lookup for the projection,
      the readers, the data helpers and the shell; usage component names as
      sided references; removed-variant order through the lookup; typed
      branch-point references; reader rejection of a move record whose
      previous path a current same-kind entry uses; new shared fixture cases
      6 to 8.
- [x] Group 2 contracts (items 2, 4): `reviewSnapshotViewPath` reads each
      side's own address; the exact checks that export, publication and
      Serve's complete comparison run; moved stylesheets pair from the
      references in both renders, never from `sourcePath`.
- [x] Group 3 and 4 contracts (items 5, 6, 9): the list state in
      `mokly-variant-navigation.md`; Collapse all closes lists; a folder
      crumb is a reveal only when All without search shows its row; a reveal
      that cannot complete ends at once; the comparison mode lifetime.
- [x] Group 5 contracts (items 7, 14): the new
      [test rules page](../docs/protocol/ci-verification-test-rules.md) with
      `scaledTimeLimit`, the time-limit guard and the console rule.
- [x] Guides and READMEs (item 13): a new search summary in both catalogue
      guides, the guide rule in `mokly-guides.md`, the stale shell README
      statement and the `light-only-current` design statement.
- [x] Validate the changed Markdown with the documentation tests, and review
      the diff.

## Milestone 2: List button mockup

Tags: mockup

Make the approved mockups follow the list state of item 5: a list with no
visible row has no button.

- [ ] In `examples/basic/specs/design/parts/variant_nav_data.ts`, remove the
      closed "Show variants of Welcome" button from the
      `design/browse/variants/changed-views` state, because Changes shows no
      Welcome variant. Update `tests/design_variant_changes.test.ts`.
- [ ] Check every other filtered-state mockup for a list button whose list
      has no visible row, and correct each one in both variants.
- [ ] Run `npm run build`, `npm run example:build` and
      `npm run example:check`, run the design tests, and smoke-test the
      changed pages at mobile and desktop widths through `npm run dev`.

## Milestone 3: Shared branch-point lookup in the data layer

Move the lookup out of the shell and use it in every data layer (item 1,
step 1). Reject invalid move records at the reader (item 11). Complete.

- [x] Move the lookup to a shared catalogue module that the server
      projection imports from `@mokly/viewer/data`, and that both catalogue
      readers, the review-result reader, the data helpers and the shell use.
      Keep its public behaviour.
- [x] Add one operation that resolves a usage component name on a given
      side.
- [x] Projection: order removed variants at their resolved parent, in
      baseline authored order (item 1b).
- [x] Projection and readers: keep removed-screen usage whose component
      resolves through a move or a case-only rename; validate instance
      component names through the lookup; never rewrite a stored name (item
      1a, data).
- [x] `catalogueComponentVariants` and the usage scope use the lookup
      (item 1c), and the scoped bootstrap follows `mokly-shell-bootstrap.md`.
- [x] Replace the counterpart copy in `src/catalogue/changes.ts` with the
      lookup.
- [x] Both catalogue readers and the review-result reader reject a previous
      path that a current entry of the same kind uses, with case folding.
      Reuse by another kind stays valid. The review-result reader validates
      move records before it resolves references. Add negative and positive
      tests.
- [x] Add shared Git fixture cases 6 to 8 and their node tests.
- [x] Extend the guard test to the catalogue data layer and the server
      projection, add usage component name rules, and fix the Windows path
      comparison with a test for both separators.
- [x] Update `src/catalogue/README.md`, `packages/viewer/README.md` and the
      guard comment.
- [x] Run the related unit tests, type checks and lint.

## Milestone 4: Shell consumers of the shared lookup

Tags: ui

Use the lookup for usage labels and links in every host, and show nested
input values for a variant that moved to a new component (items 1 and 10).

- [ ] Component labels, the Props "Open component" link, Highlight labels
      and the embedded "Used by" list resolve usage names through the lookup.
- [ ] Remove the parent check in `workspace_input_changes.ts` for component
      pages, and keep it for screens.
- [ ] Correct the lookup claims in `packages/viewer/src/shell/README.md`.
- [ ] Add fixture cases 6 to 8 to the Serve, export and embedded viewer
      browser checks at desktop and mobile widths.
- [ ] Run the related unit and browser tests, and smoke-test Serve and export
      on a scratch Git repository.

## Milestone 5: Recorded locations in the comparison engine

Read recorded locations instead of rebuilding them (items 2 and 4).

- [ ] Add `reviewSnapshotViewPath(side, record, view)`. The resource-evidence
      check, the selected comparison, the public review, removed previews
      and `scripts/package/export.mjs` use it. A guard test permits direct
      snapshot path construction for review records only in this helper.
- [ ] Test case-only screen and variant renames with resource evidence in
      Serve's complete comparison and in repository publication
      (`preview:build --include-changes`).
- [ ] Read move resources for every paired view whose generated references
      differ, and remove the stylesheet route guess from `sourcePath`. Keep
      the asset directory mapping.
- [ ] Test an exporting-module move with a declared path, a file that becomes
      a folder `index`, a renderer folder move, component variants, a
      stylesheet edit together with a route move, and live Changes. Measure
      the live Changes time before and after.
- [ ] Update `src/review/moves/README.md`.
- [ ] Run the related unit tests, type checks and lint, and smoke-test Serve
      and export.

## Milestone 6: Navigation visibility rules

Tags: ui

Make list buttons and folder crumbs follow one visible-row rule (items 5
and 9).

- [ ] A list is open only when its saved choice is open and it has a visible
      row in the active selection. A list without a visible row has no
      button. Collapse all closes lists in every filter state.
- [ ] A folder crumb is a reveal only when All without search shows its row;
      otherwise it is plain text. A reveal that no filter change can complete
      ends at once.
- [ ] Add unit tests and browser tests under All, search and Changes.
- [ ] In `docs/guides/catalogue/browse.md`, replace "When that folder is
      hidden, or sits inside a hidden folder, the breadcrumb is plain text
      instead." with "When All shows no row for that folder, because it is
      hidden, sits inside a hidden folder, or holds only hidden folders, the
      breadcrumb is plain text instead." After "Collapse all closes it with
      everything else.", add "A list you close while you search or view
      Changes stays closed, and a parent shows no chevron when its list has
      nothing to show."
- [ ] Update `packages/viewer/src/shell/README.md` for the crumb and list
      rules.
- [ ] Run the related tests, and smoke-test the shell in a browser.

## Milestone 7: Comparison mode lifetime

Tags: ui

Keep the selected comparison mode until a listed reset event (item 6).

- [ ] Remove the evidence revision from the mode owner. Adopting a newer
      evidence revision renews only a loaded live comparison.
- [ ] A view or sibling without changes shows Current, keeps the selected
      mode, and the next eligible view or sibling applies it. A live update
      resets to Current.
- [ ] Use `reviewSnapshotViewPath` in the shell comparison selection.
- [ ] Add a Serve test that opens a newly rendered entry without a warm-up
      step. Remove the warm-up step or correct its comment.
- [ ] Remove the evidence-revision sentences from
      `packages/viewer/src/shell/README.md`.
- [ ] Run the related unit and browser tests, and smoke-test Serve.

## Milestone 8: Test-suite rules

Make time limits and console checks follow one shared rule (items 7, 13 and
14). Tooling and tests only.

- [ ] The PostCSS dependency test counts sorts and root projections through
      an injected seam. Time stays a diagnostic.
- [ ] Add `scaledTimeLimit` and `MOKLY_TEST_TIME_SCALE`. The
      `ordinaryPreview` fixture builds only what its tests need.
- [ ] Move every fixture setup limit to `scaledTimeLimit`: the
      `ordinaryPreview` worker fixture and the `test.setTimeout` calls in
      `beforeAll` hooks. Move other fixed time assertions to work counts or
      to the scaled limit. Add the time-limit guard test.
- [ ] Anchor the console rule, and make `/site/static/` a rejected case.
- [ ] Move `captureBrowserErrors` into `console_notices.ts`. It records
      console errors and page errors. A guard test rejects other console
      listeners, with an allowlist for the two checks that read one message
      type.
- [ ] Give the embedded test host page an empty icon as a same-origin file,
      not a `data:` URL, because the strict-CSP host blocks `data:` images.
      Remove the `favicon.ico` exception.
- [ ] Add a guide test that the search summary names each field of the
      folder contract's search rule.
- [ ] Update the setup-limit paragraph in `ci-suite-evidence.md`, and the
      Delivery Status of `ci-verification-test-rules.md`.
- [ ] Run the related unit and browser tests.

## Milestone 9: Typed branch-point references in the data layer

Give branch-point references and current paths distinct types (item 1,
step 2). The shell keeps compiling and adopts the types in Milestone 10.

- [ ] Write the type design in this plan before code changes: the two path
      types, where readers brand values, generic entry types, and the
      escape routes that the type-aware guard must reject. A removed
      record's own path is its current address; its `variantOf`, usage
      names, `previousPath` values and baseline inventory paths are
      branch-point references.
- [ ] Readers, the projection and the lookup produce and accept the typed
      values. Test fixtures use typed helpers.
- [ ] Add the type-aware guard for the data layer.
- [ ] Run the unit tests, type checks and lint.

## Milestone 10: Typed branch-point references in the shell

Tags: ui

- [ ] The shell and the embedded viewer use the typed values, and the
      type-aware guard covers them.
- [ ] Remove guard rules that the types now enforce.
- [ ] Run the unit and browser tests.

## Milestone 11: Verification, commit and review

- [ ] Run the full smoke cases in Serve and export at desktop and mobile
      widths.
- [ ] Run `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch. Confirm that the
      push deletes nothing on `origin/main` without approval.
- [ ] After the push, a fresh reviewer uses
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete diff from `origin/main`, and reports findings
      without changing the implementation.
