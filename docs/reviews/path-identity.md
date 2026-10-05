# Path Identity Review

This is the final read-only review of the
[path identity plan](../../plans/path-identity.md). It covers the complete
diff of `calummoore/file-paths-vs-navpath` at `74e7596b` against `origin/main`
at `800fe9f8`. Two fresh reviewers followed the
[implementation review prompt](../implementation-review-prompt.md). A Codex
reviewer covered the backend, scripts, data layers, and documentation. A Claude
reviewer covered the viewer UI and the design mockups. The orchestrator then
confirmed each finding, either by reproducing it in a scratch Git repository
or by reading the code. Nothing was changed during the review. The reviewer
also ran the unmodified `cargo xtask check`, and it passed: 4,149 unit tests,
807 browser tests, and 260 hydration tests. Native macOS and Windows behaviour
was not tested.

The review reported eight findings: one High, two Medium, and five Low. The
Approved Follow-up section records the accepted fixes and their verification.

Background for readers new to the feature: each catalogue entry (a screen,
page, Markdown document, user flow, or component) now has one path, derived
from its file location, such as `account/billing/invoice`. The path is its
identity, its URL (`/view/<path>/`), and its output folder. A component has
variants: named sets of props, with the paths `<component path>/<slug>`.
**Changes** compares the catalogue with the one built from the Git base
branch. A moved entry is paired with its earlier version and shown as
"Moved".

## Findings

1. **High — Moving a component's last variant into another component breaks
   every catalogue page.**
   - **Where:** the public catalogue reader,
     [`packages/viewer/src/catalogue/references.ts`](../../packages/viewer/src/catalogue/references.ts),
     around line 153.
   - **What happens:** take component `old` with one variant, `primary`, and
     component `new` with one variant, `default`. Delete `old` and add
     `primary` to `new` (with `movedFrom: "old/primary"`). The variant pairs
     correctly. The old parent `old` stays a removed record with no
     variants left, because its only variant moved. The reader requires
     every component record to have a variant, and it throws
     `component needs variants`.
   - **Confirmed:** in a scratch Git repository, `mokly export --base main`
     failed with `[mokly/export-invalid] Could not export catalogue:
[mokly/components] $catalogue: component needs variants`. With
     `mokly serve --base main`, `/`, `/view/new/`, and `/view/new/primary/`
     all returned HTTP 500.
   - **Impact of no change:** an ordinary refactor makes Serve unusable and
     makes every export with Changes fail until the branch point moves past
     the change.
   - **Options:**
     - **A)** Allow a removed component parent to have no variants, and keep
       the rule for current parents.
     - **B)** Omit a removed parent that has no variants left, which loses
       its removal row.
   - **Recommended: A,** and run the existing move fixtures through the
     reader, Serve, and export, not only through the review result. The
     review result accepted this state while the reader did not. Shared
     cross-boundary fixtures would catch this class of disagreement.

2. **Medium — Valid entry paths named like private build directories cannot
   be exported.**
   - **Where:** export's public-name policy,
     [`src/export/resource_policy.ts`](../../src/export/resource_policy.ts)
     (around line 40), and
     [`src/export/public_files.ts`](../../src/export/public_files.ts)
     (around line 46).
   - **What happens:** the path grammar allows segments such as `coverage`,
     `dist`, `node_modules`, and `README`. Export treats them as private
     directories and drops generated files under them.
   - **Confirmed:** a screen at `specs/coverage.mockup.tsx` builds and checks.
     `mokly export --base main` then fails with `Comparison contains a private
export resource: snapshots/before/coverage/index.mobile.html (is inside a
private build or dependency directory (coverage))`. The same catalogue
     with the screen named `guide` exports.
   - **Impact of no change:** one entry with such a name stops the whole
     catalogue from exporting or publishing. The error does not name the
     entry module.
   - **Options:**
     - **A)** During export, trust the accepted compilation's exact
       generated-file inventory, including its parent directories, and keep
       the private-directory filter for every other file.
     - **B)** Reserve these names in the path grammar, with a path diagnostic
       that names the file.
   - **Recommended: A,** with tests that carry such paths through Build,
     Check, Serve, and export in both output modes. Relaxing the
     private-directory filter in general would expose real build
     directories.

3. **Medium — Earlier ownership formats still allow automatic replacement and
   deletion.**
   - **Where:**
     [`src/build/ownership.ts`](../../src/build/ownership.ts) (around line 44)
     accepts the plain `Generated by mokly from …` and
     `Generated by mokabook from …` headers.
     [`scripts/preview/artifact.mjs`](../../scripts/preview/artifact.mjs)
     (around line 33) lets earlier preview markers own pre-derived `view/`
     paths.
   - **What happens:** generated-file headers decide which files Build may
     replace or delete. A file with an old header is treated as Mokly output,
     and Build deletes it as an orphan.
   - **Context:** both readers already exist on `origin/main`; this plan did
     not add them. During Milestone 3 the orchestrator decided to keep them,
     because plan decision 14 lists the formats this plan replaces, and the
     ownership header is a separate contract. The reviewer reads decision 14
     ("no compatibility layer") as also covering these readers.
   - **Impact of no change:** output from much older versions still enters
     automatic replacement and deletion, against the stated clean-break
     policy. The practical risk is low, because these headers are rare in
     current repositories.
   - **Options:**
     - **A)** Remove both migration paths, with rejection tests across the
       ownership consumers and preview adoption.
     - **B)** Keep them, and state in decision 14 and the ownership contract
       that they are deliberate exceptions.
   - **Recommended: A,** in a small follow-up change. One ownership rule with
     no hidden fallbacks is easier to reason about for a delete path.

