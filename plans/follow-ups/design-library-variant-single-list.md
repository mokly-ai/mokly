# Keep one list of design library variants

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-17, from branch `calummoore/preview-cannot-be-loaded-fov6`, the wider fix of review finding 1.
- **Location:** `tests/fixtures/design/expectations.json`, `tests/browser/design_library_inventory.ts`, `tests/fixtures/design-library/browser-inventory.json`, `tests/helpers/design_catalogue_checks.ts` (the saved-variant count in `scopeViolations`), and `crates/mokly-cli/tests/design_support/scopes.rs:34` (the saved-variant count in `check`).
- **Reason:** The direct fix, four edited lists, unblocked the branch, and this change touches shared test helpers that every later library change uses.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Library variant:** a saved sample of a shared design component, such as `design/library/preview/device-frame/phone`, defined in `examples/basic/specs/design/library`.
  - **Design catalogue checks:** the Node and browser tests that compare the served design catalogue with fixed inventories, in `tests/design_catalogue.test.ts` and `tests/browser/design_catalogue.ts`.
- **Background:**
  - Five places list the library variants: the `sharedComponents` map in `tests/fixtures/design/expectations.json`, the browser list in `tests/browser/design_library_inventory.ts`, the library entries of `tests/fixtures/design-library/browser-inventory.json` with their `colorSchemes`, and a fixed count in `scopeViolations` of `tests/helpers/design_catalogue_checks.ts`, which was 69 and is now 70. The fifth is a fixed count in `check` of `crates/mokly-cli/tests/design_support/scopes.rs`, which is still 69.
  - The fixed inventory itself is intended. `tests/browser/design_catalogue.ts` says that runtime validation prevents an untested new design.
- **Problem:** Each new library variant needs the same edit in five places. A missed place in the design catalogue checks fails the gate. When the browser inventory misses a variant, the shared `beforeAll` of the design specs fails, and more than 500 browser specs fail with it.
  - The fifth place is `crates/mokly-cli/tests/design_support/scopes.rs:34`.
    `cargo test --locked -p mokly-cli --features design-matrix --test design_attribution_tests` ran at base `cc0750d36ff1cabf1bf03a3cbfde63bf71b2a48b`.
    The original launcher and the `Cache` launcher in `crates/mokly-cli/tests/design_attribution_tests.rs` both exited 101.
    Each run reported 21 passed, 1 failed, and 0 ignored.
    Each run failed at `scopes.rs:34` with `left: 70` and `right: 69`.
    Each child selected its owned cache before this check.
- **Impact if no action:** Each library change costs five edits and risks a gate failure that hides its cause behind hundreds of failed specs.
- **Root question:** How do the catalogue checks learn about a library variant from one fixed list?
- **Options:**
  - **A.** Derive only the count in `scopeViolations` from the `sharedComponents` map. Effort: Small.
  - **B.** Keep one list in `expectations.json`. Derive the browser list, the library entries of the browser inventory, and the count from it. Effort: Medium.
- **Left out:** Read the inventory from the served catalogue. It removes the check that a new design gets a test. Fewer than three approaches exist, because the choice is how many of the five places derive from the one list.
- **Wider fix:** B.
- **Previous examples:** Commits `9f68de169` and `8c2bbff2c` edited the same duplicate lists.
- **Recommendation:** B. One list removes every duplicate edit.
- **Action:** fix after merge, apply B, because it changes shared test helpers outside the change that found it.
