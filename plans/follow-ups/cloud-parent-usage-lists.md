# Check parent usage lists in Mokly Cloud

- **Severity:** High. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #223 and its completed plan, an unchecked
  post-merge task.
- **Location:** None in this repository. The `detail` source of the embedded
  viewer lives in `mokly-ai/mokly-cloud`, in
  [`ts/app/src/viewer/catalogue-source.web.ts:151-167`](https://github.com/mokly-ai/mokly-cloud/blob/767be7b25b1c2aa3138491f32afcc43f20fb2f4f/ts/app/src/viewer/catalogue-source.web.ts#L151-L167).
  Its browser spec
  [`ts/app/src/_tests_/viewer/entry.spec.ts:147-170`](https://github.com/mokly-ai/mokly-cloud/blob/767be7b25b1c2aa3138491f32afcc43f20fb2f4f/ts/app/src/_tests_/viewer/entry.spec.ts#L147-L170)
  opens a variant. The rule is in `docs/protocol/mokly-viewer.md:104`, and
  the viewer request is built in
  `packages/viewer/src/catalogue/detail_fences.ts:25`.
- **Reason:** Mokly Cloud now answers the parent's path, but no check proves
  that a published variant in Mokly Cloud shows both lists of its parent.

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
  - Facts about Mokly Cloud, checked on 2026-11-18 at its `main` commit
    `767be7b2`:
    - `ts/app/package.json:22` pins `@mokly/viewer` 0.19.0, a later release
      than 0.17.0.
    - `detailSource` in `ts/app/src/viewer/catalogue-source.web.ts:151-167`
      reads each path that the viewer requests. So it also answers the
      parent's path of a current variant.
    - The browser spec `ts/app/src/_tests_/viewer/entry.spec.ts:147-170`
      opens the variant `notice/draft`. It does not check the Used by list
      or the Affected list.
- **Task:**
  1. Done: Mokly Cloud pins `@mokly/viewer` 0.19.0, a later release than
     0.17.0.
  2. Done: the `detail` source of the embedded viewer answers each requested
     path, which includes the parent's path of a component variant.
  3. Publish a catalogue with a component variant. Open the variant in
     Mokly Cloud. Check that its Usage panel shows the parent's Used by list
     and the parent's Affected list.
- **Impact if no action:** Nobody confirms that a component variant page in
  Mokly Cloud shows the Used by and Affected lists of its parent. A defect
  in the host can then hide both lists, or show an error, without notice.
- **Needs:** A catalogue with a component variant, published to Mokly Cloud,
  and access to open it there. The pin and the `detail` source are already
  in Mokly Cloud.
- **Done when:** A current component variant in Mokly Cloud shows the Used
  by and Affected lists of its parent.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/usage-list-in-parent-detail.md?plain=1#L395).