4. **Low — Folder counts under Changes and search include rows that the
   filter hides.**
   - **Where:**
     [`packages/viewer/src/shell/nav_rows.tsx`](../../packages/viewer/src/shell/nav_rows.tsx)
     (around line 28). Under Changes, the count uses every child. Under
     search, it uses the unfiltered rows. The mockups count only the rows
     they show
     ([`catalogue-navigation-sections.ts`](../../examples/basic/specs/design/library/chrome/catalogue-navigation-sections.ts),
     lines 62–65).
   - **Confirmed:** the reviewer moved `specs/example/screens` and served with
     `--base HEAD`. Under Changes the shell showed "Example 5" above one
     visible row. The orchestrator confirmed the branch in the code.
   - **Impact of no change:** the number next to a folder does not match the
     rows below it, and every Changes and search mockup disagrees with the
     shell.
   - **Options:**
     - **A)** Count the children that the active filter shows, using the
       same visibility function as the rows.
     - **B)** Keep full counts, and change the mockups.
     - **C)** Hide counts while a filter is active, and update the mockups.
   - **Recommended: A,** with the rule stated in `mokly-shell-design.md` and
     tests for All, Changes, and search counts.

5. **Low — The home summary does not count Markdown documents.**
   - **Where:**
     [`packages/viewer/src/shell/views.tsx`](../../packages/viewer/src/shell/views.tsx)
     (`HomeView`, around lines 110–133). It counts screens, components, user
     flows, and pages only. A catalogue of only documents reads "0 screens ·
     0 user flows · 0 catalogue pages".
   - **Impact of no change:** home under-reports the catalogue.
   - **Options:**
     - **A)** Add "N documents" and skip kinds with a zero count.
     - **B)** Remove the summary line, which the mockup does not show.
     - **C)** Show one total.
   - **Recommended: A,** built from a complete, type-checked map of entry
     kinds, so a new kind cannot be left out again.

6. **Low — The "Light only" band on a current document has no mockup and no
   browser test.**
   - **Where:** under Dark, a current document without a dark render shows a
     "Light only" band
     ([`scheme_fallback.tsx`](../../packages/viewer/src/shell/scheme_fallback.tsx)).
     [`mokly-documents.md`](../protocol/mokly-documents.md) says the
     `light-only-document` design shows it. The
     [inventory](../protocol/mokly-shell-design-inventory.md) lists that
     design for a removed document only. Browser tests check only that the
     band is absent.
   - **Impact of no change:** a shipped state has no approved design, against
     the mockup-first rule, and a broken style would not fail any test.
   - **Options:**
     - **A)** Add the mockup state, list it in the inventory, and add a
       browser test that shows the band under Dark.
     - **B)** Reuse an existing depicted pattern.
     - **C)** Correct the contract text only.
   - **Recommended: A.**

7. **Low — Three documents leave folder titles out of the search rule.**
   - **Where:** [`mokly-shell-design.md`](../protocol/mokly-shell-design.md)
     (around line 143), [`mokly-runtime.md`](../protocol/mokly-runtime.md)
     (around line 364), and the
     [shell README](../../packages/viewer/src/shell/README.md) (around line
     158). These say search matches a row's path, title, and tags. The code
     and [`mokly-folders.md`](../protocol/mokly-folders.md#titles) also match
     the titles of the folders above the row.
   - **Impact of no change:** the contracts conflict, and a reader could
     implement or test the wrong rule.
   - **Options:**
     - **A)** Add folder titles to the three statements.
     - **B)** Replace the restated rules with a link to `mokly-folders.md`.
   - **Recommended: B.** The rule drifted because several documents restate
     it.

8. **Low — Three documents still say Markdown rendering is not delivered.**
   - **Where:** [`mokly-rendering.md`](../protocol/mokly-rendering.md) (around
     line 13), [`build-pipeline.md`](../architecture/build-pipeline.md)
     (around line 110), and
     [`package-boundary.md`](../architecture/package-boundary.md) (around
     line 98). These say Markdown files stay private inputs until document
     rendering is implemented. Both Markdown rendering and move detection
     are implemented.
   - **Impact of no change:** readers get conflicting descriptions of what
     happens to Markdown files.
   - **Options:**
     - **A)** Update each status sentence.
     - **B)** Replace duplicated status prose with current behaviour and links
       to the owning contracts, and keep progress only in the plan.
   - **Recommended: B.**

## Residual Test Risk

Native macOS and Windows behaviour was not tested in this review. The new
case-only move and pruning tests now run in native CI (Milestone 6H). Folder
counts under Changes and search, and the current-document "Light only" band,
had no browser tests at that review snapshot; their new coverage is recorded
below. Index-entry Changes activation is covered by fixtures,
not by a real Git baseline.

## Approved Follow-up

