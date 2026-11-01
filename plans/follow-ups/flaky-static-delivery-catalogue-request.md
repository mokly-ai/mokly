# Stabilize the catalogue request of static delivery

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the 4-vCPU scratch CI run of the Linux CI
  runner size change, run 41327148872 attempt 1 on
  `calummoore/runner-size-measure-4vcpu`.
- **Location:** `tests/browser/design_catalogue.ts:24`, reached from
  `tests/browser/component_inspector_cases.ts:29`, and the static host that
  `tests/browser/setup.ts:77` starts for the delivery check.
- **Reason:** The failure lay outside the runner change, which changed only
  runner labels, and the job passed on a rerun.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Static delivery:** the CI job and remote gate command that builds the
    example catalogue and checks it through static HTTP and `file://` URLs,
    with `scripts/verification/static-delivery.mjs`.
  - **Catalogue request:** the `beforeAll` hook of `designCatalogue` in
    `tests/browser/design_catalogue.ts`. It reads
    `/mokly-viewer/index.json` with Playwright's request context.
- **Background:**
  - Static delivery requires every assigned test to pass once in both
    modes. One failed test fails the job, and `Required CI` then fails.
  - On 2026-11-01 the Static delivery job failed once in its second mode.
    650 tests passed, one failed, and two did not run.
  - The failed test was "portable inspector › desktop: inspector icons
    open, switch, and close without scripts". Its catalogue request failed
    with "Error: apiRequestContext.get: socket hang up" for
    `GET http://127.0.0.1:45469/mokly-viewer/index.json`.
  - A rerun of the failed jobs, attempt 2 of the same run, passed.
  - The run used `blacksmith-4vcpu-ubuntu-2404`. The VM had 15.4 GiB and a
    median CPU use of 41 percent, so CPU load is an unlikely cause.
  - The failure text did not occur in the nine failed `main` runs from
    2026-10-29 to 2026-11-01.
  - Suspected source: a keep-alive race. The request context can reuse an
    idle connection at the moment that the static host closes it. Node's
    HTTP server closes idle connections after five seconds by default.
    Nobody reproduced the failure.
- **Problem:** The catalogue request can fail before its test starts, so a
  healthy delivery run can fail.
- **Impact if no action:** A healthy CI run or remote gate can fail, and
  the developer must rerun it.
- **Root question:** How does the delivery check read the catalogue index
  without a failure that comes from connection reuse?
- **Options:**
  - **A.** Change nothing, and rerun a failed job. Effort: Small.
  - **B.** Reproduce the failure by repeating the delivery run. Name the
    source. Then make the request deterministic, and add no retry. One way
    is a new connection for the catalogue request. Another way is a static
    host that keeps idle connections open longer than the request context
    does. Effort: Medium.
- **Left out:** A retry of the request. The flaky-test rule of the
  `testing` skill forbids a retry.
- **Wider fix:** B, when the fix lives in the static host, because every
  request of the delivery check then avoids the race.
- **Previous examples:** None found.
- **Recommendation:** B, because one fix removes the failure for every
  delivery run and keeps every assertion.
- **Action:** fix after merge, apply B, because the flake lies outside the
  runner change and needs its own reproduction.
