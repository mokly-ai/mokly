# StrictMode runs a host detail source twice

- **Severity:** Low (estimate). **Likelihood:** Common (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #224, implementation review 2.
- **Location:** `packages/viewer/src/shell/data_store.ts:92` to line 96.
- **Reason:** The problem is older than PR #224 and lies outside its diff.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **`detail` source:** the host callback of the embedded `@mokly/viewer`,
    `(entryPath, snapshotId?)`. The viewer calls it for each entry detail
    that it does not hold.
  - **StrictMode:** the React development mode that mounts each component,
    unmounts it, and mounts it again, to find unsafe effects.
- **Background:**
  - `packages/viewer/docs/concepts/README.md:16` says that the viewer calls
    the `detail` source once for each entry that it does not hold.
  - In `packages/viewer/src/shell/data_store.ts:92` to line 96, one effect
    requests the first-load details, and another effect aborts the loads
    when the component unmounts.
- **Problem:** Under StrictMode, the mount replay aborts the first-load
  details and then requests them again. So a host's `detail` callback runs
  twice for the same entry, unlike the concepts README.
- **Impact if no action:** A host in development sees each detail request
  twice. A host that counts, logs, or bills these calls gets wrong numbers.
- **Root question:** How does the viewer call the host's `detail` source
  once for each entry, also under StrictMode?
- **Options:**
  - **A.** Change nothing, and state in the concepts README that StrictMode
    can call the source twice. Effort: Small.
  - **B.** Keep a pending request across the StrictMode replay. Abort it only
    when the store really unmounts or the request changes, so that the
    replay reuses it. Effort: Small (estimate).
  - **C.** Move the first-load requests out of the effect into the data
    controller, which starts each request once and shares its result.
    Effort: Medium (estimate).
- **Left out:** Turning off StrictMode checks for the viewer. Hosts own their
  React tree, so the viewer cannot choose that.
- **Wider fix:** C (estimate). One owner of each request removes repeats from
  every mount order.
- **Previous examples:** None found.
- **Recommendation:** B (estimate). It keeps the documented single call with
  a small change in the store.
- **Action:** fix after merge, apply B (estimate), because the repeated call
  contradicts the concepts README, and B is Small.
