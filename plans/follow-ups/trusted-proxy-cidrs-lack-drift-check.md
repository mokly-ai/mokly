# Trusted proxy CIDRs lack a drift check

- **Severity:** Medium. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone F8 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `infra/helm/mokly-cloud/values.yaml:35-59`, `infra/scripts/preview-platform-helper.py:93-113` and the Helm goldens under `infra/helm/tests/golden/`.
- **Reason:** The fix is a new check that reads an external source, and its form needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. No job compares the ranges with Cloudflare. On 2026-10-31 the official Cloudflare API listed the same 22 ranges as the chart.
- **Category:** Security.

- **Terms:**
  - **Trusted proxies:** The CIDR list whose `X-Forwarded-For` the API trusts: the Cloudflare edge ranges, plus the internal and load-balancer ranges of each path.
- **Background:** The review at `e963ba61` on 2026-09-17 graded this Medium. The Cloudflare ranges in `values.yaml:35-59` have no drift check against Cloudflare's published ranges. The user accepted the finding without applying it. On 2026-10-31 the official Cloudflare API returned the same 22 ranges as the chart: 15 IPv4 and 7 IPv6 networks. None was missing, and none was extra.
- **Problem:** No drift exists today, but nothing would report one. When Cloudflare adds an edge range, requests from it are not trusted, and when it retires one, the old range stays trusted.
- **Impact if no action:** Readers behind a new range share the edge's address for rate limits. A retired range that someone else later holds could forge client addresses.
- **Root question:** How does the trusted-proxy list follow Cloudflare's published ranges?
- **Options:**
  - **A.** Add a runbook step that compares the list with Cloudflare's published ranges before each release. Effort: Small.
  - **B.** Add a scheduled CI job that fetches the published ranges and fails on a difference. It is a new check with a network dependency, and it is not approved. Effort: Medium.
- **Left out:** A check inside the gate. The gate must not depend on an external service, as the `deterministic-tests` skill says.
- **Wider fix:** B. A scheduled check finds every drift.
- **Previous examples:** None found.
- **Recommendation:** B. Range changes are rare, and a scheduled job finds them without an operator. The acceptance of 2026-09-20 did not choose this design.
- **Action:** ask the user, because condition 3 holds: B adds a new check.

Source: [Milestone F8](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1010-L1051) of the deleted plan.
