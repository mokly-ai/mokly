# Gzip Blob adoption and listing remain undone

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the last two unchecked post-merge tasks of the deleted `plans/gzip-blob-uploads-receiver.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `infra/helm/mokly-cloud/values.yaml:64`, `crates/mkc-mokly-contract/fixtures/` and `docs/ops/publish-smoke.md`.
- **Reason:** The pinned `@mokly/mokly@0.14.0` does not send gzip, and the adoption of a release that sends it is a deliberate pin change of its own.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. The cloud still pins `@mokly/mokly@0.14.0`, and the chart default of the listing switch is false. The published 0.17.0 release already sends gzip.

- **Terms:**
  - **Plan v1:** The first request of the upload exchange. Its optional `blobEncodings` field lists `["gzip"]` when the receiver accepts gzip.
  - **Listing switch:** `MKC_UPLOAD_BLOB_GZIP`, the Helm value `api.uploadBlobGzip`, which controls only the Plan advertisement.
- **Background:** The list below gives the facts.
  - The user approved the gzip receiver on 2026-10-27. The decisions keep Plan v1 with the optional field, choose compression per Blob, and deploy decoding before advertisement.
  - `docs/protocol/publication-upload-exchange.md` defines the field.
  - The cloud pins `@mokly/mokly@0.14.0`, which does not send gzip.
  - The open repository merged gzip sending in its PR #221 on 2026-10-27. The registry published 0.17.0 on 2026-10-29, and its changelog lists gzip Blob sending.
  - Its upload protocol defines the optional `blobEncodings`, gzip for a smaller body and the raw fallback.
  - 0.17.0 also changes the catalogue and detail boundary and moves the upload metadata to version 3.
- **Task:** Adopt a release that sends gzip, such as 0.17.0, with the steps below in order.
  - Read the release's protocol and fixture files.
  - Bump the pin deliberately in its own change, as `AGENTS.md` requires, if the cloud adopts that release.
  - Run `cargo xtask mokly-fixtures`, review the byte changes, and run `cargo xtask mokly-fixtures --check`.
  - After the edge probe of `plans/follow-ups/gzip-edge-forwarding-unproven.md` passes, set the listing switch to true in one preview environment.
  - Run the published CLI smoke. Check that the Plan lists `["gzip"]` and that a smaller Blob carries `Content-Encoding: gzip`.
  - Check that an unhelpful compression stays raw, and that completion and catalogue reads succeed.
  - Enable the stable environments only after that check.
  - To roll back, turn the switch off first. Keep the decoder for the full 60-minute upload lifetime.
- **Impact if no action:** Uploads stay raw, so each publish sends more bytes than it needs to.
- **Needs:** The 0.17.0 release or a later one, the deliberate pin change, and a preview environment. The pin and artifact-boundary adoption is Large, because 0.17.0 also changes the format versions.
- **Done when:** The stable environments list gzip, and the runbook records the preview smoke.
- **Related:** `plans/follow-ups/gzip-edge-forwarding-unproven.md` proves the edge first.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/gzip-blob-uploads-receiver.md?plain=1#L221-L230) of the deleted plan.
