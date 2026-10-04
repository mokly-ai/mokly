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
