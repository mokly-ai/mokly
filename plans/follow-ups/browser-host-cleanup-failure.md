# Browser host cleanup failed after all cases passed

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the first complete gate of
  `calummoore/mokly-comparison-reuse-1see` with the kept base of `main`
  merged, at `f6eb7e0f8`.
- **Location:** `tests/browser/setup.ts:39-55`,
  `tests/browser/example_setup.ts:28-32`, `tests/browser/hosts.ts:39-45`,
  `tests/browser/copied_host.ts:25-29`, `tests/helpers/example_base.ts:5-8`,
  `tests/helpers/static_server.ts:90-93`,
  `scripts/verification/playwright-reporter.mjs:34-38`, and
  `scripts/verification/run-browser.mjs:66-72`.
- **Reason:** The failure happened once, outside the diff of the branch that
  saw it, and no kept error names its cause, so a later branch investigates
  it.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Browser hosts:** the servers that the browser suite's global setup
    starts: a Serve host for each worker, a copied static catalogue, and a
    comparison host.
  - **Global cleanup:** the `close` function that `tests/browser/setup.ts`
    returns, which Playwright runs as the global teardown after the last
    case.
- **Background:**
  - The global cleanup closes every browser host in reverse order with
    `Promise.allSettled`. It restores the environment variables of the
    setup. When one or more closes reject, it throws
    `AggregateError(errors, "Browser host cleanup failed")` at line 54.
  - From the code, these close paths can reject. No kept evidence shows
    which one failed:
    - A Serve host whose `server.stop()` ends with a nonzero exit code. The
      error is "Example Serve did not stop cleanly:" with the host
      diagnostics, in `hosts.ts:39-45`.
    - A Serve host whose output, after the stop, does not hold exactly one
      `[mokly/git-failed]` line. `validateExampleDiagnostics` in
      `example_base.ts:5-8` throws "Expected one shared example Git
      diagnostic:" with the output. `example_setup.ts:28-32` runs it.
    - A static host whose server close fails, in `static_server.ts:90-93`,
      or whose copied workspace removal fails, in `copied_host.ts:25-29`.
  - The verification reporter keeps only `error.stack ?? error.message` in
    `onError`, at `playwright-reporter.mjs:34-38`. That text holds the outer
    message and its stack, not the inner errors of an `AggregateError`.
  - `run-browser.mjs` fails the suite when the reporter kept any error, at
    lines 69-72. So a cleanup error fails the suite after passing cases.
  - The failure, from the complete gate at `f6eb7e0f8`:
    - The gate ran for 3,487.956 s.
    - The repository suite and Clippy passed.
    - 2,517 Rust tests and 3,021 Node and viewer tests passed.
    - All 2,287 browser cases passed, with no skip and no cancellation.
    - Then the global teardown threw
      `AggregateError: Browser host cleanup failed` at
      `tests/browser/setup.ts:54`.
    - The reporter kept no nested error, so the exact cleanup cause is
      unknown.
    - The static delivery suite did not run.
    - The kernel log showed no out-of-memory event for the run.
  - A direct probe, on one run, called the production global setup and
    then its cleanup, with no browser case between them. The setup became
    ready, and the cleanup passed. The probe did not repeat the load of the
    gate, which ran 2,287 cases first. The probe was this script:

    ```js
    import setup from "../../tests/browser/setup.ts";
    import { inspect } from "node:util";
    const describe = (error) => {
      console.error(inspect(error, { depth: 10, colors: false }));
      if (error?.errors) for (const nested of error.errors) describe(nested);
    };
    try {
      const close = await setup({ workers: 1 });
      console.log("production global setup ready");
      await close();
      console.log("production global cleanup passed");
    } catch (error) {
      describe(error);
      process.exitCode = 1;
    }
    ```

  - After that gate, the branch merged `main` at `e8c964cb1` (#309) as
    `effc33400`. That merge changes six fixture paths to match `main`, with
    no runtime change.
  - On 2026-11-18, the user replaced a third uninterrupted gate with
    evidence for each suite, a static delivery run, and then a complete
    final CI run. A SIGINT stopped the early third gate on the clean
    `effc33400` tree with exit 130, during its repository checks. So no
    browser cleanup ran again.
  - The evidence of this item is therefore two facts: the cleanup failure of
    the first gate, and the direct probe whose setup and cleanup passed with
    no case between them.
  - On 2026-11-18, the static delivery suite ran alone on the clean tree at
    `effc33400c716c131825072ec5584bd2264a6874`. The failed first gate did not
    reach this suite.
    - `npm run test:delivery:prepared` exited 0 after 683.934 s.
    - The HTTP mode passed 653 of 653 cases, and the file mode passed 653 of 653. Both modes had no failure, no skip, and no reporter error, and
      their cleanup passed.
    - These modes do not run the global cleanup of the full browser suite
      again, and they do not identify the cause of its failure.
- **Problem:** The browser suite failed in its global cleanup after every
  case passed. The cleanup error kept no inner error, so nobody can tell
  which host failed or why.
- **Impact if no action:** A complete gate can fail after all browser cases
  pass, and the static delivery suite then does not run. The next failure
  again shows no cause.
- **Root question:** How can a failure of the browser host cleanup name its
  cause, so that a later branch can fix it?
- **Options:**
  - **A.** Change nothing, and wait for the next failure. Effort: Small.
  - **B.** Keep the inner errors. Write each nested error of an
    `AggregateError`, with the host that it belongs to, before the global
    cleanup throws or in the reporter. The next failure then names its host
    and its error. Effort: Small.
  - **C.** B, then repeat the complete browser suite, or a long host session
    with the same load, until the cleanup fails again. Fix the cause that
    the kept error names, under the deterministic-test rules. Effort:
    Medium.
- **Left out:**
  - A retry of the cleanup or of the suite. The `testing` skill rules out
    retries that hide a cause.
  - A cleanup failure that only warns. It weakens a gate check, and only
    the user can approve that.
  - A fix for a guessed cause. No kept error names the cause.
- **Wider fix:** B, in the reporter. Then every `AggregateError` of the
  global setup and the global cleanup keeps its inner errors.
- **Previous examples:**
  - `plans/follow-ups/flaky-browser-host-setup.md`: on 2026-10-30, the
    global setup threw "Browser host setup failed", and the log kept no
    inner error.
  - `plans/follow-ups/verification-registry-cleanup-flake.md`: a one-time
    failure during process cleanup. No inner error shows that it shares this
    cause.
- **Related:** `plans/follow-ups/flaky-browser-host-setup.md` holds the same
  missing inner errors for the setup. The wider fix in the reporter covers
  both items.
- **Recommendation:** B. The next failure then names its host and its error,
  and no cause can be found without that.
- **Action:** fix after merge, apply B, because the failure is outside the
  reuse diff, and a later branch must keep the inner errors before it can
  find the cause.
