# Gzip decoder rollout and edge forwarding are unproven

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the first two unchecked post-merge tasks of the deleted `plans/gzip-blob-uploads-receiver.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/ops/publish-smoke.md`, section "Gzip Blob rollout". The decoder is in `crates/mkc-api/src/upload_blob.rs` and `crates/mkc-api/src/upload_blob_decode.rs`.
- **Reason:** The probe needs the deployed receiver behind the real Cloudflare, GCE and ingress-nginx path, which no local test can run.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify the edge probe. The repository holds no record of it, and the evidence file that the runbook names is not present. The audit could not read the deployed switch values.

- **Terms:**
  - **Blob:** One file body that `mokly publish` uploads in the upload exchange.
  - **Listing:** the `gzip` item in the `blobEncodings` field of the Plan response. It tells the CLI that it can send gzip Blob bodies for that upload.
  - **Phase 1:** The rollout step that deploys the gzip decoder to every API receiver while the Plan still lists no encoding.
  - **Edge:** The path between the CLI and the API: Cloudflare, the GCE load balancer and ingress-nginx.
- **Background:** The list below gives the facts.
  - On 2026-10-27 the user chose that the CLI sends a Blob body as gzip only when the Plan response lists `gzip` and gzip makes the body smaller. Mokly PR #221 added this, and release 0.17.0 shipped it on 2026-10-29. A receiver that never lists the field keeps getting raw Blobs.
  - On 2026-10-27, a first publication of `examples/basic` sent 1,453 Blobs with 41.0 MB. Gzip on each file gave 6.0 MB.
  - Before the decoder, Mokly Cloud answered 400 to any `Content-Encoding`, and the CLI reports that as `upload-invalid-bundle`. So every receiver must decode before any receiver lists `gzip`. `docs/protocol/mokly-upload-exchange.md:76` allows the listing only when the receiver decodes gzip Blobs for the whole upload, until it expires.
  - PR #76 of the old cloud repository merged the decoder on 2026-10-28, as `21bb03ac`. Every Blob receiver now decodes a gzip body in a bounded stream, checks the decoded size and digest, and stores only decoded bytes. The rules are in `docs/protocol/mokly-upload-validation.md:92-97` and `docs/protocol/cloud/publication-upload-exchange.md:76-112`.
  - The cloud uses the workspace Mokly packages of this repository, at 0.19.0 or later, so its CLI sends gzip Blobs. Its contract fixture `crates/mkc-mokly-contract/fixtures/upload-plan-v1.json` holds the `blobEncodings` cases.
  - The Plan lists gzip only when `api.uploadBlobGzip` is true. The chart sets it as `MKC_UPLOAD_BLOB_GZIP`. Its chart default in `infra/helm/mokly-cloud/values.yaml:64` is false, and the rendered production, main-preview and PR preview values under `infra/helm/tests/golden/` set it to `"false"`. The audit could not read the deployed values.
  - `docs/ops/publish-smoke.md:143-163` gives the rollout procedure.
  - The repository holds no record of the probe. The runbook tells the operator to keep the evidence in a file under `.context/`, which Git ignores.
  - On 2026-11-17 this item took in `plans/follow-ups/cloud-gzip-decoder-rollout.md`. Its pin, fixture and decoder steps are done, and its deploy step is Phase 1 of this item.
- **Task:** Run Phase 1 and the edge probe.
  - Confirm that every API receiver runs a release with the decoder, with `api.uploadBlobGzip` false.
  - Send a known gzip Blob through the public preview API origin.
  - Compare its `Content-Encoding`, encoded `Content-Length` and raw body bytes with a direct receiver or a temporary edge echo target.
  - Confirm that the API accepts the unchanged encoded request and stores the expected decoded digest.
  - Record a sanitized summary of the result in the "Gzip Blob rollout" section of `docs/ops/publish-smoke.md`, so that the proof outlives the ignored evidence file.
- **Impact if no action:** The listing cannot start, so a first publication of `examples/basic` keeps sending about 41 MB instead of about 6 MB. An edge that decodes or strips `Content-Encoding` would break gzip uploads when the listing turns on.
- **Needs:** A deployed preview with the decoder, and access to edge logs or a temporary echo backend. The effort counts code changes only, and this task specifies none.
- **Done when:** Every API receiver runs the decoder with the listing off. The runbook records a probe that shows the edge forwards gzip Blob bodies unchanged. The record gives the receiver revision of each API replica. It shows the same `Content-Encoding`, encoded `Content-Length` and raw body bytes on the public and the direct path. It also gives the decoded size and digest, with a successful completion and catalogue read.
- **Related:** `plans/follow-ups/cloud-gzip-listing-rollout.md` turns the listing on after this probe.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/gzip-blob-uploads-receiver.md?plain=1#L221-L230) of the deleted plan, and [the gzip upload plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/gzip-blob-uploads.md?plain=1#L409).
