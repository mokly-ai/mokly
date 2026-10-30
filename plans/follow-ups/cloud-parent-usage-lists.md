# Teach Mokly Cloud to request parent usage details

- **Severity:** High (estimate). **Effort:** Medium (estimate).
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #223 and its completed plan, an unchecked
  post-merge task.
- **Location:** None in this repository. The `detail` source of the embedded
  viewer lives in `mokly-ai/mokly-cloud`. The rule is in
  `docs/protocol/mokly-viewer.md:104`, and the viewer request is built in
  `packages/viewer/src/catalogue/detail_fences.ts:25`.
- **Reason:** Mokly Cloud pins released Mokly versions, and release 0.17.0
  with PR #223 shipped only on 2026-10-29.

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
  - `docs/protocol/mokly-viewer.md:104` states that a current component
    variant shows the Used by and Affected lists of its parent's detail.
  - `workspaceDetailRequest` in
    `packages/viewer/src/catalogue/detail_fences.ts:25` names the parent's
    path for a current variant. So the embedded viewer calls the host's
    `detail` source with that path.
- **Task:**
  1. In `mokly-ai/mokly-cloud`, pin release 0.17.0 of `@mokly/viewer`.
  2. Make the `detail` source of the embedded viewer answer the parent's
     path when the current route is a component variant.
  3. Publish a catalogue with a component variant. Open the variant in
     Mokly Cloud and check that its Usage panel shows the parent's Used by
     list.
- **Impact if no action:** A component variant page in Mokly Cloud shows no
  Used by or Affected list, or shows an error, because the viewer cannot
  load the parent's detail.
- **Needs:** Release 0.17.0 on npm, and write and deploy access to
  `mokly-ai/mokly-cloud`.
- **Done when:** A current component variant in Mokly Cloud shows the Used
  by and Affected lists of its parent.
- **Related:**
  - [cloud-without-review-json.md](./cloud-without-review-json.md) and
    [cloud-gzip-decoder-rollout.md](./cloud-gzip-decoder-rollout.md) also
    pin release 0.17.0 in `mokly-ai/mokly-cloud`. One pin can serve all
    three tasks.
  - [mokly-cloud-index-v9.md](./mokly-cloud-index-v9.md) upgrades the same
    embedded viewer again for the next release.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/usage-list-in-parent-detail.md?plain=1#L395).
