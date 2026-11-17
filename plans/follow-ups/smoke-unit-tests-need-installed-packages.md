# Smoke unit tests need installed packages

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-02, from item 17 of the Mokly 0.18.0 upgrade on the branch `calummoore/mokly-cli-upgrade`. It is the open choice "Test isolation" of the deleted `plans/follow-ups/smoke-refusals-skip-recorded-capture.md`. The upgrade applied option A before the user answered.
- **Location:** `scripts/_tests_/publication_smoke_cli_tests.py:28-31` and `:51-53`.
- **Reason:** On 2026-11-02 the user deferred the choice, so the tests keep option A until the user confirms or changes it.
- **Category:** Test.

- **Terms:**
  - **Publication smoke:** the Python test in `scripts/` that runs the real Mokly CLI against a local API.
- **Background:** The publication smoke reads the CLI version from the installed `ts/node_modules/@mokly/mokly/package.json`, as the user decided on 2026-10-12. Two unit tests called that reader on the real checkout.
- **Problem:** Without option A, those two tests fail with `FileNotFoundError` when `ts/node_modules` is not installed.
- **Impact if no action:** None while A stays. Without A, a fresh checkout shows two tracebacks and not the one-line fix `npm --prefix ts ci`.
- **Root question:** How do the smoke unit tests run without installed packages?
- **Options:**
  - **A.** The identity test uses a fixed version, and the temporary-directory test stubs the version reader. Only test code changes. The code has this now. Effort: Small.
  - **B.** Read the version once in `smoke()`, after its dependency check, and pass it down. Two scripts change. Effort: Small.
- **Left out:** No change, because the tests keep failing. A skip, because it weakens the tests. A version from the pin in `ts/package.json`, because the user chose the installed package on 2026-10-12.
- **Wider fix:** B. The version then comes from one place in production code.
- **Previous examples:** None found.
- **Recommendation:** A. It changes only test code, and the code has it now. B protects the code best.
- **Action:** ask the user, because the deleted item left this choice to the user.
