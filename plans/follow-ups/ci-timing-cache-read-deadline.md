# CI timing GitHub reads have no deadline

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from branch `calummoore/ci-speed-actions-cache-headroom-and-gi6l`, review finding 3.
- **Location:** `scripts/verification/ci-timing-jobs.mjs` (`githubJson`), `scripts/verification/ci-timing.mjs` (`readCache`), `.github/workflows/ci.yml` (the `CI timing` job, `timeout-minutes: 10`).
- **Reason:** Node's own `fetch` limits already end a full stall inside the 10-minute job limit, and the job never gates the run.

- **Terms:**
  - **CI timing:** The report-only job of `.github/workflows/ci.yml` that runs `scripts/verification/ci-timing.mjs`. It writes job durations, slow tests, and the Actions cache usage to the job summary.
  - **`githubJson`:** The helper in `scripts/verification/ci-timing-jobs.mjs` that sends one GET to the GitHub REST API with the run token.
- **Background:** The report first reads the jobs of the run, then the Actions cache list, page by page. It writes the summary only after both reads end. A cache list that cannot be read adds a note, and the rest of the report still runs, as `docs/protocol/ci-duration-budgets.md#actions-cache` says.
- **Problem:** `githubJson` passes no `signal` to `fetch`, so no read has its own deadline. A response that sends its headers and then trickles its body keeps the report waiting. A test with a body that stalled after the headers produced no summary until the response failed. Node 24 stops a request after 300 seconds without headers or 300 seconds without body data, so only a trickle or several slow pages reach the 10-minute job timeout.
- **Impact if no action:** In that rare case, the job times out, and the durations and slow tests that the report already read never reach the summary.
- **Root question:** How long may the optional cache read delay the timing report, and what does the report show when the read takes longer?
- **Options:**
  - **A.** Write the job summary for the durations and the slow tests before the cache read starts. The output survives, but the cache read can still hold the job until its timeout, and the summary order changes, so the protocol section changes too. Effort: Small.
  - **B.** Give the whole cache read one deadline, through an `AbortSignal` that `githubJson` passes to `fetch` and that also covers the `response.json()` body read. Turn an abort into the existing "could not be read" note. Make the deadline injectable, so that the test needs no real wait. Effort: Small.
  - **C.** Give `githubJson` a `signal` parameter, and let each caller pass one deadline for all its pages: the cache read as in B, and the jobs read with a clear failure message instead of a job timeout. `scripts/release/smoke_serve.mjs` already uses `AbortSignal.timeout` with `fetch`. Effort: Small.
  - **D.** Run the cache report in its own workflow step with a short step timeout. This needs a CLI option that selects the part to run, and the summary order changes. Effort: Medium.
- **Left out:** A higher workflow timeout gives a stalled read more time and fails the goal. A timer race without an abort leaves the socket open, so the step still waits.
- **Wider fix:** C. One deadline parameter on the shared helper bounds every GitHub read of the report, also reads added later.
- **Previous examples:** None found.
- **Recommendation:** C. It bounds both reads with one small change, and the jobs read has the same hang today.
- **Action:** fix after merge, apply C, because the hang is rare, Node's limits end a full stall, and the job is report-only.
