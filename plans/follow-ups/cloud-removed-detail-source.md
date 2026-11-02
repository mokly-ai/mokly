# Check Mokly Cloud's detail source for removed entries

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-02, from the branch `calummoore/mokly-viewer-responsibilities`: the unchecked post-merge task of the plan for the viewer's leftover layers.
- **Location:** None in this repository. The host code is in the `mokly-ai/mokly-cloud` repository.
- **Reason:** The check needs the released viewer in Mokly Cloud, which happens after this change merges and ships.

- **Terms:**
  - **Removed detail:** the entry detail of a removed entry. It lives in the comparison generation that the index's `comparisonUrl` names.
  - **`detail` source:** the prop of the `MoklyViewer` component through which a React host supplies entry details, in `docs/protocol/mokly-viewer.md:47-56`.
- **Background:**
  - On 2026-11-01 the user chose that a removed screen's preview takes its views from the removed detail that the route loads and fences. The preview no longer reads that detail itself.
  - `docs/protocol/mokly-removed-previews.md` states the rule. An embedded viewer takes that detail from its host's `detail` source, which the viewer calls with the entry path and the removed record's `snapshotId`.
  - Before the change, the preview fetched the removed detail from the generation itself, so a host that never answered for a `snapshotId` still showed previews.
- **Task:** In the Mokly Cloud viewer host, open a published catalogue with a removed screen, and confirm that the `detail` source answers the removed record's path and `snapshotId` with the removed detail. Fix the host when it does not.
- **Impact if no action:** A removed screen's preview in Mokly Cloud can show the unavailable state, while the standalone shell shows it.
- **Needs:** Mokly Cloud on a viewer release that contains this change, and a published catalogue with a removed screen.
- **Done when:** A removed screen's preview renders in Mokly Cloud, and the host's `detail` source answers removed records.