On 2026-10-04 the user approved the recommended option for every finding.
The [plan](../../plans/path-identity.md) delivers them in Milestones 9–13:

| Finding | Approved option                                                                                            | Milestone        |
| ------- | ---------------------------------------------------------------------------------------------------------- | ---------------- |
| 1       | A: allow a removed component parent with no variants, and test moves through the reader, Serve, and export | 9 (contract), 11 |
| 2       | A: export trusts the build's exact generated-file inventory                                                | 9 (contract), 11 |
| 3       | A: remove the earlier ownership headers and preview adoption, with rejection tests                         | 9 (contract), 11 |
| 4       | A: count only the rows the active filter shows                                                             | 9 (contract), 12 |
| 5       | A: count every entry kind from a type-checked map                                                          | 9 (contract), 12 |
| 6       | A: add the mockup state and a browser test                                                                 | 10, 12           |
| 7       | B: one owner for the search rule, with links elsewhere                                                     | 9                |
| 8       | B: current behaviour and links instead of status prose                                                     | 9                |

### Outcomes

All eight approved findings are fixed in the merged implementation at
`594e78db`. The original findings above describe the `74e7596b` review snapshot.
Milestone 13 verifies the combined code and repeats each requested smoke test;
the next independent review remains assigned to fresh reviewers.

| Finding | Outcome and implementation commit                                                                                                                                           | Covering tests                                                                                                                                                                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Fixed in `8a347d80`: both readers accept an empty removed parent, while current parents still need a variant.                                                               | [`move_removed_parent_delivery.test.ts`](../../tests/move_removed_parent_delivery.test.ts); shared [`move_delivery.ts`](../../tests/helpers/move_delivery.ts) verifies review/reader/Serve/export agreement for compiled move fixtures.                                                                                   |
| 2       | Fixed in `8a347d80`: exact generated inventories retain legal entry names without publishing private siblings.                                                              | [`export_named_entries.test.ts`](../../tests/export_named_entries.test.ts), [`export_generated_inventory.test.ts`](../../tests/export_generated_inventory.test.ts), and [`export_resource_policy.test.ts`](../../tests/export_resource_policy.test.ts).                                                                   |
| 3       | Fixed in `8a347d80`: earlier Mokly/Mokabook headers and preview-marker adoption grant no ownership. Contracts and manual cleanup guidance are in `c2222348`.                | [`ownership_earlier_formats.test.ts`](../../tests/ownership_earlier_formats.test.ts), [`preview_earlier_ownership.test.ts`](../../tests/preview_earlier_ownership.test.ts), [`build_ownership.test.ts`](../../tests/build_ownership.test.ts), and [`export_migration.test.ts`](../../tests/export_migration.test.ts).     |
| 4       | Fixed in `7aa89d9a`: folder counts and child rows use the same active-filter visibility rule.                                                                               | [`nav_folder_counts.test.ts`](../../packages/viewer/tests/nav_folder_counts.test.ts) and [`nav_folder_counts.spec.ts`](../../tests/browser/nav_folder_counts.spec.ts).                                                                                                                                                    |
| 5       | Fixed in `7aa89d9a`: the home summary has an exhaustive kind map, counts documents and omits zero-count kinds.                                                              | [`home_summary.test.ts`](../../packages/viewer/tests/home_summary.test.ts), plus the Milestone 13 browser smoke at both widths.                                                                                                                                                                                           |
| 6       | Fixed by design commit `19bd7e51` and browser coverage in `7aa89d9a`: the current-document Light only band has an indexed mobile/desktop mockup and positive Dark coverage. | [`design_light_only_document.test.ts`](../../tests/design_light_only_document.test.ts), [`design_document_styles.test.ts`](../../tests/design_document_styles.test.ts), and [`light_only_document_band.spec.ts`](../../tests/browser/light_only_document_band.spec.ts).                                                   |
| 7       | Fixed in `c2222348`: `mokly-folders.md#titles` owns matching; other contracts and READMEs link to it.                                                                       | [`protocol_structure.test.ts`](../../tests/protocol_structure.test.ts), [`markdown_links.test.ts`](../../tests/markdown_links.test.ts), and [`guides_structure.test.ts`](../../tests/guides_structure.test.ts); existing [`row_search.test.ts`](../../packages/viewer/tests/row_search.test.ts) covers matching behavior. |
| 8       | Fixed in `c2222348`: rendering and architecture documents describe delivered Markdown behavior and link to its contracts.                                                   | [`protocol_doc_history.test.ts`](../../tests/protocol_doc_history.test.ts), [`markdown_links.test.ts`](../../tests/markdown_links.test.ts), the guide tests, and the recorded documentation-wide status scan.                                                                                                             |

The unmodified `cargo xtask check` passes on the merged implementation: 4,170
unit tests, 814 browser tests and 261 hydration tests, with no skips or retries.
Package checks pass all six consumer scenarios and validate 472 example files.
Audit, formatting, lint, ratchets, Rust checks and both file-length audits pass.
The existing reviewed Braces exception remains the only audit exception.

