# Shard weights predate the Browser, Viewer, and App test audits

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from branch `calummoore/test-audit-mokly-browser-and-viewer-din6`, review finding 9. The App part was added on 2026-11-26 from branch `calummoore/test-audit-app-and-cloud-rust-fl63`, review finding 10.
- **Location:** `scripts/verification/browser-shard-weights.json`, `scripts/verification/viewer-shard-weights.json`, `packages/app/src/_tests_/browser-shard-weights.json`.
- **Reason:** Another workspace owns the weight files, and a measured refresh needs green CI reports of the new test inventory.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Shard weight:** the measured cost per test that the scheduler multiplies by the number of tests that it discovers in a spec, as `docs/development/shard-weights.md` says.
- **Background:** The audit groups many tests into fewer tests, shares one read-only Serve per spec file in four specs, merges two Serve specs, removes specs, and adds Node test files.
- **Problem:** The weights still describe the old tests:
  - Grouped tests: `component_design.spec.ts` (108 width tests became 2), `design_library.spec.ts` and `design_library_mobile.spec.ts` (75 sample tests became 6 each).
  - Shared read-only Serve: `right_panel_tabs`, `serve_comparison_expiry`, `serve_comparison_renewal_panes`, and `serve_selected_comparisons`, whose weights include one Serve start per test.
  - Merged: `serve_changes_loading.spec.ts` runs the journeys of the deleted `serve_changes_preparing.spec.ts`.
  - Deleted specs with stale entries: `design_reasons.spec.ts`, `serve_changes_preparing.spec.ts`, `serve_comparison_api.spec.ts`.
  - New Viewer file without a weight: `tests/static_published_files.test.ts`.
  - App suite (`packages/app/src/_tests_/browser-shard-weights.json`, whole-file weights in seconds): the App audit creates test projects and sessions through the API instead of the onboarding and sign-up screens, which cuts setup in most specs. It merges same-setup tests into `test.step`s in many specs, for example `settings/panes.spec.ts` (15.2 s measured before, 8.0 s after), `settings/gestures.spec.ts`, `settings/drafts.spec.ts`, `viewer/overlays.spec.ts`, and `viewer/account-menu.spec.ts`. It moves `viewer/share-pages.spec.ts` into `viewer/retained.spec.ts`. Deleted specs with stale entries: `build-closed.spec.ts`, `build-refusals.spec.ts`, `identifier-fields.spec.ts`, and `viewer/share-pages.spec.ts`. The App scheduler discovers live files first, so a stale entry adds no test, but every changed file keeps its old cost.
- **Impact if no action:** The scheduler places expensive grouped tests as cheap work, so the longest Browser shard can get slower than the measured total shows.
- **Root question:** How does shard placement catch up with the audit's test costs?
- **Options:**
  - **A.** The owner workspace runs `npm run ci:refresh-shard-weights` on the first green `main` runs that contain the audits, and retunes the Browser and App shard counts from the refreshed estimates in the same change, as #562 and #578 did. Effort: Small.
  - **B.** Change the scheduler to charge at least the measured spec total when the discovered test count differs from the measured count. Effort: Medium.
- **Left out:** Hand estimates, because a measured refresh is better on every point once the runs exist.
- **Wider fix:** B removes the drift after a regrouping until the next refresh, but it does not see a cost change with the same test count.
- **Previous examples:** #574 and #576 left stale entries for the owner (`.context` reports of those branches), and #562 and #578 refreshed by hand.
- **Recommendation:** A. It is the documented refresh, and #338 retunes the shard count from the same numbers.
- **Action:** fix after merge, apply A, because the brief of the audit branch forbids edits to the weight files and the refresh needs green runs of the new inventory.
