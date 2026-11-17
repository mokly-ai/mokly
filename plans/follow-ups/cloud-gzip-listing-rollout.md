# Enable gzip Blob uploads in Mokly Cloud

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #221 and its completed plan, an unchecked
  post-merge task.
- **Location:** The listing switch defaults to false in
  `infra/helm/mokly-cloud/values.yaml:64`, and no environment sets it. The
  listing rule is in `docs/protocol/mokly-upload-exchange.md:76`, and the
  rollout steps are in `docs/ops/publish-smoke.md:157-163`.
- **Reason:** The listing may start only after the decoder runs on every
  deployed receiver and the edge probe of
  `plans/follow-ups/gzip-edge-forwarding-unproven.md` passes.

- **Terms:**
  - **Blob PUT:** one upload request with the bytes of one file that the
    receiver does not hold, addressed by the SHA-256 of the file.
  - **Listing:** the `gzip` item in the `blobEncodings` field of the Plan
    response. It tells the CLI to send gzip Blob bodies for that upload.
  - **Listing switch:** `MKC_UPLOAD_BLOB_GZIP`, the Helm value
    `api.uploadBlobGzip`. It controls only the listing. The decoder runs
    whatever its value is.
- **Background:**
  - PR #221 merged on 2026-10-27, and release 0.17.0 shipped it on
    2026-10-29. The CLI sends a gzip Blob body only when the Plan response
    lists `gzip` and gzip makes the body smaller. An earlier CLI ignores the
    field.
  - On 2026-10-27 the user approved the gzip receiver. The decisions keep
    Plan v1 with the optional field, choose compression for each Blob, and
    deploy decoding before the listing.
  - The rollout has two phases. Phase 1 deploys the decoder on every server
    and proves the edge, in
    [gzip-edge-forwarding-unproven.md](./gzip-edge-forwarding-unproven.md).
    Phase 2, this task, turns on the listing through the listing switch.
  - The cloud uses the workspace Mokly packages of this repository, at
    0.19.0 or later, so no pin change is needed before the listing.
  - Rollback turns the listing off first. The decoder stays until every
    upload with a gzip Plan has expired, 60 minutes at Mokly Cloud. A CLI
    downgrade needs no receiver step, because earlier CLIs ignore the field.
  - On 2026-10-27, a local receiver that listed gzip got 868 gzip Blobs and
    1 raw Blob from `examples/basic` with `--no-changes`: 3,946,586 request
    bytes for 31,520,965 decoded bytes.
  - On 2026-11-17 this item took in
    `plans/follow-ups/gzip-listing-waits-for-upstream-release.md`, the
    cloud copy of the same task. The workspace packages replace its pin and
    fixture steps.
- **Task:**
  1. Confirm that Phase 1 and the edge probe passed.
  2. Turn on the listing switch in one preview environment.
  3. Publish `examples/basic` there with a Mokly CLI at 0.17.0 or later, and
     run the published-CLI smoke of `docs/ops/publish-smoke.md`.
  4. Confirm that the Plan lists `["gzip"]`, that a smaller Blob carries
     `Content-Encoding: gzip`, that each body is at most its declared size,
     that an unhelpful compression stays raw, and that completion and
     catalogue reads succeed.
  5. Record a summary of the preview smoke in the "Gzip Blob rollout"
     section of `docs/ops/publish-smoke.md`.
  6. Turn on the listing in main-preview and production only after that
     check.
- **Impact if no action:** Mokly Cloud keeps raw uploads. A first
  publication of `examples/basic` then sends about 41 MB instead of about
  6 MB, as measured on 2026-10-27.
- **Needs:** Phase 1 and the edge probe done, deploy access to the preview
  and stable environments, and credentials for a test project there.
- **Done when:** The production Plan response lists `gzip`, a publication
  of `examples/basic` completes with gzip Blob PUTs, and the runbook records
  the preview smoke.
- **Related:**
  - [gzip-edge-forwarding-unproven.md](./gzip-edge-forwarding-unproven.md)
    is the first phase, which this task needs.
  - [cloud-gzip-measurement.md](./cloud-gzip-measurement.md) measures the
    publications after this task.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/gzip-blob-uploads.md?plain=1#L411), and the cloud copy came from [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/gzip-blob-uploads-receiver.md?plain=1#L221-L230) of the deleted cloud plan.