Fresh CLI and browser smoke checks at 1280px and 390px confirm all requested
outcomes: 14 Serve pages return HTTP 200 after the last variant moves; export
retains the old parent as removed and includes `coverage`; an earlier header
is refused without replacement and its file survives a later successful build;
Shop counts 5 rows in All, 2 in Changes and 1 under each tested search; home
shows `6 screens · 3 components · 2 documents`; and the current document shows
`Light only` above its light pane under Dark. The smoke produces no browser
page errors. Evidence is recorded in the plan and `.context/m13/`.

## Second Review

Two fresh reviewers repeated the read-only review on `013b8add` against
`origin/main` at `800fe9f8`, with the same split as the first round. The
first-round fixes hold, and none of the first eight findings came back. The
reviewers found fifteen new issues: one High, four Medium, and ten Low. The
Codex reviewer's unmodified `cargo xtask check` passed: 4,170 unit tests, 814
browser tests, and 261 hydration tests. The orchestrator reproduced findings 1
and 3 in scratch Git repositories, and confirmed the rest by reading the code.
The reviewers reproduced findings 2 and 5 to 13. Nothing was changed during the
review. The user decides what to address next.

1. **High — Moving a screen that uses a changed component breaks export.**
   - **Where:**
     [`workspace_usage_data.ts`](../../packages/viewer/src/shell/workspace_usage_data.ts),
     around lines 37–48.
   - **What happens:** a component page lists the screens that its change
     affects. Each link comes from branch-point evidence, which holds the
     screen's old path. The code links to that old path and never maps it to
     the moved screen's new path.
   - **Confirmed:** the orchestrator moved `shop/receipt` to
     `shop/archive/receipt` (with `movedFrom`) and changed the `Badge`
     component it uses. `mokly export --base main` then fails with
     `Export resource is unavailable: view/library/badge/index.html ->
/view/shop/receipt/?…`. In Serve, the link returns 404.
   - **Impact of no change:** an ordinary refactor blocks export and
     publishing.
   - **Options:**
     - **A)** Map each branch-point path to its current entry before the
       lookup.
     - **B)** Use the consumer's current path where it is available.
   - **Recommended: A,** through the shared lookup described after finding 15.
2. **Medium — A case-only rename breaks complete comparisons that have
   stylesheet evidence.**
   - **Where:**
     [`artifact_resources.ts`](../../src/review/artifact_resources.ts),
     around line 62.
   - **What happens:** the validator reads the before snapshot at
     `previousPath ?? path`. A case-only rename (`Billing` to `billing`) sets
     no `previousPath`, so the validator asks for `snapshots/before/billing/…`.
     Capture kept `snapshots/before/Billing/…`.
   - **Confirmed:** with a case-only rename plus a stylesheet edit,
     `/__mokly/diffs/review.json` returned HTTP 500. The same edit without the
     rename returned 200.
   - **Options:**
     - **A)** Use each record's own before and after snapshot paths.
     - **B)** Add explicit snapshot paths to the review format.
   - **Recommended: A,** applied to every snapshot consumer, with tests for
     case-only screen and component-variant renames.
3. **Medium — A Markdown link to a PDF page or an SVG anchor fails the
   build.**
   - **Where:** [`html_links.ts`](../../src/build/html_links.ts) (around
     line 202) and [`references.ts`](../../src/export/references.ts) (around
     line 85).
   - **What happens:** both validators check an attachment's fragment against
     HTML anchors, and an attachment has none.
   - **Confirmed:** the orchestrator built a document with
     a link to `manual.pdf#page=2`. It failed with
     `missing target anchor ../manual.pdf#page=2`. The same link without the
     fragment builds.
   - **Options:**
     - **A)** Check anchors only for HTML targets, and keep attachment
       fragments as written.
     - **B)** Add PDF and SVG fragment validators.
   - **Recommended: A,** as one shared target-type rule in Build and export.
4. **Medium — Moving the module that exports a definition, or the renderer's
   folder, marks unchanged screens as changed.**
   - **Where:** [`resources.ts`](../../src/review/moves/resources.ts), around
     line 147.
   - **What happens:** move resource matching considers only entries whose
     path or defining module changed. The generated stylesheet URL derives
     from the exporting module, so it changes while the bytes stay
     identical, and the screen shows `material` and `dependency` reasons.
   - **Confirmed:** the reviewer reproduced it in committed and derived
     modes, and for a renderer folder move. The orchestrator confirmed the
     candidate filter in the code.
   - **Options:**
     - **A)** Detect moved resources from the references in both renders.
     - **B)** Store the exporter and renderer locations in baseline metadata.
   - **Recommended: A.**
5. **Medium — A variant list or a folder member list cannot be collapsed
   while a filter is on.**
   - **Where:** [`nav_leaf_rows.tsx`](../../packages/viewer/src/shell/nav_leaf_rows.tsx),
     around lines 176–195. While filtering, the open state comes only from
     the matches, so the click does nothing and `aria-expanded` stays
     `true`.
   - **Contract:** [`mokly-navigation.md`](../protocol/mokly-navigation.md)
     requires the shell to keep groups that the user collapsed while
     filtering. Folder rows follow this rule. Main had the same gap for
     variant lists. This branch extends it to member lists, which can hold
     whole subfolders.
   - **Options:**
     - **A)** Read the saved choice while filtering, as folder rows do.
     - **B)** Hide the button while filtering.
   - **Recommended: A,** with one shared open-state rule for folders and
     lists, and browser tests under Changes and search.
