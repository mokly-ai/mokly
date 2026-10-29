# A pick promise can stay unsettled during an adapter swap

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #224, the investigation of CI run 40933916619.
- **Location:** `packages/viewer/src/viewer/picking.ts:33` and
  `packages/viewer/src/viewer/host_bridge.tsx:213`.
- **Reason:** The picker code is byte-identical on `main`, and PR #224 changed
  only the timing that exposed the problem.

A `MoklyViewer` host can call `startPick()` and then `cancelPick()` after it
renders a new `frameAdapter` and before React installs it. In 11 of 20 runs of
`tests/browser/viewer_async.spec.ts` at `0989c26d`, the `startPick()` promise
of that sequence did not settle, and Chromium collected it ("Promise was
collected"). The test now waits for the new adapter's `mount`, so it no longer
covers this order. A host that awaits such a promise waits forever. Evidence:
`.context/deployment-id-detail-ids/picker-navigation-report.txt` in the PR #224
workspace.
