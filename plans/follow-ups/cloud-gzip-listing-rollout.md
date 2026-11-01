# Enable gzip Blob uploads in Mokly Cloud

- **Severity:** High. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #221 and its completed plan, an unchecked
  post-merge task.
- **Location:** None in this repository. The listing switch lives in
  `mokly-ai/mokly-cloud`. The listing rule is in
  `docs/protocol/mokly-upload-exchange.md:76`.
- **Reason:** The listing may start only after every Mokly Cloud server runs
  the gzip decoder, which itself waits for the release of PR #221.

- **Terms:**
  - **Blob PUT:** one upload request with the bytes of one file that the
    receiver does not hold, addressed by the SHA-256 of the file.
  - **Listing:** the `gzip` item in the `blobEncodings` field of the Plan
    response. It tells the CLI to send gzip Blob bodies for that upload.
- **Background:**
  - PR #221 merged on 2026-10-27, and release 0.17.0 shipped it on
    2026-10-29. The CLI sends a gzip Blob body only when the Plan response
    lists `gzip` and gzip makes the body smaller.
  - The rollout has two phases. Phase 1 deploys the decoder on every server,
    in [cloud-gzip-decoder-rollout.md](./cloud-gzip-decoder-rollout.md).
    Phase 2, this task, turns on the listing through a configuration switch.
  - `docs/protocol/mokly-upload-exchange.md:76` allows the listing only when
    the receiver decodes gzip Blobs for the whole upload, until it expires.
  - Rollback turns the listing off first. The decoder stays until every
    upload with a gzip Plan has expired, 60 minutes at Mokly Cloud. A CLI
    downgrade needs no receiver step, because earlier CLIs ignore the field.
  - On 2026-10-27, a local receiver that listed gzip got 868 gzip Blobs and
    1 raw Blob from `examples/basic` with `--no-changes`: 3,946,586 request
    bytes for 31,520,965 decoded bytes.
- **Task:**
  1. Confirm that every Mokly Cloud server that receives Blobs runs the
     decoder of phase 1.
  2. Turn on the listing in a preview environment.
  3. Publish `examples/basic` there with the released CLI, 0.17.0 or later.
  4. Confirm that the Blob PUTs carry `Content-Encoding: gzip`, that each
     body is at most its declared size, and that the publication completes.
  5. Turn on the listing in production.
- **Impact if no action:** Mokly Cloud keeps raw uploads. A first
  publication of `examples/basic` then sends about 41 MB instead of about
  6 MB, as measured on 2026-10-27.
- **Needs:** The decoder on every server, write and deploy access to
  `mokly-ai/mokly-cloud`, a preview environment, and credentials for a test
  project there.
- **Done when:** The production Plan response lists `gzip`, and a
  publication of `examples/basic` with the released CLI completes with gzip
  Blob PUTs.
- **Related:**
  - [cloud-gzip-decoder-rollout.md](./cloud-gzip-decoder-rollout.md) is the
    first phase, which this task needs.
  - [cloud-gzip-measurement.md](./cloud-gzip-measurement.md) measures the
    publications after this task.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/gzip-blob-uploads.md?plain=1#L411).
