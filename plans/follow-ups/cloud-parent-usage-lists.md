# Check parent usage lists of variants in Mokly Cloud

- **Severity:** High. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #223 and its completed plan, an unchecked
  post-merge task.
- **Location:** The `detail` source of the embedded viewer in Mokly Cloud is
  `detailSource` in `apps/app/src/viewer/catalogue-source.web.ts:151`. The
  rule is in `docs/protocol/mokly-viewer.md:58-63`, and the viewer request is
  built in `packages/viewer/src/catalogue/detail_fences.ts:21`.
- **Reason:** No automated test opens a component variant in the app, so
  only a run of the app with a published catalogue shows the result.

- **Terms:**
  - **Entry detail:** the JSON file of one screen or component that the
    Browse shell fetches for the routed entry.
  - **`detail` source:** the host callback of the embedded `@mokly/viewer`,
    `(entryPath, snapshotId?)`. The viewer calls it for each entry detail
    that it does not hold.
  - **Used by and Affected lists:** the `workspace.usedBy` and
    `workspace.affected` lists of a component's detail.
- **Background:**
  - On 2026-10-27 the user chose to keep `usedBy` only in the parent
    component's detail, and to let a variant's page read the list from that
    detail. The user rejected grouping the rows by consuming screen, doing
    both, and no change. The variant copies were 81% of the `usedBy` bytes.
  - PR #223 merged on 2026-10-28 and raised the entry detail version. The
    workspace of a current component variant then has no `usedBy` and no
    `affected`. Release 0.17.0 shipped it on 2026-10-29 as a breaking change.
  - `docs/protocol/mokly-viewer.md:58-63` states that the viewer calls
    `detail` with the parent's path for a current component variant, and
    line 124 states that such a variant shows the Used by and Affected lists
    of its parent's detail.
  - `workspaceDetailRequest` in
    `packages/viewer/src/catalogue/detail_fences.ts:21` names the parent's
    path for a current variant.
  - The app embeds the workspace `@mokly/viewer` of this repository. Its
    `detailSource` reads any entry path that the viewer names, under
    `mokly-viewer/entries/`, so a read of the code shows that it answers
    the parent's path. The pin and the code steps of the first task are
    therefore done. The check in the running app is not.
- **Task:**
  1. Publish a catalogue with a current component variant, for example
     `examples/basic`, to the app with a local API or to a preview
     environment.
  2. Open the variant in the app. Check that its Usage panel shows the Used
     by and Affected lists of its parent.
  3. Fix `detailSource` when the lists do not show. Add a test that holds
     the result.
- **Impact if no action:** If the host fails to answer the parent's path, a
  component variant page in Mokly Cloud shows no Used by or Affected list,
  or shows an error, and nobody notices.
- **Needs:** A running app and API, or a preview environment, and a
  publication with a current component variant.
- **Done when:** A current component variant in Mokly Cloud shows the Used
  by and Affected lists of its parent.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/usage-list-in-parent-detail.md?plain=1#L395).
