# Actions cache budget only warns

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from branch `calummoore/ci-speed-actions-cache-headroom-and-gi6l`.
- **Location:** `scripts/verification/ci-timing-cache.mjs`, `scripts/verification/ci-budgets.json` (the `cache` field), `docs/protocol/ci-duration-budgets.md#actions-cache`.
- **Reason:** A failing check is a new gate, and the always-on rules reserve that choice for the user.

- **Terms:**
  - **CI timing:** The report-only job of `.github/workflows/ci.yml`. It writes job durations, slow tests, and the Actions cache usage to the job summary. `Required CI` does not need it, so it never gates a merge.
  - **Cache budget:** The `cache.gigabytes` value in `scripts/verification/ci-budgets.json`, 8.5 GB. GitHub's limit for the Actions cache of the repository is 10 GB.
- **Background:** The report warns when the cache total passes the cache budget, and when an entry comes from a ref other than `main`. These warnings never fail the step, also when `mode` is `fail`. The `mode` field turns only the duration budgets into a failing check, and it is `warn`.
- **Problem:** A cache total above the budget shows only as a warning annotation and a line in the job summary. A warning can stay unnoticed for many runs.
- **Impact if no action:** The cache can grow back toward the 10 GB limit while only warnings show, and evictions then make jobs build cold again.
- **Root question:** How visible must a cache total above its budget be?
- **Options:**
  - **A.** Keep the cache warnings warning-only. Effort: Small.
  - **B.** Let the existing `mode: fail` also fail the step for a cache total above the budget. The check still stays outside `Required CI`, so it blocks nothing until the branch rule requires it. Effort: Small.
  - **C.** Add a separate `cache.mode` field, so that the cache budget can fail while the duration budgets only warn. Effort: Small.
- **Left out:** Adding the check to `Required CI` blocks every pull request for a cache state that a pull request cannot change, because only `main` saves.
- **Wider fix:** None. The report already shows the total on every run.
- **Previous examples:** The duration budgets started in `warn` mode with the same rule, in `docs/protocol/ci-duration-budgets.md#warnings-and-the-failing-mode`.
- **Recommendation:** A. A pull request cannot change the cache of `main`, so a failing check would fail runs that did nothing wrong.
- **Action:** ask the user, because B and C add a failing check, and the task asked that making the cache check fail be the user's decision.
