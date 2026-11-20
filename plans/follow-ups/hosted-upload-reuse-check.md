# Confirm that hosted uploads skip unchanged details

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #224.
- **Location:** None in the code. The check publishes
  `examples/basic/mokly.config.json` to a deployed Mokly Cloud environment.
  The Plan answer follows `docs/protocol/mokly-upload-exchange.md`.
- **Reason:** The check needs a live publication to a deployed Mokly Cloud
  project, with credentials for that project, and no such publication is
  recorded yet.

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
  - Release 0.18.0 is the first release that holds PR #224. It reached
    GitHub and npm on 2026-11-01. Its `CHANGELOG.md` entry carries the
    breaking-change note of index version 9 and entry detail version 4.
  - The cloud receiver reads index version 9 only, in `CatalogueIndex::parse`
    of `crates/mkc-mokly-contract/src/index.rs`.
  - Mokly Cloud accepts index version 9 in production. Facts checked on
    2026-11-18 at the Cloud `main` commit `767be7b2`:
    - On 2026-11-03, Cloud commit `908484d2` adopted 0.18.0 and index
      version 9. Its
      [Deploy run 41685858274](https://github.com/mokly-ai/mokly-cloud/actions/runs/41685858274)
      passed, including the job that deploys the production workloads.
    - On 2026-11-17, Cloud commit `6d5163d6` moved the pins to 0.19.0. Its
      [Deploy run 44092627866](https://github.com/mokly-ai/mokly-cloud/actions/runs/44092627866)
      passed, including the same production job. Release 0.19.0 keeps index
      version 9.
  - The deploy runbook `docs/ops/deploy.md` records no credentialed publish
    proof with 0.19.0. Its only recorded publish proof, of 2026-09-20, used
    `@mokly/mokly@0.11.0`, at lines 701-717. Lines 801-802 ask for a new
    credentialed proof after the cutover. So no live publication that shows
    the reuse is recorded.
- **Task:**
  1. With a Mokly CLI that holds PR #224, 0.18.0 or later, publish
     `examples/basic` to a Mokly Cloud project.
  2. Edit one heading of one entry, commit the edit, and publish again.
  3. Read the second Plan answer. Confirm that it asks only for the changed
     files: the index, the ownership marker, the deployment file, and the
     details, documents, and snapshots of the edited entries.
  4. Record the digest count and the bytes of the second publication.
- **Impact if no action:** Nobody confirms that hosted publications get the
  reuse that the local builds show. A receiver defect can then keep the old
  upload size unnoticed.
- **Needs:** A project in a deployed Mokly Cloud environment, and
  credentials for it. A Mokly CLI that holds PR #224, 0.18.0 or later, and a
  Cloud receiver that accepts index version 9 already exist.
- **Done when:** The second Plan answer lists only the changed files, and
  the recorded digest count and bytes are close to the local build pair.
- **Related:**
  - [receiver-read-model-validation.md](./receiver-read-model-validation.md)
    deploys the receiver's content check. That check reads each reused
    detail Blob again against the index of each new upload.
  - [cloud-gzip-measurement.md](./cloud-gzip-measurement.md) measures a
    first and a repeated publication too. One pair of publications can
    serve both tasks.
