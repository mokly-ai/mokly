# Cancelled inventory drops an earlier store fault

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from branch `calummoore/ci-speed-fix-rust-flaky-tests-3snr`, review, outside the scope.
- **Location:** `crates/mokly-compare/src/render_store_state.rs:121-124`.
- **Reason:** The code is on `main` already and the flaky-test branch only reaches it through the save path.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Render store:** the optional disk cache of rendered documents, `CachedDocuments` in `crates/mokly-compare/src/render_store.rs`. It keeps an index of the documents in its stored segments.
  - **Store fault:** a filesystem or platform error outside one entry. The store prints the directory warning once and turns off for the process, as `docs/protocol/mokly-render-store.md` says under "Faults".
- **Background:** `CachedDocuments::initialize` builds the startup index. It opens each segment and records a store fault when the access-order maintenance of a segment fails. When the maintenance of a later segment is cancelled, it returns `Err(Error::Cancelled)` at once. The caller treats the cancellation as a normal event.
- **Problem:** A store fault that an earlier segment recorded in the same pass is lost when a later segment is cancelled. The store stays on and prints no directory warning for that fault.
- **Impact if no action:** A real store fault goes unreported for that run. A later read usually finds the fault again, so the effect is small.
- **Root question:** How does a cancelled startup inventory keep a store fault that it already saw?
- **Options:**
  - **A.** Change nothing. A later read finds the fault again. Effort: Small.
  - **B.** Return the seen store fault with the cancellation, for example `Ok(Some(true))` when a fault was seen before the cancellation, and add a unit test with one failing and one cancelled segment. Effort: Small.
  - **C.** Record store faults in the shared state at once, not at the end of the pass. Effort: Medium.
- **Left out:** None.
- **Wider fix:** C. Faults that are recorded at once cannot be lost by an early return.
- **Previous examples:** None found.
- **Recommendation:** B. It is a small, local change with a direct test.
- **Action:** fix after merge, apply B, because it is outside the scope of the flaky-test branch.
