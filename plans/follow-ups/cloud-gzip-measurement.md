# Measure hosted gzip publications

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #221 and its completed plan, an unchecked
  post-merge task.
- **Location:** None in this repository. The publications go to Mokly Cloud,
  with `examples/basic/mokly.config.json` as the catalogue.
- **Reason:** The measurement needs Mokly Cloud with the gzip listing on,
  which waits for the two rollout phases after the release.

- **Terms:**
  - **Blob PUT:** one upload request with the bytes of one file that the
    receiver does not hold, addressed by the SHA-256 of the file.
- **Background:**
  - PR #221 merged on 2026-10-27, and release 0.17.0 shipped it on
    2026-10-29. When the Plan response lists `gzip`, the CLI sends each Blob
    body as gzip when gzip makes it smaller.
  - Mokly Cloud keeps Blobs for each project between publications, so a
    repeated publication sends only new contents.
  - On 2026-10-27 at `a9dd1e81`, a first publication of `examples/basic`
    sent 1,453 Blobs with 41.0 MB. Gzip on each file gave 6.0 MB. The 240
    entry details changed with each new `deploymentId` and gave 20.8 MB raw
    and 1.3 MB with gzip.
  - PR #224, merged on 2026-10-29, gave entry details content ids. A local
    build pair then gave 15 new digests and 2,768,086 bytes for one heading
    edit, as PR #224 recorded. Before PR #224, the same edit gave 250
    digests and 23,493,689 bytes. So the repeated publication now sends
    fewer files than on 2026-10-27.
- **Task:**
  1. With the released CLI, publish `examples/basic` to a new Mokly Cloud
     project. Record the Blob count, the gzip and raw Blob counts, the
     request bytes, and the decoded bytes.
  2. Make one small source edit, publish again, and record the same values.
  3. Write the two results and the CLI version into the pull request or the
     plan that closes this item.
- **Impact if no action:** Nobody knows the real gain of gzip uploads at
  Mokly Cloud, or whether the repeated publication still sends large
  bodies.
- **Needs:** [cloud-gzip-listing-rollout.md](./cloud-gzip-listing-rollout.md)
  done, a released CLI, and credentials for a Mokly Cloud project.
- **Done when:** A first and a repeated publication against Mokly Cloud have
  recorded Blob counts, request bytes, and decoded bytes.
- **Related:**
  - [cloud-gzip-listing-rollout.md](./cloud-gzip-listing-rollout.md) turns
    on the gzip listing in Mokly Cloud. This measurement needs it first,
    because without the listing the CLI sends only raw Blobs.
  - [hosted-upload-reuse-check.md](./hosted-upload-reuse-check.md)
    publishes `examples/basic` twice in the same way to check the content
    ids. One pair of publications can serve both tasks after the index
    version 9 release.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/gzip-blob-uploads.md?plain=1#L413).
