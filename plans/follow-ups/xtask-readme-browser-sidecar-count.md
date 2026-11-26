# The xtask README gives the wrong sidecar count of the browser example

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix.
- **Added:** 2026-11-26, from [PR #547](https://github.com/mokly-ai/mokly/pull/547), review round 1, outside the scope.
- **Location:** `xtask/README.md:171` and `tests/browser/example_servers.ts:16`.
- **Category:** Docs or spec.

- **Background:** The browser suite serves the example catalogue with a fixed number of render sidecars.
- **Problem:** The README says that the shared browser example uses `--sidecars 1`. The test helper selects two.
- **Impact if no action:** A reader who reproduces the browser setup by hand starts a different server than the suite.
- **Options:**
  - **A.** Correct the README to the count that the helper uses. Effort: Small.
  - **B.** Replace the number in the README with a link to the helper. Effort: Small.
- **Recommendation:** A. The README states a current fact, and the fix is one line.
- **Action:** fix after merge, apply A.
