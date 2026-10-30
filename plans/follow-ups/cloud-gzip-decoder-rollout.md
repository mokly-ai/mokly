# Deploy the Mokly Cloud gzip decoder

- **Severity:** High (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #221 and its completed plan, an unchecked
  post-merge task.
- **Location:** None in this repository. The receiver lives in
  `mokly-ai/mokly-cloud`. Its rules are in
  `docs/protocol/mokly-upload-exchange.md:73` and
  `docs/protocol/mokly-upload-validation.md:91`.
- **Reason:** Mokly Cloud pins released Mokly versions, and release 0.17.0,
  which holds PR #221, shipped only on 2026-10-29.

- **Terms:**
  - **Blob PUT:** one upload request with the bytes of one file that the
    receiver does not hold, addressed by the SHA-256 of the file.
  - **Plan response:** the receiver's answer to the Plan request of
    `mokly publish`. It lists the missing digests and the optional
    `blobEncodings` field.
- **Background:**
  - PR #221 merged on 2026-10-27 under the user's decision of that day. When
    the Plan response lists `gzip` in `blobEncodings`, the CLI sends each
    Blob body as gzip when gzip makes it smaller. Earlier receivers never
    list the field, so they keep getting raw Blobs. Release 0.17.0 shipped
    the change on 2026-10-29.
  - On 2026-10-27, a first publication of `examples/basic` sent 1,453 Blobs
    with 41.0 MB. Gzip on each file gave 6.0 MB.
  - The receiver rules of `docs/protocol/mokly-upload-validation.md:91`:
    - A gzip Blob whose `Content-Length` is greater than the declared file
      size gets 400 before the receiver reads the body.
    - The receiver stream-decodes the body and stops after the declared size
      plus one byte.
    - Invalid gzip data, a decoded size other than the declared size, or a
      decoded SHA-256 other than the URL digest gets 400, and the receiver
      stores nothing.
    - Any other `Content-Encoding` gets 400. Raw Blobs keep their rules.
  - `docs/protocol/mokly-upload-exchange.md:76` allows the listing only when
    the receiver decodes gzip Blobs for the whole upload, until it expires.
  - On 2026-10-27 Mokly Cloud answered 400 to any `Content-Encoding`. The
    CLI reports that as `upload-invalid-bundle`. So every server must decode
    before any server lists `gzip`.
  - On 2026-10-27 the user chose that the `mokly-ai/mokly-cloud` repository
    owns the receiver change, with its own plan and pull request.
  - On 2026-10-28 PR #76 of `mokly-ai/mokly-cloud` merged the decoder, as
    `21bb03ac`, with the listing switch `MKC_UPLOAD_BLOB_GZIP` off by
    default. So step 3 of the Task is done in code. Steps 1, 2, and 4
    remain.
- **Task:**
  1. In `mokly-ai/mokly-cloud`, pin release 0.17.0, or a later release that
     holds PR #221.
  2. Refresh the contract fixtures from that release. They include the
     `blobEncoding` cases of `docs/protocol/fixtures/upload-plan-v1.json`.
  3. Decode gzip Blob PUTs under the receiver rules above. Keep the
     120-second reception bound.
  4. Deploy the decoder on every server that receives Blobs. Do not list
     `gzip` in the Plan response yet.
- **Impact if no action:** The listing cannot start, so Mokly Cloud keeps
  raw uploads. A first publication of `examples/basic` then sends about
  41 MB instead of about 6 MB.
- **Needs:** Write and deploy access to `mokly-ai/mokly-cloud`, and release
  0.17.0 on npm.
- **Done when:** Every Mokly Cloud server that receives Blobs decodes gzip
  Blob PUTs under these rules, the Plan response still lists no `gzip`, and
  the contract fixtures come from the pinned release.
- **Related:**
  - [cloud-gzip-listing-rollout.md](./cloud-gzip-listing-rollout.md) is the
    next phase. It starts only after this task reaches every server.
  - [cloud-without-review-json.md](./cloud-without-review-json.md) and
    [cloud-parent-usage-lists.md](./cloud-parent-usage-lists.md) also pin
    release 0.17.0 in `mokly-ai/mokly-cloud`. One pin and one fixture
    refresh can serve all three tasks.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/gzip-blob-uploads.md?plain=1#L409).
