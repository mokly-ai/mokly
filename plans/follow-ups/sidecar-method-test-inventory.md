# Sidecar method round trip misses methods

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, round 1 of its
  implementation review. The branch added the `prepareContext` sidecar method
  and gave it a row in this test.
- **Location:** `crates/mokly-sidecar/src/_tests_/wire_tests.rs:11`
  (`every_method_and_result_round_trips`).
- **Reason:** On 2026-11-22 the performance orchestrator, under the delegation
  of the user, chose option B for a later branch after the branch that found
  this item merges, with the `restoreGeneration` row in that later branch too.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Sidecar method:** one variant of the `Call` enum in
    `crates/mokly-sidecar/src/methods.rs`. Each is one request that the Rust
    core sends to a Node sidecar, such as `bundle`, `restoreGeneration`, or
    `prepareContext`.
  - **Method inventory test:** `every_method_and_result_round_trips` in
    `crates/mokly-sidecar/src/_tests_/wire_tests.rs`. Its module comment says
    "Typed round trips for the complete method inventory". It encodes a
    sample request of each method and decodes a sample result.
- **Background:**
  - Each sidecar method needs a wire shape that the Node sidecar reads, a
    result decode arm in `Response::decode_result`
    (`crates/mokly-sidecar/src/wire.rs`), a display arm in
    `crates/mokly-sidecar/src/request_display.rs`, and a failure kind in
    `FailureKind::for_call` (`crates/mokly-sidecar/src/error.rs`).
  - The decode arm, the display arm, and the failure kind are exhaustive
    matches, so the compiler asks for them when a method is added.
  - Nothing asks for a row in the method inventory test. A reviewer must
    notice a missing row.
  - `restoreGeneration` has no row in that test since #199 (commit
    `d935e6a66`). The `prepareContext` method got its row only because a
    review asked for it.
  - Slower checks still catch a changed wire shape: the generated TypeScript
    type check, `cargo xtask check-generated-types`, and process tests.
- **Problem:** The method inventory test claims to cover every method, but a
  new method can miss it, and `restoreGeneration` misses it today.
- **Impact if no action:** The module comment stays false. A wire change of a
  method without a row is caught only by slower checks, or not at all for a
  field that no process test reads.
- **Root question:** How does every sidecar method, also a later one, get a
  checked wire shape without a reviewer and without a false claim of
  completeness?
- **Options:**
  - **A.** Add a `restoreGeneration` row to the test, and keep rows by review.
    It fixes today's gap only. Effort: Small.
  - **B.** Do A, and build the test from one test macro that declares each
    method with its sample request and its sample result, and generates an
    exhaustive `match` over `Call` from that list. A match next to a separate
    sample list would force an arm but not a sample. The test then does not
    compile until a new method has a sample. It adds a test for a class of
    defects. Effort: Medium.
  - **C.** Change the module comment so that it claims no complete inventory.
    It gives up the coverage that the comment promises. Effort: Small.
- **Left out:** A structural fix that removes the case: none exists, because
  the presence of a test row is not a type in product code.
- **Wider fix:** B. It is a detection fix, and no structural fix exists.
- **Previous examples:** `restoreGeneration` since #199. The `prepareContext`
  row, added on 2026-11-22 after a review finding.
- **Recommendation:** B. It keeps a fast check of the encode and the decode of
  each later method. The generated TypeScript types do not replace it: a field
  that the encode skips without a default is optional in TypeScript only when it
  has both serde attributes, and the result half of the seven methods with an
  empty result accepts any success payload in `decode_result`.
- **Decision:** B, chosen on 2026-11-22 by the performance orchestrator under
  the delegation of the user, for a later branch.
- **Action:** fix after merge, apply B, because the user chose it for a later
  branch.
