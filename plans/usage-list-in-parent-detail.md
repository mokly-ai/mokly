# Keep A Component's Usage Lists In Its Parent Detail

Status: Active. [PR #223](https://github.com/mokly-ai/mokly/pull/223) is open. The plan closes when its PR merges.

Each screen and component has an entry detail: a JSON file that the Browse
shell fetches for the routed entry. A component's detail carries
`workspace.usedBy`, its Used by list, with one row for each direct or nested
use of the component in each view of each consuming entry. The list belongs to
the component. The projection keys it by the parent's path. It writes the same
list into the detail of the parent and of each saved variant. The `affected`
list, the consumers that a changed component affects, has the same copies.

Measurement on 2026-10-27 at `a9dd1e81`: `npm run build`, then
`npx mokly build --config examples/basic/mokly.config.json --out ../../.context/example`,
with Changes against `origin/main` at the same commit. The output has 2,382
files and 53.1 MB. The index and the 240 current details hold 22.8 MB.
`usedBy` holds 6.44 MB of compact JSON, and 1.22 MB of it is distinct. Each of
the 75 variant details carries a list equal to its parent's list.
`design/library/inspector/metadata-row` has 1,258 rows in 5 details of about
496 KB. Without the variant copies, the current details shrink from 20.78 MB to
13.68 MB. Each variant detail is a distinct file, so the content addressing of
`mokly publish` cannot remove these copies. A second build changed
`metadata-row` against the same base. Then each of the 5 details also carried
1,258 `affected` rows, and removing both copies saved 9.05 MB of 23.23 MB. The
evidence is in `.context/usage-list-in-parent-detail/`.

User decision (2026-10-27): A, item 3 of the content-caching investigation in
the workspace "Hash-Based Content Caching". Keep `usedBy` only in the parent's
detail, and let a variant's page read the list from that detail. The rejected
options were B, group the rows by the consuming screen with that screen's
views, C, do A and B, and D, make no change. The reason: A removes most of the
repeated bytes with one format change, because the copies are 81% of the
`usedBy` bytes. The decisions below extend or settle parts of this choice.

The change raises the entry detail version, to 3 when no other dedup change
raised it first. In the new version, the workspace of a current component
variant has no `usedBy` and no `affected`. The page of a current variant also
fetches the parent's detail and shows the parent's lists. Removed details and
the catalogue index do not change.

This change does not cover the other three dedup changes, the Mokly Cloud
code, or the follow-ups under [Other repeated fields](#other-repeated-fields).
The Usage panel keeps its screens and copy, so the change has no mockup
milestone.

Contract owners:

- [Shell delivery](../docs/protocol/mokly-shell-delivery.md) and the
  [format versions](../docs/protocol/mokly-format-versions.md).
- [Component pages](../docs/protocol/mokly-component-explorer.md),
  [component controls](../docs/protocol/mokly-component-controls.md), and the
  [embeddable viewer](../docs/protocol/mokly-viewer.md).
- [Static delivery](../docs/protocol/mokly-export-delivery.md) and
  [live evidence](../docs/protocol/mokly-live-evidence.md).
- The [`mokly-model` README](../crates/mokly-model/README.md), the
  [viewer README](../packages/viewer/README.md), and the
  [shell README](../packages/viewer/src/shell/README.md).

## Decisions

The user answered these on 2026-10-27.

1. Format numbering with the other dedup changes: A, one raise per release.
   - The first dedup change to merge raises the entry detail from 2 to 3. A
     later dedup change that merges before the next release keeps 3 and adds
     its rule to version 3. After a release ships 3, the next change raises
     it to 4.
   - Rejected: B, one raise per change. Each later change would rename the
     type, the fixture, and the docs again for numbers that no release ships.
   - Only released numbers reach users. The static output ships its own
     viewer, and a new Serve process forces a page load.
2. The variant page waits for the parent's detail: A.
   - The parent's detail joins the route's details, as the step screens of a
     use case do. The stage, Props, and Usage wait for both details. A failed
     parent detail makes the page unavailable with Try again.
   - Rejected: B, a separate Usage delivery for the parent's detail. It adds
     delivery state, and a first load already sends about as many bytes as
     before the change.
3. Also take `affected` from the parent: A. Current variant details drop
   `affected` in this change too.
   - Rejected: B, a later second format change. The same format change and
     the same parent fetch carry `affected`.
4. The core rejects lists on a current variant: A. This follows the
   misplaced-field rule of the
   [serialization contract](../docs/protocol/mokly-catalogue-serialization.md#versions).
   - Rejected: B, a check in tests only, which would change that rule.

## Design

### Format versions

- Entry detail: one number above the last release. Release 0.16.1 ships 2, so
  this change needs 3. Decision 1 covers a raise by another dedup change.
- The [serialization rule](../docs/protocol/mokly-catalogue-serialization.md#versions)
  requires a new number for a removal. Version 3 removes required fields from
  some records.
- The catalogue index, the live descriptor, the upload metadata, and the plan
  exchange do not change.

### Placement rule

- The workspace of a current component variant omits `usedBy` and
  `affected`.
- Screens, component parents, and removed entries keep both lists. A screen's
  lists are always empty and cost about 5 KB in the example.
- A removed variant keeps its own lists. Its `usedBy` is always empty, because
  a removed entry has no current uses. Its `affected` follows the base parent,
  which can be removed, moved, or known only by its title.

### Producers

- `Workspace.used_by` and `Workspace.affected` become optional and are omitted
  when absent. The generated TypeScript fields become optional.
- `projection_usage::workspaces` builds a list for each component parent, an
  empty list for each screen, and no list for a variant. It stops cloning the
  parent's list into each variant.
- `projection_workspace::apply` updates the eligibility of the rows that
  exist. It fills only lists that the incoming workspace already has. An
  absent list stays absent.
- `projection_removed::workspaces` keeps empty lists on every removed screen
  and component.
- The core keeps the version 2 requirement where the lists stay.
  `detail_validation::validate` requires them on a removed workspace, and
  `detail_context::validate_with` on a current screen or parent. Under
  Decision 4, `detail_context::validate_with` also rejects them on a current
  variant.
- The static build and Serve validate each detail before they write or
  publish it. Serve reuses the bytes of an unchanged detail, so a new consumer
  changes only the parent's detail.

### Viewer

- One helper names the detail that carries an entry's lists: the parent's
  detail for a current component variant, else the entry's own.
  `routeDetailRequests` and `publicWorkspace` both use it, so the request and
  the read cannot disagree.
- `routeDetailRequests` adds the request `{ path: variantOf }` for a current
  component variant. Screen variants and removed variants request only their
  own detail.
- `publicWorkspace` takes a current variant's `usedBy` and `affected` from
  the parent's held detail. `usageComplete` follows only that detail. A
  publication writes the workspace of every current screen and component, or
  of none, so the parent's workspace proves its lists. Usage never shows a
  zero that it did not read.
- The reader gates version 3 and reads both lists as optional. A removed
  workspace must carry both lists. The fence requires both on a current screen
  or parent. It ignores them on a current variant, because the viewer reads a
  variant's lists from the parent's detail.
- Under Decision 2, the route delivery covers both details, so the stage,
  Props, and Usage wait for both.

### Fetch, fences, and Serve updates

- The parent's detail takes the current-entry fence. A revision mismatch
  fetches the index once. Another `deploymentId` gives the replaced state: a
  page load in the standalone shell, and one `onError` in an embedded host.
- The controller aborts only the loads that the new route does not want. A
  sibling navigation therefore keeps the held parent detail and loads only the
  sibling's small detail.
- A Serve publication drops the held details of the older revision. The
  refresh loads the index and the route's details with the parent's, and
  adopts them in one commit. Usage rows keep their keys, so focus stays.
- A static build writes a detail for every current entry, so the parent's
  detail exists. An embedded host's `detail` source receives the parent's path.

### Compatibility with the other dedup changes

- Dedup 1 stops `deploymentId` from changing every detail, so it can change
  the current-entry fence. The parent's request uses that fence as it is at
  merge time, so it needs no more work.
- Dedup 4 writes a before snapshot only when it differs from the after
  snapshot. It can change the index or the detail version under Decision 1.
  It does not touch the workspace lists.
- Dedup 2 changes the upload transport only.
- Expect textual conflicts in `public_detail.rs`, `versions.rs`, the detail
  reader, the fixture, the generated types, and the version rows of the docs.
  The change that merges later merges `origin/main` under the `git-merge`
  skill and applies Decision 1.

### Other repeated fields

The same measurement compared each field of a variant's detail with its
parent's detail.

- `affected`: equal on a parent and its current variants. Decision 3 moves it
  with `usedBy`.
- A removed variant's `affected`: a copy of the base parent's list when that
  parent changed. Removed variants are rare, so plan a follow-up only when a
  measurement shows weight.
- `controlOrder` copies hold 2,410 bytes in total, and `identity` is part of
  the fence. No action for either. Dedup 1 owns `deploymentId`.

## Milestone 1: Documentation and protocol

State the requirements and the decisions that the code milestones implement.
Each protocol page that this milestone changes gets the status line until
Milestone 3 ends. The renames to version 3 and the links to the generated
version 3 type wait for Milestone 3, because the link check needs that file.

- [x] Record the user's answers to the open decisions in this plan, with the
      date.
- [x] `mokly-shell-delivery.md`: add the placement rule, its decision, and
      the rejected copies to Entry Detail. Add the parent's detail and its
      fence to Fetch And Fences. Add the unavailable rule of Decision 2 to
      Fetch And Fences, Updates In Serve, and Fail-Closed Rules.
- [x] `mokly-component-explorer.md`: a variant page shows its parent's lists.
      Usage shows `Loading usage…` until those details arrive.
- [x] `mokly-viewer.md`: the viewer also calls `detail` with the parent's
      path of a current variant. A current variant shows its parent's Used by
      and Affected lists.
- [x] `mokly-export-delivery.md` Static Navigation: a navigation fetches the
      destination's details, and the parent's detail carries a variant's
      lists. `mokly-live-evidence.md` Navigation races and Workspace
      evidence: the details of the route, not one detail.
- [x] `mokly-component-controls.md` and `mokly-component-controls-design.md`:
      Props waits for the route's details.
- [x] `mokly-format-versions.md`: the entry detail row, and the Decision 1
      rule that changes between two releases share one raise, with option B
      as the rejected alternative.
- [x] Add the status line below the title of each page above.
      `mokly-component-usage-records.md` needs no change, because every
      variant keeps its view usage.
- [x] Run `npx prettier --check` on the changed files and
      `node --import tsx --test tests/markdown_links.test.ts`. Commit and push.

## Milestone 2: Variant pages read the parent's lists

Tags: ui

The viewer fetches the parent's detail for a current component variant and
shows the parent's lists. The details stay version 2, and their copies equal
the parent's lists, so the shown lists do not change.

- [x] Add the helper of the Viewer design. Use it in `routeDetailRequests` for
      the parent's request, and in `publicWorkspace` for `usedBy`,
      `affected`, and `usageComplete`.
- [x] Viewer tests:
  - [x] A current component variant requests its detail and its parent's. A
        parent, a screen variant, a removed variant, and a use case keep their
        requests.
  - [x] The route stays loading until both details arrive, and fails only
        after both settle.
  - [x] A sibling navigation keeps the held parent detail and loads only the
        sibling's detail.
  - [x] A publication refresh on a variant route adopts the index and both
        details at one revision. A parent detail of another deployment gives
        the replaced state.
  - [x] `publicWorkspace` shows the parent's lists on a variant, shows no
        zero list without the parent's detail, and keeps a removed variant's
        own lists.
  - [x] The embedded viewer on `components/action/default` calls `detail` for
        the variant and the parent, and shows the parent's Used by rows.
- [x] Browser tests:
  - [x] `shell_usage_delivery.spec.ts`: hold the detail of
        `example/components/action`, then open
        `example/components/action/default`. Usage shows `Loading usage…`.
        After the release, Usage lists Welcome, Details, and Toolbar. A
        sibling variant reads the parent's detail once.
  - [x] A live Serve spec: give the `card` fixture a variant and open the
        variant's Usage. An edit that adds a consumer updates Used by in place,
        without a page load.
- [x] Update the shell README paragraphs on `data_requests.ts`,
      `workspace_data.ts`, and omitted usage, and the Key Code line of
      `public_workspace.ts` in the viewer README. In
      `packages/viewer/docs/concepts/README.md`, say that a current variant
      shows its parent's lists, with no panel name. Update the Shell Delivery
      sentence of `docs/architecture/rust-core.md`.
- [x] Run the targeted tests. Commit and push.
      Evidence is in `.context/usage-list-in-parent-detail/milestone-2-*.log`.

## Milestone 3: Entry detail v3 without the variant copies

The writers stop writing the lists on current variants, and the readers move
to version 3 in the same milestone, because each reader accepts exactly one
version.

- [x] Apply Decision 1 against `origin/main`. Keep an unreleased version 3,
      or raise the number.
- [x] Model: read the `rust` and `shared-types` skills. Make the list fields
      optional, raise `ENTRY_DETAIL`, and rename `EntryDetailV2` to
      `EntryDetailV3`. Keep the version 2 requirement where the lists stay,
      and reject the lists on a current variant.
- [x] Producers: change `projection_usage::workspaces`,
      `projection_workspace::apply`, and `projection_removed::workspaces`.
      Adapt the static build and Serve call sites.
- [x] Run `cargo xtask generate-types`.
- [x] Rename `docs/protocol/fixtures/entry-details-v2.json` for the new
      version, and drop the lists from `components/action/default`. Update
      the two Rust tests, `catalogue_v8_fixture.ts`,
      `tests/helpers/viewer_catalogue.ts`, and
      `scripts/release/smoke_browser.mjs` that read it.
- [x] Viewer: the version 3 reader, the fence rule, and the type rename in
      the sources, tests, and browser helpers.
- [x] Update the version tests: the version array and the accepted snapshot
      of `type_generation_and_versions_are_stable`, and each test that builds
      a version 2 detail, such as `detail_reasons_tests.rs` and
      `public_contract_tests.rs`.
- [x] Rust tests:
  - [x] `projection_usage_tests`: a variant workspace has no list, and its
        parent's list keeps the variant's own nested use.
  - [x] `detail_context_tests`: a current parent without lists fails, and a
        current variant with lists fails.
  - [x] The removed projection tests: removed screens, parents, and variants
        keep both lists.
  - [x] The workspace projection tests: `apply` updates the parent's rows. A
        current variant has no `affected`, and a removed variant keeps its
        own.
  - [x] The Serve evidence test: after usage completes,
        `components/button/disabled` has no lists, and the list of
        `components/button` is complete.
- [x] Node tests: a static build writes a variant detail without the lists
      and its parent's detail with them. `tests/helpers/mokly_serve.ts` waits
      for `workspace`, not for `usedBy`, so it settles on a variant path.
- [x] Viewer tests: the reader accepts a version 3 variant workspace without
      lists and rejects version 2. A removed workspace without lists fails.
      The fence rejects a current parent without lists.
- [x] Browser tests:
  - [x] The live Serve spec of Milestone 2 also reads the variant's detail
        and finds no `usedBy` and no `affected`.
  - [x] Static comparison: `components/card/featured` shows Card's Used by,
        and its detail has no lists. The removed `components/card/archived`
        shows its own lists and requests no parent detail.
- [x] Docs: rename the version and the type links in the shell delivery,
      viewer, viewer namespace, Changes serving, comparison, runtime,
      serialization, and format version pages, and in the viewer's
      `docs/api/README.md` and `docs/concepts/README.md`. Remove the status
      lines.
- [x] Add the variant rule, the parent's `detail` request, and the type
      rename to `docs/guides/start/upgrade.md`. Remove its sentence that the
      entry detail stays version 2. Update the `mokly-model` README.
- [x] Run the targeted tests and `cargo xtask check --suite repository`.
      Commit and push. Decision 1 kept entry detail version 3 because
      `origin/main` had no earlier dedup version raise.
      Evidence is in `.context/usage-list-in-parent-detail/milestone-3-*.log`.

## Milestone 4: Smoke tests and measurements

- [x] Run `npm run build`. Build the example with `--strict` into
      `.context/example`. Measure it with the scripts in
      `.context/usage-list-in-parent-detail/scripts/`, and name the result
      file here. Evidence is in
      `.context/usage-list-in-parent-detail/milestone-4-*.log` and
      `.context/usage-list-in-parent-detail/milestone-4-*.txt`.
- [x] Run `npm run dev`. Open the Usage panel of
      `design/library/inspector/metadata-row/text`. Check the Used by list,
      the two detail requests, and one request on a sibling. Save a
      screenshot under `.context/usage-list-in-parent-detail/`. Evidence is
      in `serve-smoke.json`, `serve-usage.png`, and `milestone-4-serve-smoke-final2.log`.
- [x] Serve the static output with a static file server and repeat the check.
      Evidence is in `static-smoke.json`, `static-usage.png`, and
      `milestone-4-static-smoke.log`.

## Milestone 5: Verification, commit, review, and pull request

- [x] Check `origin/main` under the `git-merge` skill. It was already an
      ancestor at `a9dd1e81`, so no merge was needed.
- [x] Run the targeted tests and the complete gate named in `AGENTS.md`.
      The first gate found one branch-caused browser assertion and one
      report-process failure. The browser assertion passed after its version
      fixture fix. The final complete gate passed all seven suites.
      Evidence is in `.context/usage-list-in-parent-detail/milestone-5-*.log`.
- [x] Commit with Conventional Commits and push the branch. Commit
      `0d954296` is pushed to the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Plan review 1 (2026-10-27), before the implementation:
    `.context/usage-list-in-parent-detail/review-1.md`. Its findings 1 to 3
    and 5 to 7 were fixed in the plan. Finding 8 waited only for the
    rejected options, so the plan copies them from the investigation record.
  - Plan re-review of 773577d1 (2026-10-27): five Low findings, all fixed in
    the plan. The viewer now reads both lists of a current variant from the
    parent's detail.
  - Plan review 1, finding 4, no test of the embedded viewer's parent request:
    user decision (2026-10-27) A. Milestone 2 has the test.
  - Implementation review 1 (2026-10-27): `.context/usage-list-in-parent-detail/impl-review-1.md`. Findings 1 to 11 were fixed.
  - Implementation review 2 (2026-10-28), of the fix round: `.context/usage-list-in-parent-detail/impl-review-2.md`. Its findings 1, 2, 3, and 5 were fixed.
  - Review 1, finding 12. Three places decide the workspace list placement. Severity Low, effort Small. Recommended: D, build the test fixtures' workspaces with `projection_usage::workspaces`, and let `apply` fill only the lists that exist.
  - Review 2, finding 4. The viewer fence keeps its own copy of the current-variant rule. Severity Low, effort Small. Recommended: A, require the lists only when `workspaceDetailRequest` names the entry's own detail.
  - Follow-up: an xtask check that every Rust file starts with a module doc. Effort Medium. Covers review 1 finding 7. Previous examples: none found.
  - Follow-up: a table test with one rejected document for each `ContractViolation`. Effort Medium. Covers review 1 finding 11. Previous examples: none found.
  - `plans/remove-review-json.md` and `plans/build-head-capture.md`: their
    status paragraphs still say Active after their pull requests merged.
    Separate branch.
  - `docs/protocol/mokly-viewer.md` and the viewer's concepts README place
    Used by in Details, but the component pages contract places it in Usage.
    Separate branch.
- [x] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.

## Post-merge follow-up (non-blocking)

- [ ] Release the change as a minor version with a breaking-change note.
- [ ] Mokly Cloud pins that release. The `detail` source of its embedded
      viewer must answer the parent's path of a current variant.
