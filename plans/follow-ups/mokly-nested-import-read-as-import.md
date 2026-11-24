# Mokly may read a nested @import as an import

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Low. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-21, from the check of review finding 5 of the branch `ci-fix/site-lighthouse-run-lighthouse-budget` (PR #431, closed without a merge).
- **Location:** `crates/mokly-css/src/syntax.rs:50`, the token scanner. `crates/mokly-css/src/compiler.rs:122-135`, where the compiler resolves imports.
- **Reason:** The check found it by code reading in a Mokly crate, and nobody ran it.

- **Terms:**
  - **`@import` at-rule:** a CSS rule that loads another stylesheet. It is valid only at the top level of a stylesheet.
- **Background:** Mokly bundles each configured stylesheet and inlines its local imports before delivery. Its token scanner finds the imports and assets of a stylesheet.
- **Problem:** By code reading, the scanner treats an `@import` keyword at any block level as an import prelude. A custom property such as `.x { --caption: @import"./theme.css"; }` would then make the compiler resolve `theme.css`, and the build would fail when that file is absent. A browser reads that value as plain text. No test covers a nested `@import`, and nobody ran the case.
- **Impact if no action:** A valid stylesheet with `@import` text in a custom property can fail the Mokly build.
- **Root question:** Does Mokly treat only top-level `@import` rules as imports?
- **Options:**
  - **A.** Add a test with a nested `@import` in a custom property, and run it. When it fails, track the block depth in the scanner and accept an import prelude only at depth 0. Effort: Small.
  - **B.** Close the item when the test passes, and keep the test. Effort: Small.
- **Left out:** None. The test decides between fixing and closing.
- **Wider fix:** None. A Mokly test covers the case once it exists.
- **Previous examples:** The reader of the old home stage of the public site had the same pattern problem. The closed PR #431 replaced that pattern with a tokenizer that accepted an import only at block depth 0. #488 then removed the stage.
- **Recommendation:** A. A test shows whether the problem is real.
- **Action:** fix after merge, apply A, because the case needs a reproduction in a crate outside the scope.
