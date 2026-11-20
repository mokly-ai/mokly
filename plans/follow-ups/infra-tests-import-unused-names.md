# Two infra tests import unused names

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from the review of the closed [PR #72](https://github.com/mokly-ai/mokly-cloud/pull/72), outside its scope.
- **Location:** `infra/tests/test_catalogue_capture.py:4` and `infra/tests/test_runtime_settings.py:3`.
- **Reason:** The imports are already on `main` and outside the branch that found them, so a separate branch removes them.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. Both modules still import a name that they never read. No Python lint exists, so no check fails on it.
- **Category:** Dead code.

- **Terms:**
  - **Ruff:** A Python linter whose rule F401 reports an import that the module never reads.
- **Background:** `test_catalogue_capture.py` imports `json` at line 4. The module names `json` only inside the string `"review.json"`. `test_runtime_settings.py` imports `Path` from `pathlib` at line 3 and never reads it. No `noqa` marker or comment keeps either import. The repository runs no Python lint.
- **Problem:** Two imports are dead code.
- **Impact if no action:** Readers see dependencies that the tests do not have. The class repeats: the closed PR #72 split one test module and left six unused imports, which its own review then removed.
- **Root question:** How do the Python tests and scripts stay free of unused imports?
- **Options:**
  - **A.** Delete the two imports. Effort: Small.
  - **B.** Add a lint that rejects unused Python imports in `scripts/` and `infra/`. `plans/follow-ups/python-code-has-no-unused-import-lint.md` compares the tools for it. It adds a lint. Effort: Medium.
- **Left out:** Keep the imports with a `noqa` marker. Neither import has a reason to stay.
- **Wider fix:** B, a detection fix, because no structural fix exists for unused imports. It is blocked, because it adds a lint. `plans/follow-ups/python-code-has-no-unused-import-lint.md` holds that choice.
- **Previous examples:** The six unused imports in `scripts/cloud/_tests_/publication_smoke_cli_tests.py` and `publication_smoke_fixture_tests.py` on the closed branch of PR #72. With these two, the class has three cases.
- **Related:** `plans/follow-ups/python-code-has-no-unused-import-lint.md`, a shared class. It holds the choice of the lint and its tool.
- **Recommendation:** A. It removes the dead code now. B best protects the codebase.
- **Action:** fix after merge, apply A, because the imports are dead code outside the branch that found them.
