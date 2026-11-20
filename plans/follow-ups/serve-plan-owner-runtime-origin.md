# Serve builders use extraction state

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from `calummoore/mokly-first-changes-3-shared-base-pp6b`, the cache-origin options check and final documentation reconciliation.
- **Location:** `crates/mokly-render/src/runtime.rs`, `Runtime::with_serve_edit_plans` and `Runtime::with_stylesheet_watching`.
- **Reason:** The cache-origin change does not change these builders, and no product caller applies them to a base.

- **Terms:**
  - **Runtime:** The render service factory that owns the preparation stores.
  - **BaseSide:** The optional extracted source and dependency leases of a historical side.
  - **Plan owner:** The bounded store of captured head preparation plans in `src/edit_plans.rs`.
- **Source:** Review.
- **Category:** Code structure.
- **Background:** `Runtime::with_serve_edit_plans` enables captured plans for the head of one Serve command. The render README says a base never gets this owner. `Runtime::with_stylesheet_watching` enables physical watch mapping for the working side of Serve. A base preparation maps no watch paths. `Runtime::for_base` can create a base without `BaseSide` when no extraction is needed.
- **Problem:** Both builders test `self.base.is_none()` to identify a head. A base without extraction also satisfies that test. Calling either builder on that base creates a plan owner or enables watch mapping. No current product caller makes either call.
- **Impact if no action:** Current product calls keep working. The public builders do not enforce their stated head-only boundaries for every valid runtime origin.
- **Root question:** How should the Serve builders distinguish original heads from bases without extraction?
- **Options:**
  - **A.** Use the explicit runtime origin that stylesheet borrowing keeps in both builders. Add regressions through the constructors and each builder. This preserves the public API. Effort: Small.
  - **B.** Introduce a head-only runtime type that exposes the Serve builders. Move all callers and document the public API change. This prevents misuse through the type but changes more code. Effort: Medium.
- **Left out:** No change leaves the guard incomplete. An extraction test cannot distinguish these states. A test without a corrected guard only detects the issue. A and B are the two distinct supported places to enforce the boundary.
- **Wider fix:** A. The existing origin value already distinguishes original heads from every base, without a second flag.
- **Previous examples:** Stylesheet borrowing formerly used the watch flag as an origin test. The 2026-11-20 cache-origin decision separates origin from watching and extraction.
- **Recommendation:** A. It preserves the API and uses the existing source of origin truth.
- **Action:** Fix after merge, apply A. The current cache change does not change these builders or their callers.
