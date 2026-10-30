# Same-origin handoff test probes a missing link

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from the complete gate of the branch
  `calummoore/npm-run-dev-automation` at `f38892a7`.
- **Location:** `tests/browser/same_origin_identity.spec.ts:206`,
  `tests/browser/same_origin_identity.spec.ts:246`.
- **Reason:** The branch that found the failure does not touch the test,
  and the test passed on a rerun.

- **Terms:**
  - **Same-origin adapter:** the viewer frame adapter that mounts a
    catalogue document in an iframe on the page's own origin.
  - **Handoff:** a new mount that replaces the document in the frame.
- **Background:** The browser test "an unowned exact-resource document
  gains no navigation privilege during handoff" mounts
  `/static/mokly-generated/home/index.mobile.html` in the frame. It clicks
  `#exact-resource-link`, which loads the same document with
  `?handoff=exact`. A `page.route` handler holds the second request of that
  URL. The test then starts a replacement mount and waits for the held
  request. Next, `probeCurrentDocument` reads `frame.contentDocument`,
  finds `[data-mokly-link="action"]`, and dispatches a click on it.
- **Problem:** The test failed in remote browser shard 2 of 4 of the gate
  run `20261030T124708Z-261766` with
  `TypeError: Cannot read properties of null (reading 'dispatchEvent')`
  at `probeCurrentDocument` (line 246), called from line 206. A local rerun
  of the spec file passed both tests. The same failure text occurred once
  before, in a remote gate of the branch of the esbuild resolve fast path
  plan. That failure passed on the shard rerun and in ten local runs.
  Suspected source: async ordering. The probe reads the frame document
  while the handoff replaces it, so `querySelector` can run on a document
  that does not hold the link yet.
- **Impact if no action:** The complete gate and CI fail now and then on
  unrelated changes, and each failure costs a rerun.
- **Root question:** How does the test observe the frame document only
  when the expected document is ready?
- **Options:**
  - **A.** In this test, wait until the current frame document holds the
    action link before the probe runs. Keep every assertion. Effort: Small.
  - **B.** Make `probeCurrentDocument` wait for its selector in the current
    frame document before it dispatches the click, so that every caller
    probes a ready document. Effort: Small.
  - **C.** First check whether the same-origin adapter shows an empty
    document during a handoff. When it does, add a failing test and fix
    the adapter. Effort: Medium (estimate).
- **Left out:** A retry, a sleep, or a longer time limit, because the
  flaky-test rule forbids them.
- **Wider fix:** B. The shared probe helper gets the readiness check.
- **Previous examples:** The esbuild resolve fast path plan recorded the
  same failure text once, as a problem outside its scope.
- **Recommendation:** B. Every caller of the probe then waits for a ready
  document. Reproduce the flake first and name its source. When it does
  not reproduce, ask the user.
- **Action:** fix after merge, apply B, because the test is outside the
  diff of the branch that found the failure.
