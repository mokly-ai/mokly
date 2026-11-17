# Gzip Blob edge forwarding is unproven

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the first two unchecked post-merge tasks of the deleted `plans/gzip-blob-uploads-receiver.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/ops/publish-smoke.md`, section "Gzip Blob rollout".
- **Reason:** The probe needs the deployed receiver behind the real Cloudflare, GCE and ingress-nginx path, which no local test can run.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify the edge probe. The repository holds no record of it, and the evidence file that the runbook names is not present. The audit could not read the deployed switch values.

- **Terms:**
  - **Blob:** One file body that `mokly publish` uploads in the upload exchange.
  - **Phase 1:** The rollout step that deploys the gzip decoder to every API receiver while the Plan still lists no encoding.
  - **Edge:** The path between the CLI and the API: Cloudflare, the GCE load balancer and ingress-nginx.
- **Background:** The list below gives the facts.
  - PR #76 merged on 2026-10-28. Every Blob receiver now decodes a gzip body in a bounded stream, checks the decoded size and digest, and stores only decoded bytes.
  - The Plan lists gzip only when `api.uploadBlobGzip` is true. Its chart default in `infra/helm/mokly-cloud/values.yaml:64` is false, and the audit could not read the deployed values.
  - `docs/ops/publish-smoke.md:139-158` gives the rollout procedure.
  - The repository holds no record of the probe. The runbook tells the operator to keep the evidence in a file under `.context/`, which Git ignores.
- **Task:** Run Phase 1 and the edge probe.
  - Confirm that every API receiver runs a release with the decoder, with `api.uploadBlobGzip` false.
  - Send a known gzip Blob through the public preview API origin.
  - Compare its `Content-Encoding`, encoded `Content-Length` and raw body bytes with a direct receiver or a temporary edge echo target.
  - Confirm that the API accepts the unchanged encoded request and stores the expected decoded digest.
  - Record a sanitized summary of the result in the "Gzip Blob rollout" section of `docs/ops/publish-smoke.md`, so that the proof outlives the ignored evidence file.
- **Impact if no action:** An edge that decodes or strips `Content-Encoding` would break gzip uploads when the listing turns on.
- **Needs:** A deployed preview with the decoder, and access to edge logs or a temporary echo backend. The effort counts code changes only, and this task specifies none.
- **Done when:** The runbook records a probe that shows the edge forwards gzip Blob bodies unchanged. The record gives the receiver revision of each API replica. It shows the same `Content-Encoding`, encoded `Content-Length` and raw body bytes on the public and the direct path. It also gives the decoded size and digest, with a successful completion and catalogue read.
- **Related:** `plans/follow-ups/gzip-listing-waits-for-upstream-release.md` turns the listing on after this probe.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/gzip-blob-uploads-receiver.md?plain=1#L221-L230) of the deleted plan.
