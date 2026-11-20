# Check Mokly Cloud's detail source for removed entries

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-02, from the branch `calummoore/mokly-viewer-responsibilities`: the unchecked post-merge task of the plan for the viewer's leftover layers.
- **Location:** The host code is `detailUrl` in `packages/app/src/viewer/catalogue-source.web.ts:52-68`, with its test `packages/app/src/_tests_/viewer/catalogue-source.test.ts:153-175` and the browser spec `packages/app/src/_tests_/viewer/retained.spec.ts:6-29`.
- **Reason:** Mokly Cloud now runs a viewer release with this change, but no live check of a removed screen's preview in Mokly Cloud is recorded.

- **Terms:**
  - **Removed detail:** the entry detail of a removed entry. It lives in the comparison generation that the index's `comparisonUrl` names.
  - **`detail` source:** the prop of the `MoklyViewer` component through which a React host supplies entry details, in `docs/protocol/mokly-viewer.md:59-74`.
- **Background:**
  - On 2026-11-01 the user chose that a removed screen's preview takes its views from the removed detail that the route loads and fences. The preview no longer reads that detail itself.
  - `docs/protocol/mokly-removed-previews.md` states the rule. An embedded viewer takes that detail from its host's `detail` source, which the viewer calls with the entry path and the removed record's `snapshotId`.
  - Before the change, the preview fetched the removed detail from the generation itself, so a host that never answered for a `snapshotId` still showed previews.
  - PR #281 made the change. Release 0.19.0 is the first release that holds it.
  - The app embeds the workspace `@mokly/viewer` of this repository, which holds PR #281.
  - Facts about Mokly Cloud, checked on 2026-11-18 at its `main` commit `767be7b2`. The paths are those of this repository.
    - `detailUrl` in `packages/app/src/viewer/catalogue-source.web.ts:52-68` reads a removed detail under the comparison generation that the index's `comparisonUrl` names.
    - The test "current and removed details are read from their own paths", in `packages/app/src/_tests_/viewer/catalogue-source.test.ts:153-175`, reads a current detail and a removed detail, each from its own path.
    - No live check of a removed screen's preview in Mokly Cloud is recorded.
  - The browser spec "a removed entry opens its advertised snapshot in Changes", in `packages/app/src/_tests_/viewer/retained.spec.ts:6-29`, runs the app against a local API. It opens a removed screen in Changes and expects the screen's heading in the preview frame. It is not a live check in a deployed Mokly Cloud.
- **Task:** In the Mokly Cloud viewer host, open a published catalogue with a removed screen, and confirm that the `detail` source answers the removed record's path and `snapshotId` with the removed detail. Fix the host when it does not.
- **Impact if no action:** A removed screen's preview in Mokly Cloud can show the unavailable state, while the standalone shell shows it.
- **Needs:** A catalogue with a removed screen, published to Mokly Cloud. Mokly Cloud already runs a viewer release that contains this change, 0.19.0.
- **Done when:** A removed screen's preview renders in Mokly Cloud, and the host's `detail` source answers removed records.
