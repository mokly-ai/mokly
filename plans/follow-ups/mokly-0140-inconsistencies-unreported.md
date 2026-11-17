# Mokly 0.14.0 inconsistencies have no recorded report

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge task and the Release Findings of the deleted `plans/mokly-dependencies-upgrade.md`, and from the Milestone 12 review TODO of the deleted `plans/documentation-skill-alignment.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** None.
- **Reason:** The report goes to the open-source `mokly-ai/mokly` repository, and the dependency upgrade left it for after its merge on 2026-10-10.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify whether a report exists. The issue search of the open repository returned no issue. Two of the four points no longer apply to the latest release, 0.17.0.

- **Terms:**
  - **Open repository:** `mokly-ai/mokly`, which publishes the `@mokly/mokly` CLI and the `@mokly/viewer` package that the cloud pins.
- **Background:** The cloud adopted `@mokly/mokly@0.14.0` and `@mokly/viewer@0.5.0` in PR #35. The adoption found four upstream inconsistencies that need no cloud workaround. The plan said to report them to the open repository after the merge. The latest published release is 0.17.0. The list below gives each point and its status at that release.
  - The 0.14.0 changelog names manifest v8, read model v4 and review v5. The shipped code and `mokly-format-versions.md` emit and require v9, v5 and v6. The 0.17.0 changelog still holds the wrong 0.14.0 paragraph, so this point still holds.
  - The viewer's `dist/shell/delivery.js` reports supported delivery 4 in `MoklyVersionError`. The real `dist/navigation/delivery.js` classifier and its declarations accept only 5. The latest viewer no longer has these files, so this point is history for the pinned 0.5.0 only.
  - The valid cases of the released `export-ownership-v3.json` fixture still use 0.13.0-style paths. The fixture tests the marker shape, so the old paths can be intended. Ask the maintainers before you report it as a defect.
  - The packaged component comparison prose says that unchanged views omit exclusions, `excludedResources`. The viewer 0.5.0 reader accepts exclusions on unchanged views. The cloud follows the reader. The 0.17.0 protocol uses another evidence model, so this point is history for the pinned release only.
- **Task:** Check each point against the newest release of the open repository. Report each point that still holds, with the file and the release that show it. Drop each point that a later release fixed. At 0.17.0, only the changelog point clearly still holds, and the fixture point needs the maintainers' answer.
- **Impact if no action:** The upstream docs and diagnostics keep misleading other consumers. The cloud's own contract stays correct, because it follows the shipped code.
- **Needs:** A link or the operator's confirmation of any earlier upstream report. On 2026-10-31 a search found no issue in the open repository, but a report can still exist in a pull request or a discussion. A GitHub account that can open issues on `mokly-ai/mokly`. Opening an issue is an outward-facing action, so confirm it with the owner first.
- **Done when:** Each point that still holds has an upstream issue, and this item is deleted.

`plans/follow-ups/pr-39-doc-fixes-still-apply.md` named the fourth point as its D5 fix. This item now holds all four points.

Source: [the Release Findings](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-dependencies-upgrade.md?plain=1#L30-L94) and [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-dependencies-upgrade.md?plain=1#L1421-L1436) of the deleted plan.
