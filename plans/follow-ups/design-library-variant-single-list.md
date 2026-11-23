# Keep one list of design library variants

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-17, from branch `calummoore/preview-cannot-be-loaded-fov6`, the wider fix of review finding 1.
- **Location:** `tests/fixtures/design/expectations.json`, `tests/fixtures/design-library/browser-inventory.json`, `tests/helpers/design_catalogue_checks.ts` (the saved-variant count in `scopeViolations`), and `crates/mokly-cli/tests/design_support/scopes.rs:48-54` (the saved-variant count in `check`).
- **Reason:** The direct fix, four edited lists, unblocked the branch, and this change touches shared test helpers that every later library change uses.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Library variant:** a saved sample of a shared design component, such as `design/library/canvas/canvas-frame/mobile-dark`, defined in `examples/basic/specs/design/library`.
  - **Design catalogue checks:** the Node and browser tests that compare the served design catalogue with fixed inventories, in `tests/design_catalogue.test.ts` and `tests/browser/design_catalogue.ts`.
- **Background:**
  - Four places list the library variants: the `sharedComponents` map in `tests/fixtures/design/expectations.json`, the library entries of `tests/fixtures/design-library/browser-inventory.json` with their `colorSchemes`, a fixed count in `scopeViolations` of `tests/helpers/design_catalogue_checks.ts`, and a fixed count in `check` of `crates/mokly-cli/tests/design_support/scopes.rs`. Both counts are 75.
  - The fixed inventory itself is intended. `tests/browser/design_catalogue.ts` says that runtime validation prevents an untested new design.
- **Problem:** Each new library variant needs the same edit in four places. A missed place fails the gate. When the browser inventory misses a variant, the shared `beforeAll` of the design specs fails, and more than 500 browser specs fail with it.
- **Impact if no action:** Each library change costs four edits and risks a gate failure that hides its cause behind hundreds of failed specs.
- **Root question:** How do the catalogue checks learn about a library variant from one fixed list?
- **Options:**
  - **A.** Derive only the count in `scopeViolations` from the `sharedComponents` map. Effort: Small.
  - **B.** Keep one list in `expectations.json`. Derive the library entries of the browser inventory and both counts from it. Effort: Medium.
- **Left out:** Read the inventory from the served catalogue. It removes the check that a new design gets a test. Fewer than three approaches exist, because the choice is how many of the four places derive from the one list.
- **Wider fix:** B.
- **Previous examples:** Commits `9f68de169` and `8c2bbff2c` edited the same duplicate lists.
- **Recommendation:** B. One list removes every duplicate edit.
- **Action:** fix after merge, apply B, because it changes shared test helpers outside the change that found it.
