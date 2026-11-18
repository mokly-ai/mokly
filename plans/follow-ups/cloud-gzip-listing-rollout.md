# Enable gzip Blob uploads in Mokly Cloud

- **Severity:** High. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #221 and its completed plan, an unchecked
  post-merge task.
- **Location:** None in this repository. The listing switch lives in
  `mokly-ai/mokly-cloud`, in
  [`infra/helm/mokly-cloud/values.yaml:64`](https://github.com/mokly-ai/mokly-cloud/blob/767be7b25b1c2aa3138491f32afcc43f20fb2f4f/infra/helm/mokly-cloud/values.yaml#L64).
  The listing rule is in `docs/protocol/mokly-upload-exchange.md:76`.
- **Reason:** The listing may start only after a probe proves that the Mokly
  Cloud edge forwards gzip Blob bodies unchanged, and Mokly Cloud records no
  such probe on 2026-11-18.

- **Terms:**
  - **Blob PUT:** one upload request with the bytes of one file that the
    receiver does not hold, addressed by the SHA-256 of the file.
  - **Listing:** the `gzip` item in the `blobEncodings` field of the Plan
    response. It tells the CLI to send gzip Blob bodies for that upload.
  - **Edge:** the path between the CLI and the Mokly Cloud API: Cloudflare,
    the GCE load balancer, and ingress-nginx.
- **Background:**
  - PR #221 merged on 2026-10-27, and release 0.17.0 shipped it on
    2026-10-29. The CLI sends a gzip Blob body only when the Plan response
    lists `gzip` and gzip makes the body smaller.
  - The rollout has two phases. Phase 1 deploys the decoder on every server,
    while the Plan response lists no `gzip`. Phase 2, this task, turns on
    the listing through a configuration switch.
  - On 2026-10-27 the user chose that the `mokly-ai/mokly-cloud` repository
    owns the receiver change, with its own plan and pull request.
  - `docs/protocol/mokly-upload-exchange.md:76` allows the listing only when
    the receiver decodes gzip Blobs for the whole upload, until it expires.
  - Phase 1 is done. The deleted item that tracked it is
    [`cloud-gzip-decoder-rollout.md`](https://github.com/mokly-ai/mokly/blob/be242a628db21c24212b105c5a1f7277de2e8a29/plans/follow-ups/cloud-gzip-decoder-rollout.md?plain=1).
    Facts checked on 2026-11-18 at the Cloud `main` commit `767be7b2`:
    - On 2026-10-28, Cloud commit `21bb03ac` added the decoder under the gzip
      rules of `docs/protocol/mokly-upload-validation.md`.
      `crates/mkc-api/src/upload_blob_decode.rs:49-96` bounds the decoding
      and checks the decoded size, and the receiver stores only the decoded
      bytes.
    - In `crates/mkc-api/src/upload_blob.rs`, line 27 keeps the 120-second
      reception bound. Line 79 rejects a gzip body whose length is greater
      than the declared size. Lines 148-151 accept gzip and reject every
      other `Content-Encoding`.
    - The
      [Deploy run 41685858274](https://github.com/mokly-ai/mokly-cloud/actions/runs/41685858274)
      at `908484d2` and the
      [Deploy run 44092627866](https://github.com/mokly-ai/mokly-cloud/actions/runs/44092627866)
      at `6d5163d6` passed, including the job that deploys the production
      workloads. Both commits hold the decoder.
    - Cloud pins Mokly 0.19.0, a release that holds PR #221. Its contract
      fixtures come from 0.19.0, in
      `crates/mkc-mokly-contract/fixtures/checksums.json:2`.
    - The listing is still off. `infra/helm/mokly-cloud/values.yaml:64` sets
      `api.uploadBlobGzip` to false.
  - The edge probe is not done. The Cloud item
    [`plans/follow-ups/gzip-edge-forwarding-unproven.md`](https://github.com/mokly-ai/mokly-cloud/blob/767be7b25b1c2aa3138491f32afcc43f20fb2f4f/plans/follow-ups/gzip-edge-forwarding-unproven.md)
    records it. The probe sends a known gzip Blob through the public API
    origin. It compares the `Content-Encoding`, the encoded
    `Content-Length`, and the raw body bytes with a direct path. An edge
    that decodes or strips `Content-Encoding` would break gzip uploads when
    the listing turns on.
  - Rollback turns the listing off first. The decoder stays until every
    upload with a gzip Plan has expired, 60 minutes at Mokly Cloud. A CLI
    downgrade needs no receiver step, because earlier CLIs ignore the field.
  - On 2026-10-27, a local receiver that listed gzip got 868 gzip Blobs and
    1 raw Blob from `examples/basic` with `--no-changes`: 3,946,586 request
    bytes for 31,520,965 decoded bytes.
- **Task:**
  1. Done: every Mokly Cloud server that receives Blobs runs the decoder of
     phase 1. The Background gives the evidence.
  2. Wait until the edge probe of the Cloud item
     `plans/follow-ups/gzip-edge-forwarding-unproven.md` passes. Do not turn
     on the listing before the probe passes.
  3. Turn on the listing in a preview environment.
  4. Publish `examples/basic` there with the released CLI, 0.17.0 or later.
  5. Confirm that the Blob PUTs carry `Content-Encoding: gzip`, that each
     body is at most its declared size, and that the publication completes.
  6. Turn on the listing in production.
- **Impact if no action:** Mokly Cloud keeps raw uploads. A first
  publication of `examples/basic` then sends about 41 MB instead of about
  6 MB, as measured on 2026-10-27.
- **Needs:** A recorded edge probe that shows that the Mokly Cloud edge
  forwards gzip Blob bodies unchanged, write and deploy access to
  `mokly-ai/mokly-cloud`, a preview environment, and credentials for a test
  project there. The decoder is already on every server.
- **Done when:** The production Plan response lists `gzip`, and a
  publication of `examples/basic` with the released CLI completes with gzip
  Blob PUTs.
- **Related:**
  - The Cloud item `plans/follow-ups/gzip-edge-forwarding-unproven.md`, in
    `mokly-ai/mokly-cloud`, holds the edge probe. On 2026-11-18 the probe is
    not done, and it blocks the listing.
  - [cloud-gzip-measurement.md](./cloud-gzip-measurement.md) measures the
    publications after this task.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/gzip-blob-uploads.md?plain=1#L411).
