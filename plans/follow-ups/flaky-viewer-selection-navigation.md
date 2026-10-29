# Viewer selection test races a navigation

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from a local complete gate run of PR #242 at
  `f15728a5`.
- **Location:** `tests/browser/viewer.spec.ts:22`, the test "uncontrolled
  selection, slots and handle lifecycle".
- **Reason:** The test is unrelated to PR #242 and passed on the rerun.

The viewer suite test "uncontrolled selection, slots and handle lifecycle"
failed once with `Execution context was destroyed, most likely because of
a navigation.` The focused rerun and the next complete gate passed without
a change. The suspected source: the test evaluates in the page while a
navigation replaces its context.
