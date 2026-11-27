# The Testbox doc names a stale ordinary report count

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix.
- **Added:** 2026-11-26, from [PR #547](https://github.com/mokly-ai/mokly/pull/547), review round 1, outside the scope.
- **Location:** `docs/protocol/remote-verification-testbox.md:239`.
- **Category:** Docs or spec.

- **Background:** Remote verification validates the viewer and browser reports with `scripts/verification/aggregate.mjs` and the ordinary runtime profile. `scripts/verification/ci-shards.json` sets the shard totals.
- **Problem:** The doc says that the aggregate accepts "12 now" reports. The current totals give 17: three viewer shards and fourteen browser shards.
- **Impact if no action:** The doc disagrees with the code each time the shard totals change.
- **Options:**
  - **A.** Change the number to 17. Effort: Small.
  - **B.** Remove the number, and link the shard totals. Effort: Small.
- **Recommendation:** B. A count copied into prose goes stale on each rebalance.
- **Action:** fix after merge, apply B.