6. **Low — Variant details ignore moves between parents and case-only
   renames.** In `workspace_variants.ts`, `workspace_input_changes.ts`, and
   `nav_tree.ts`, the shell looks only at the old variants of the parent's
   own old path, with exact case. A variant moved to another parent, or
   renamed by case only, loses its Before and Current props, and a removed
   sibling shows as a flat row. **Options:** **A)** fix the three
   comparisons; **B)** route them through the shared lookup.
   **Recommended: B.**
7. **Low — A removed component whose variants all moved shows an empty
   "Variant" control and the instruction "Select a comparison to see the
   previous version", although the page has no comparison control.**
   First-round fix 1 made this state valid, but no contract or mockup
   defines its presentation. **Options:** **A)** design the state first, as
   a mockup and contract text, then hide the empty bar and say where the
   variants moved; **B)** hide the bar and say there is no previous
   version. **Recommended: A.**
8. **Low — Opening a moved component's removed variant resets the
   comparison mode.** In `views.tsx` (around lines 197–202), the workspace
   key is the variant's `variantOf`, which still holds the old parent path,
   so the workspace remounts. **Options:** **A)** key the workspace by the
   resolved parent; **B)** store the mode outside the workspace.
   **Recommended: A.**
9. **Low — A container row in Changes skips a moved member's removed
   variant.** `changes_activation.ts` (around lines 183–193) compares
   `variantOf` with the current path, while the tree applies the move
   pairs. **Options:** **A)** apply the move pairs there too; **B)** build
   the activation order from the built tree. **Recommended: B.**
10. **Low — A breadcrumb offers to reveal a folder that has no row.**
    `crumbs.ts` checks only the folder's own hidden flag, so a folder that
    holds only hidden folders gets a reveal button that reveals nothing.
    **Options:** **A)** make such a crumb plain text, and state this in the
    contract; **B)** end the reveal at once when no filter change can show
    the row. **Recommended: A and B.**
11. **Low — A removed variant's parent crumb shows the wrong title** when
    another kind reuses the parent's path. The removed record has no field
    for the former parent's title. **Options:** **A)** store it in the
    removed record; **B)** change the contract. **Recommended: A.**
12. **Low — A removed top-level entry shows an empty "Location" row in
    Details** (`details.tsx`, around line 74). **Options:** **A)** omit the
    row when there are no folders; **B)** show a fixed label.
    **Recommended: A.**
13. **Low — The mockups drop the count on collapsed folders.** The mockup
    helper counts only the rows it draws, but the contract says collapsing a
    group does not change its count. 120 folder rows in 61 artboards lack a
    count. **Options:** **A)** draw a collapsed folder's children as hidden
    rows, so the helper counts them; **B)** keep an authored count; **C)**
    document the gap. **Recommended: A,** with a design test.
14. **Low — The catalogue guides no longer say what search matches.**
    Milestone 9 replaced the summary in `search-and-filters.md` and
    `browse.md` with a link, and the docs site does not publish the linked
    contract. **Options:** **A)** restore a short summary for users and
    keep the link; **B)** publish the contract as a reference page;
    **C)** keep the current text. **Recommended: A,** and add a rule to
    `mokly-guides.md`: a guide may summarise behaviour for users, and the
    protocol owns the exact rule.
15. **Low — Two stale statements.** The shell README says
    `store_browser_urls.ts` owns provider-normalised URL policy, which was
    removed. `mokly-shell-design-catalogue.md` says the `light-only-current`
    state's All filter is a link, but it is the active filter.
    **Recommended:** correct both.

**Shared cause of findings 1, 6, 8, 9, and 11.** Each one maps a
branch-point path to a current entry in its own way. The reviewer
recommends one shared lookup that applies the move pairs, case folding, the
same-kind check, and the stored former-parent title, used by links, the
tree, activation, workspace keys, crumbs, and input details. It also
recommends one fixture set that runs moves, variant moves between parents,
case-only renames, a path reused by another kind, and moved consumers of
changed components through Serve, export, and the embedded viewer, and that
asserts the rendered UI, not only the HTTP status.

**Residual test risk.** Native macOS and Windows behaviour was not tested.
The UI reviewer did not run the full browser suites, because their hosts bind
ports outside its allowed range. The Codex reviewer ran them, and they passed.
No test covers findings 1 to 11.

### Approved Second Follow-up

On 2026-10-04 the user approved the shared lookup for findings 1, 6, 8, 9,
and 11, with the shared fixture set. The lookup handles moves, case-only
renames, a path that another kind reuses, and the former parent's title. The
[plan](../../plans/path-identity.md) delivers it in Milestones 14–17:

| Finding | Approved option                                                      | Milestone             |
| ------- | -------------------------------------------------------------------- | --------------------- |
| 1       | A: map each branch-point path to its current entry before the lookup | 14 (contract), 15, 16 |
| 6       | B: route the three comparisons through the shared lookup             | 14 (contract), 15, 16 |
| 8       | A: key the workspace by the resolved parent                          | 14 (contract), 16     |
| 9       | B: build the activation order from the built tree                    | 14 (contract), 16     |
| 11      | A: store the former parent's title in the removed record             | 14 (contract), 15, 16 |

