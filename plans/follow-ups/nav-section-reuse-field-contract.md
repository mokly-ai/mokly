# Rail section reuse trusts a hand-kept field list

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from the branch `calummoore/mokly-viewer-refresh-identity-q13s`, review item 1.
- **Location:** `packages/viewer/src/shell/nav_reuse.ts` (`sameNavigation`), `packages/viewer/src/shell/nav_model.ts` (`shareNavSections`), `packages/viewer/src/shell/nav_tree.ts`, `packages/viewer/src/shell/nav_moves.ts`, `packages/viewer/src/registry/catalogue_hierarchy.ts`, `packages/viewer/src/registry/folder_titles.ts`, `packages/viewer/src/shell/catalogue_branch_point.ts`.
- **Reason:** The structural fix reaches the registry and the branch-point lookup outside the change that added the reuse, and it serves later rail changes more than that change.

- **Terms:**
  - **Navigation sections:** the plain rail records (`NavSectionNode` in `packages/viewer/src/shell/nav_tree.ts`) that `catalogueNavSections` builds from the catalogue hierarchy, the removed records, and the branch-point lookup.
  - **Publication:** one revision that `mokly serve` publishes; the viewer refetches the index and adopts it in `withIndex` of `packages/viewer/src/shell/data_commit.ts`.
- **Background:** Since the refresh identity change of 2026-11-22, a publication reuses the installed navigation sections when `sameNavigation` finds the fields that place and name rail rows equal. The fields are each entry's path, kind, title, `previousPath`, `variantOf`, and tags, each removed record's snapshot id, the tree, and the tree order. Otherwise `shareNavSections` rebuilds the sections and keeps each deep-equal subtree. A doc comment on `sameNavigation` and the shell README name the builder modules whose entry reads the list must cover. The user decision of 2026-11-22 behind the reuse: a refresh reuses each unchanged index record, the derived lookups, the navigation sections, and each frame's usage object.
- **Problem:** The field list lives apart from the builders that read the fields. A builder that starts to read another entry field, for example a future rail badge from `changes` or a new record field, keeps stale rows after a publication. No compile error and no test fails, unless a test happens to change that field.
- **Impact if no action:** A later rail change can show stale row labels, tags, or positions after a Serve publication until the next full page load. Each new builder read makes the gap wider.
- **Root question:** How do the reused rail sections stay equal to a rebuild when the section builders change?
- **Options:**
  - **A.** Keep the doc comment and the README rule that name the contract. It relies on each author reading them. Effort: Small. This is in force since 2026-11-22.
  - **B.** Drop the shortcut: rebuild the sections for each new hierarchy and keep only the subtree sharing of `reuseSections`. It costs the builder time again on most publications, about 6 ms of each refresh in the traced profile of 2026-11-22. Effort: Small.
  - **C.** Give the section builders one projected entry type, for example `NavEntryFields`, made by one function from a catalogue record. `buildNavSections`, the hierarchy view that the rail reads, and the rail's use of the branch-point parents read only that type. `sameNavigation` compares the projections that the same function makes, so the compiler ties the compared fields to the read fields. Effort: Medium.
- **Left out:** A test that changes every other field of every entry and expects equal sections. It is a test for the class, so it needs the user's approval, and C removes the case without it.
- **Wider fix:** C.
- **Previous examples:** None found.
- **Recommendation:** C. It removes the stale case at compile time and keeps the measured builder saving.
- **Action:** fix after merge, apply C, because it reaches the registry and the branch-point lookup outside the change that added the reuse.
