# Call variants variants in browser test names

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of the W2 viewer review.
- **Location:** `tests/browser/react_comparison_evidence.spec.ts:70`,
  `tests/browser/comparison_outside_evidence.spec.ts:104`,
  `tests/browser/comparison_stylesheet_details.spec.ts:194`, and
  `tests/browser/viewer_details.spec.ts:76`.
- **Reason:** A viewer review found the old term in test files that its
  change did not touch, so a separate branch renames them.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Variant:** a saved props set of a screen or component, under
    `docs/protocol/mokly-variants.md`. The product calls it a variant.
- **Background:** The browser tests and the product name variants as follows.
  - The browser specs under `tests/browser` describe product behaviour in
    their test titles.
  - The product names a saved props set a variant. An earlier product name for
    it was "saved view".
  - Three comments also use the old term, at
    `tests/browser/comparison_outside_evidence.spec.ts:6` and
    `tests/browser/details_implementation.spec.ts:2` and `:71`.
  - `tests/browser/comparison_page_evidence.spec.ts:132` asserts that the
    product shows no "saved view" text. That assertion must stay.
- **Problem:** The record counted about eight test titles that still call a
  variant a "saved view". On `main`, four test titles use it, at the four
  paths of the Location line.
- **Impact if no action:** A reader of a failing test meets a term that the
  product and the docs no longer use.
- **Root question:** How should the browser tests name a variant?
- **Options:**
  - **A.** Rename the four titles and three comments to use "variant", and
    keep the negative assertion. Effort: Small.
  - **B.** Apply A, and add a check that rejects "saved view" in test
    titles. This adds a check. Effort: Medium.
- **Left out:** Changing the product term to match the tests reverses the
  product's naming.
- **Wider fix:** B. A check catches the old term in later titles, but it is
  a detection fix for wording only.
- **Previous examples:** None found.
- **Recommendation:** A. The rename is enough, and B adds a check
  for a rare wording slip.
- **Action:** fix after merge, apply A, because the rename preserves every
  assertion and corrects test wording outside the reviewed change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6731).
