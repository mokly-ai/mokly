# A public `restoreGeneration` request has no root test

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, round 2 of its
  implementation review, as the test part of a finding about eager sidecar
  claims. Round 5 of the same branch made the eager claim read the context of
  every call through `Call::postcss_context`, so this item keeps only the
  test part.
- **Location:** `crates/mokly-sidecar/src/pool_sources.rs:17`, the
  `restoreGeneration` arm of `Pool::source_root`.
- **Reason:** The arm is outside the diffs that found the gap, and no product
  code sends a public `restoreGeneration` request: only the pool sends it,
  as a prerequisite inside a request.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Public path:** `SidecarPool::request`, which chooses the slot of a call
    by its source root and by its PostCSS context affinity.
  - **Source root:** the catalogue directory or the extracted comparison base
    that one sidecar process serves.
- **Background:**
  - The protocol requires that a process serves one source root
    (`docs/protocol/mokly-sidecar-modules.md`, "Source Root Workers").
  - `Pool::source_root` in `crates/mokly-sidecar/src/pool_sources.rs` gives
    the source root of each call. It lists every method with no wildcard arm.
    The `bundle`, `processCss`, and `prepareContext` arms have public-path
    tests. For example, a test in
    `crates/mokly-sidecar/src/_tests_/pool_sources_tests.rs` sends a public
    `prepareContext` to a base root and checks the process launch root.
  - No test sends a public `restoreGeneration` request, so its arm, which
    reads `params.params.source_root`, has had no test since #199 (commit
    `d935e6a66`).
  - Inside the pool, `restoreGeneration` goes to the worker of the slot that
    the outer request already chose, so that send does not reach this arm.
- **Problem:** One arm of the source root selection has no test.
- **Impact if no action:** A refactor of that arm, for example one that reads
  the root of the wrong field, can start a process in the wrong source root
  for a public `restoreGeneration` request, and no test fails.
- **Root question:** How does a test show that a public `restoreGeneration`
  request runs in a process of its own source root?
- **Options:**
  - **A.** Add a case to the public-path test of `pool_sources_tests.rs`: send
    a public `restoreGeneration` request for a base root, and check the launch
    root of its process. Effort: Small.
- **Left out:** A test for each method of the pool by a table: the open item
  `plans/follow-ups/sidecar-method-test-inventory.md` already holds the method
  inventory of the wire tests, and one case shows the behaviour here.
  Changing nothing fails the goal. Only one approach is real, because the
  behaviour is a single arm.
- **Wider fix:** None here. `plans/follow-ups/sidecar-method-test-inventory.md`
  holds the inventory question for the wire tests.
- **Previous examples:** The `prepareContext` public-path case in
  `crates/mokly-sidecar/src/_tests_/pool_sources_tests.rs`, added on
  2026-11-22.
- **Related:** `plans/follow-ups/sidecar-method-test-inventory.md`: a later
  branch can add the `restoreGeneration` row there and this case together.
- **Recommendation:** A. One case covers the arm at the level that real
  callers use.
- **Action:** fix after merge, apply A, because the arm is outside the diffs
  that found the gap and no product code reaches it.