Findings 2, 3, 4, 5, 7, 10, 12, 13, 14, and 15 await the user's decision.

#### Outcomes

The approved branch-point lookup fixes are integrated at `3aff9c03`.
Contracts landed in `c7db0791`; the lookup, former-parent title and shared
Git fixtures landed in `612c0032`; shell consumers landed in `3aff9c03`.
Milestone 17 verified that combined code without changing it.

| Finding | Outcome and implementation commit                                                                                                                                                                                            | Covering tests                                                                                                                                                                                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Fixed in `612c0032` and `3aff9c03`: each usage evidence resolves on its own side. The moved receipt and component consumer export and link to their current paths.                                                           | [`branch_point_fixture_data.test.ts`](../../tests/branch_point_fixture_data.test.ts), [`branch_point_workspace.test.ts`](../../tests/branch_point_workspace.test.ts), [`branch_point_inputs.test.ts`](../../tests/branch_point_inputs.test.ts); the `moved-consumers` browser case.                               |
| 6       | Fixed in `612c0032` and `3aff9c03`: variant bars, saved props, supplied inputs and removed rows use one lookup for moves between parents and case-only renames.                                                              | [`branch_point_inputs.test.ts`](../../tests/branch_point_inputs.test.ts), [`branch_point_workspace.test.ts`](../../tests/branch_point_workspace.test.ts), [`branch_point_navigation.test.ts`](../../tests/branch_point_navigation.test.ts); the `moved-parent`, `moved-variant` and `case-renames` browser cases. |
| 8       | Fixed in `3aff9c03`: the component workspace key uses the resolved parent. Export retains Side by side when a removed sibling opens after a parent move or case-only rename. The separate Serve behavior below remains open. | [`branch_point_workspace_key.test.ts`](../../tests/branch_point_workspace_key.test.ts), [`branch_point_parents.test.ts`](../../tests/branch_point_parents.test.ts); the `moved-parent` and `case-renames` browser cases and the real CLI export smoke.                                                            |
| 9       | Fixed in `3aff9c03`: Changes activation traverses the built navigation tree. The Library container reaches the moved member's removed variant.                                                                               | [`branch_point_navigation.test.ts`](../../tests/branch_point_navigation.test.ts), [`branch_point_guard.test.ts`](../../tests/branch_point_guard.test.ts); the `moved-parent` browser case and CLI smoke.                                                                                                          |
| 11      | Fixed in `612c0032` and `3aff9c03`: every removed variant retains its baseline `parentTitle`. When a document reuses the parent's path, the crumb shows that title as plain text.                                            | [`catalogue_parent_title.test.ts`](../../tests/catalogue_parent_title.test.ts), [`branch_point_navigation.test.ts`](../../tests/branch_point_navigation.test.ts), [`branch_point_parents.test.ts`](../../tests/branch_point_parents.test.ts); the `reused-parent` browser case.                                   |

The shared browser checks are
[`branch_point_serve.spec.ts`](../../tests/browser/branch_point_serve.spec.ts),
[`branch_point_export.spec.ts`](../../tests/browser/branch_point_export.spec.ts)
and [`branch_point_viewer.spec.ts`](../../tests/browser/branch_point_viewer.spec.ts).
All 30 cases pass. The guard blocks the four patterns that it checks. The
[third review](#third-review) found that it misses plain path lookups.

**Remaining Serve behavior for finding 8:** Serve still resets the comparison
mode on the first navigation after any new on-demand comparison, siblings
included. Each comparison document raises the evidence revision. This also
happens on main and awaits the user's decision. The shared Serve browser
suite prepares comparisons before it checks mode retention. Milestone 17
changed neither that behavior nor the tests. The fixed time budgets, the
hydration console flake and case-only renames in `catalogueComponentVariants`
also remain outside this approved work, as do the ten unapproved findings.

The unmodified full gate passed on the second complete run: 4,214 unit tests,
844 browser tests and 261 hydration tests. The first complete run passed all
checks except the known export `billing/invoice/paid` hydration case, which
logged `Blocked script execution in 'about:srcdoc'`. The repeat passed with
no skips, filters, retries or code changes. Logs are
`.context/m17-gate-1.log` and `.context/m17-gate-2.log`.

Real CLI smoke used five scratch Git repositories and `serve --base main`
and `export --base main`. All 20 case/host/width combinations passed at
1280px and 390px. All 32 rendered usage links reached the expected page and
title. Removed variants retained crumbs and props, export retained Side by
side across sibling navigation, and Changes reached the removed member.
No browser page error or HTTP 500 occurred. Scratch sources, logs, results
and screenshots stay in `.context/m17/`, outside the feature diff.

## Third Review

Two fresh reviewers repeated the read-only review on `aaf6fd75` against
`origin/main` at `800fe9f8`, with the same split as before. The five approved
fixes work as specified in the five shared cases, and the lookup matches its
contract. The Codex reviewer's unmodified `cargo xtask check` passed: 4,214
unit tests, 844 browser tests, and 261 hydration tests. The reviewers found
seven issues, and two of them are the same, so six findings follow. The
orchestrator reproduced finding 2 in scratch Git repositories and confirmed
the rest by reading the code. The reviewers reproduced findings 1 to 5.
Nothing was changed during the review. The user decides what to address next.

1. **Medium — The guard test misses plain path lookups, which caused
   second-review finding 1.**
   - **Where:**
     [`branch_point_guard.test.ts`](../../tests/branch_point_guard.test.ts),
     around lines 15–23 and 66–96. The shell README (around lines 7–11 and
     37–41) claims that no shell module resolves references outside the
     lookup.
   - **What happens:** the guard flags `previousPaths` reads, followed or
     compared `variantOf` values, and case-folded paths. It cannot see a
     plain `===`, `.find`, or `Map.get` match between a branch-point path and
     a current path. It does not scan `packages/viewer/src/catalogue/`, which
     the shell calls.
   - **Confirmed:** both reviewers ran the guard's rules on the files at
     `b02f0e7c`. The rules flag the files behind second-review findings 6,
     8, 9, and 11, but report nothing for the `workspace_usage_data.ts` that
     broke export (finding 1). They also miss finding 2 below.
   - **Impact of no change:** the guard gives false confidence. New code can
     repeat the High finding and still pass.
   - **Options:**
     - **A)** Widen the rules: treat `componentId` reads and plain matches on
       paths from removed records, baseline entries, or review evidence like
       `variantOf`. Add the faulty `workspace_usage_data.ts` as a rejected
       guard sample.
     - **B)** Give branch-point paths their own type when the catalogue is
       read, for example `{ side: "before", kind, path }`, so the compiler
       rejects a direct match against a current path. A type-aware guard then
       blocks `.path` reads outside the lookup. This changes the readers, the
       projection, and the consumers. The v4 read model is unreleased.
     - **C)** Keep the guard, narrow the README claim, and add a browser
       check that no raw path appears where a title belongs.
   - **Recommended: B,** with A's rejected sample. This class caused five
     second-review findings and findings 2 and 4 below. A type makes the
     compiler enforce the rule; a list of banned patterns cannot.
