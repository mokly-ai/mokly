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
