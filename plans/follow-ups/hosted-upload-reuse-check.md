# Confirm that hosted uploads skip unchanged details

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #224.
- **Location:** None in the code. The check publishes
  `examples/basic/mokly.config.json` to Mokly Cloud. The Plan answer follows
  `docs/protocol/mokly-upload-exchange.md`.
- **Reason:** The check needs the released change, a Mokly Cloud project that
  accepts index version 9, and its credentials.

- **Terms:**
  - **Entry detail:** the JSON file of one screen or component in the
    catalogue output.
  - **Plan answer:** the receiver's answer to the Plan request of
    `mokly publish`. It lists the digests of the files that it does not
    hold, so the CLI uploads only those files.
- **Background:**
  - Before PR #224, each entry detail carried the build's `deploymentId`. So
    each new publication sent every detail again.
  - On 2026-10-27 the user chose that each detail carries its own content
    id, `detailId`, and that the index lists it. The user also chose a small
    `mokly-viewer/deployment.json` file, so that an open tab still notices a
    new deployment.
  - PR #224 merged on 2026-10-29. An unchanged detail now keeps its exact
    bytes from one build to the next.
  - A local build pair of `examples/basic` with one heading edit gave 15 new
    digests and 2,768,086 bytes, as PR #224 recorded. The first text of this
    item said 2,768,084 bytes. Before PR #224, the same edit gave 250 digests
    and 23,493,689 bytes. Most of the rest is the index and the ownership
    marker.
- **Task:**
  1. With the released CLI that holds PR #224, publish `examples/basic` to a
     Mokly Cloud project that accepts index version 9.
  2. Edit one heading of one entry, commit the edit, and publish again.
  3. Read the second Plan answer. Confirm that it asks only for the changed
     files: the index, the ownership marker, the deployment file, and the
     details, documents, and snapshots of the edited entries.
  4. Record the digest count and the bytes of the second publication.
- **Impact if no action:** Nobody confirms that hosted publications get the
  reuse that the local builds show. A receiver defect can then keep the old
  upload size unnoticed.
- **Needs:** The release that holds PR #224, a Mokly Cloud project that
  accepts index version 9, and credentials for it.
- **Done when:** The second Plan answer lists only the changed files, and
  the recorded digest count and bytes are close to the local build pair.
- **Related:**
  - [mokly-cloud-index-v9.md](./mokly-cloud-index-v9.md) makes Mokly Cloud
    accept index version 9, which this check needs first.
  - [release-detail-content-ids.md](./release-detail-content-ids.md) is the
    release that this check uses.
  - [cloud-gzip-measurement.md](./cloud-gzip-measurement.md) measures a
    first and a repeated publication too. One pair of publications can
    serve both tasks.