2. **Medium — A removed screen loses the titles and, in the embedded viewer,
   the inspection of a component that moved or changed letter case.**
   - **Where:** the label in
     [`workspace_instances.tsx`](../../packages/viewer/src/shell/workspace_instances.tsx)
     (around lines 118–131), the same exact match in `workspace_props.tsx`,
     `workspace_inspection_labels.tsx`, and `viewer/inspection_layer.tsx`,
     and the embedded "Used by" list in `viewer/public_workspace.ts`. The
     embedded symptom comes from the projection in
     [`views.ts`](../../src/catalogue/views.ts) (around lines 36–43). The
     lookup contract does not list usage component names as branch-point
     references.
   - **What happens:** a removed screen keeps its branch-point render, which
     names each component by its old path. A paired move removes no record at
     that path, so the shell finds no component and shows the raw path. The
     projection drops that usage, so the embedded viewer marks it
     unavailable.
   - **Confirmed:** the orchestrator moved `library/badge` to
     `library/ui/badge` with `movedFrom` and deleted the screen that used it.
     The exported `catalogue.json` marks the removed screen's views
     `unavailable`; without the move they are `ready`. The reviewer saw
     `library/badge · badge` instead of `Badge · badge` in Serve and export,
     and `library/Badge · Badge` after a case-only rename.
   - **Impact of no change:** after an ordinary library reorganisation,
     users see a file path where the product shows a title, and the embedded
     viewer stops inspecting removed screens. On main, the same change kept
     inspection, because a move was a removal plus an addition.
   - **Options:**
     - **A)** Resolve each usage component name through the lookup in one
       helper (before side for removed records, after side for current
       entries), and use it in the four inspector places and in "Used by".
       Keep usage that resolves through a move or a case-only rename in the
       projection and the readers. Add the case to the lookup contract and a
       sixth shared fixture case in all three hosts.
     - **B)** Fix only the label in Serve and export, and document that the
       embedded viewer has no inspection here.
     - **C)** Show the recorded title or a neutral label when no match
       exists.
   - **Recommended: A.**
3. **Low — A variant that moves into a new parent shows no Before and
   Current values for the inputs it passes to nested components.**
   [`workspace_input_changes.ts`](../../packages/viewer/src/shell/workspace_input_changes.ts)
   (around line 41) stops when the parent has no branch-point entry, so a
   variant's own move pair is never used. Details says "Supplied props or
   slots changed" but shows no values. No shared case has a moved variant
   with a nested component. **Options:** **A)** for component pages, pair
   each variant through its own counterpart and drop the parent check;
   **B)** make the check per variant. **Recommended: A,** with the
   new-parent case in `branch_point_inputs.test.ts` and the shared fixtures.
4. **Low — Removed variants lose their authored order after their parent
   moves or changes letter case.** The projection
   ([`projection.ts`](../../src/catalogue/projection.ts), around line 158)
   groups removed variants by their old `variantOf` with an exact match, so
   they fall back to path order. The reviewer saw `zulu, alpha` published
   as `alpha, zulu` in Serve and export. **Options:** **A)** add move and
   case handling to the sorter; **B)** order removed records through the
   shared parent lookup. **Recommended: B,** with two removed siblings in
   non-alphabetical order in the shared fixtures.
