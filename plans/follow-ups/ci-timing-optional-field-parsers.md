# Optional budget fields skip the committed-file test

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from branch `calummoore/ci-speed-shard-balance-tooling-nnht`.
- **Location:** `scripts/verification/ci-timing.mjs`, `scripts/verification/ci-timing-budgets.mjs`, `tests/verification_ci_timing.test.ts` ("the committed budget file parses").
- **Reason:** The fix changes how the report reads its optional fields, which goes beyond the branch that found it.

- **Terms:**
  - **Optional budget field:** A field of `scripts/verification/ci-budgets.json` that the report parses on its own, so that a bad value adds a note and never stops the report. `cache` and `shardGroups` are such fields.
- **Background:** `parseBudgets` passes the optional fields through unchecked. `ci-timing.mjs` parses each one in its own function. The committed-file test calls each parser by hand.
- **Problem:** A new optional field gets no committed-file check unless its author adds one. A bad committed value then only adds a note in CI.
- **Impact if no action:** A bad edit can turn off one section of the report without a failing test.
- **Root question:** How does the gate catch a committed optional field that the report cannot read?
- **Options:**
  - **A.** Keep adding one assertion for each new field. Effort: Small.
  - **B.** Keep one table of the optional field parsers in `ci-timing-budgets.mjs`. `ci-timing.mjs` reads each optional field through it, and the committed-file test loops over it. Effort: Small.
- **Left out:** A test that runs the whole report on the committed file and rejects every note is a test for the class, which needs the user's approval, and B is structural.
- **Wider fix:** B.
- **Previous examples:** `7a14afd32` added the `cache` assertion. Branch `calummoore/ci-speed-shard-balance-tooling-nnht` added the `shardGroups` assertion.
- **Recommendation:** B. A new optional field is then tested by default.
- **Action:** fix after merge, apply B, because it reshapes how the report reads its fields.
