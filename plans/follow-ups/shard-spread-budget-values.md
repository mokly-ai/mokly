# Shard spread budgets sit near runner noise

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from branch `calummoore/ci-speed-shard-balance-tooling-nnht`.
- **Location:** `scripts/verification/ci-budgets.json` (the `shardGroups` field), `docs/protocol/ci-duration-budgets.md#shard-balance`.
- **Reason:** The right budget values need data from runs with the refreshed weights, and the choice between absolute, relative, and multi-run budgets is the user's.

- **Terms:**
  - **Shard group:** An entry of `shardGroups` in `scripts/verification/ci-budgets.json`. It names the CI jobs that split one suite, such as the 14 `Browser` shards.
  - **Spread:** The run time of the slowest passed shard of a group minus that of its fastest passed shard, in one run.
- **Background:** The `CI timing` summary warns when the spread of a group passes its `spreadMinutes` budget. Every group starts at 2 minutes, because runner speed alone varies by up to about 2 minutes. Over 8 green `main` runs before the weight refresh, the median spreads were about 3 minutes for Browser, 2 minutes for App, and 3 to 5 minutes for the Native groups.
- **Problem:** A budget equal to the noise of one shard is smaller than the expected spread of many noisy shards. Most runs can warn for the Browser, App, and Native groups.
- **Impact if no action:** Readers learn to ignore the warning, so they miss a real stale weight.
- **Root question:** How does the report tell a stale weight from normal runner noise?
- **Options:**
  - **A.** After about five green `main` runs with the refreshed weights, set each group's budget from its measured spreads plus a noise margin. Effort: Small.
  - **B.** Set per-group budgets now from the pre-refresh runs, for example 4 minutes for Native and 3 minutes for Browser and App. Effort: Small.
  - **C.** Use a percent of the slowest shard instead of minutes. This changes the field, the parser, the tests, and the protocol doc. Effort: Small.
  - **D.** Warn only when a group passes its budget in several recent runs. The report job then reads earlier runs, and the rule that never compares runs changes. Effort: Medium.
- **Left out:** None.
- **Wider fix:** None. The values are configuration.
- **Previous examples:** None found.
- **Recommendation:** A. It sets each budget from data that the refreshed weights produce.
- **Action:** ask the user, because absolute, relative, and multi-run budgets have real trade-offs, and no value is clearly best before runs with the refreshed weights exist.