5. **Low — Both readers accept a `previousPath` that names a current entry
   of the same kind.**
   [`references.ts`](../../packages/viewer/src/catalogue/references.ts)
   (around line 74) checks uniqueness and removed paths only. The lookup
   contract forbids this state, and the lookup then sends baseline
   references to the wrong entry. **Options:** **A)** reject it in the
   shared reader validator, case-folded, while reuse by another kind stays
   valid; **B)** reject it when the lookup is built. **Recommended: A,**
   with negative tests for both readers.
6. **Low — The guard test fails on Windows.** It compares a native relative
   path with a forward-slash constant
   ([`branch_point_guard.test.ts`](../../tests/branch_point_guard.test.ts),
   around line 114), so on Windows it scans the lookup itself and reports
   two violations. The native CI job runs only selected tests, so CI does
   not see this. **Options:** **A)** normalise the separators, with a test
   for both styles; **B)** compare resolved absolute paths.
   **Recommended: A,** and add the guard to the native Windows job.

**Found during Milestone 16.** The implementation agent reported four more
items. Items 7 to 9 also happen on main.

7. **Medium — Serve resets the comparison mode after each new on-demand
   comparison.** Each comparison document raises the evidence revision, and
   `use_comparison.ts` includes that revision in the mode owner, so the next
   navigation returns to Current, siblings included. The shared Serve suite
   renders its comparisons first to avoid this. **Options:** **A)** remove
   the revision from the mode owner and renew only the loaded comparison;
   **B)** do A, add a contract rule that names the only events that may
   reset the mode, and add a Serve test without the warm-up step; **C)** do
   nothing. **Recommended: B.**
8. **Medium — Fixed time budgets fail on slow machines.** The 2,500 ms
   budget in `postcss_dependency_review.test.ts` and the 300 s
   `ordinaryPreview` fixture setup failed on the Milestone 16 machine, also
   on the unchanged base. **Options:** **A)** raise the budgets; **B)** count
   the sorts and root projections that the PostCSS test's title names, keep
   time only as a diagnostic, and build the shared preview once before the
   browser stage; **C)** do nothing. **Recommended: B.**
9. **Medium — A hydration test is flaky.** The `billing/invoice/paid` case in
   `moved_hydration.spec.ts` sometimes logs `Blocked script execution in
'about:srcdoc'`: once in Milestone 15 (Serve), in Milestone 16 (export,
   also on base), and in the first Milestone 17 gate run (export).
   **Options:** **A)** find the frame that receives the script, remove
   scripts before framing, and add a rule test that no shell `srcdoc`
   contains `<script>`; **B)** ignore the message in this test; **C)** do
   nothing. **Recommended: A.**
10. **Low — `catalogueComponentVariants` ignores case-only renames.** This
    data-layer helper compares exact paths, so the scoped page data of a
    case-renamed removed variant omits its sibling's usage. No visible
    effect was found. **Options:** **A)** move the identity rules into one
    module that `catalogue/` and `shell/` share, and extend the guard to
    `catalogue/` (except reader validation); **B)** case-fold only this
    helper; **C)** do nothing. **Recommended: A.**

**Shared cause of findings 1, 2, 4, and 10.** The server projection and the
viewer data layer still map branch-point paths outside the lookup. One
change addresses all four: move the lookup into a module that the
projection, the viewer data layer, and the shell share; give branch-point
references their own type; and extend the guard to those layers.

**Residual test risk.** Native macOS and Windows behaviour was not tested.
The UI reviewer did not run the full suites, because their hosts bind ports
outside its allowed range. The Codex reviewer ran them, and they passed. No
test covers findings 1 to 6.

### Approved Third Follow-up

On 2026-10-05, the CI run for pull request #131 failed on finding 9. The
orchestrator found the cause. The previous-version frames contain no script.
Playwright records a trace for every test (`trace: "retain-on-failure"`), and
its trace recorder tries to run a script in each frame. Chrome blocks that
script in the sandboxed `about:srcdoc` frames and logs the report. The
hydration helper accepted the report only from `/static/` frames. In 50 runs
with tracing on, 23 failed; with tracing off, none failed. Option A above
(remove scripts before framing) therefore cannot fix it.

The user approved a new option: treat Chrome's report from the viewer's own
sandboxed frames as expected, in one shared rule for every browser check, and
keep every other console error a failure. The removed-preview contract
disables scripts in those frames by design. The
[plan](../../plans/path-identity.md) delivers this in Milestone 18.

| Finding | Outcome                                                                                                                                                                                                                | Covering tests                                                                                                                                                                                                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9       | Fixed in Milestone 18: [`console_notices.ts`](../../tests/browser/console_notices.ts) owns the rule. The hydration helper, `react_host_capabilities.spec.ts`, `react_shell_smoke.spec.ts`, and `moved_rows.ts` use it. | [`removed_preview_script_hydration.spec.ts`](../../tests/browser/removed_preview_script_hydration.spec.ts) (a removed screen whose previous version keeps a blocked script; it failed before the fix in both hosts), [`console_notices.test.ts`](../../tests/console_notices.test.ts), and 50 of 50 runs of the `billing/invoice/paid` route with tracing on (13 of 50 failed before). |

The other findings of the third review, and the ten undecided second-review
findings, still await the user's decision.
