# StrictMode runs a host detail source twice

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #224, implementation review 2.
- **Location:** `packages/viewer/src/shell/data_store.ts:92-96`.
- **Reason:** The problem is older than PR #224 and lies outside its diff.

`packages/viewer/src/shell/data_store.ts:92-96`: under StrictMode, the mount
replay restarts the first-load details, so a host's `detail` callback runs
twice, unlike `packages/viewer/docs/concepts/README.md:16`.
