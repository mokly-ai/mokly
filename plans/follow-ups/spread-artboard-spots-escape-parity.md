# Spread artboard spots escape the parity test

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from `calummoore/non-overlapping-m1rs`: the check of review finding 4.
- **Location:** `docs/mockups/src/screens/design/site/home/spread.tsx:38`, `docs/mockups/src/screens/design/site/home/artboard.tsx`, `apps/site/src/styles/home-spread.css:111`
- **Reason:** The split predates the branch, and the fix changes artboard code that the branch does not touch.
- **Source:** Review.
- **Category:** Mockup.

- **Terms:**
  - **Spread:** the drawing of the demo app's artboards and component sets under the home heading, on the site and in its design mockup.
  - **Parity test:** `docs/mockups/src/_tests_/design-site-parity.test.ts`. It fails when a rule that the site sheets and the mockup sheets both declare has other values.
- **Background:** The site places the spread's eight artboards with class rules in `apps/site/src/styles/home-spread.css`. The mockup passes each artboard an `at` spot from a table in `spread.tsx`, and `artboard.tsx` writes it as inline `left` and `top`.
- **Problem:** The parity test compares stylesheet rules only, so no check compares the artboard spots of the two pages.
- **Impact if no action:** A spot that changes on one side passes every check, and the site and its spec drift apart.
- **Root question:** How do the spread's artboard spots stay equal on the site and in the mockup?
- **Options:**
  - **A.** Place the mockup's artboards with the site's class rules: the eight desktop spots in `docs/mockups/styles/site/home-spread.css`, the three mobile spots in `home-responsive.css`. Delete `at`, `CanvasSpot` and `spotStyle` from `artboard.tsx`. The parity test then compares the spots. Effort: Medium.
  - **B.** Keep the inline spots and add a test that compares the mockup table with the site rules. Effort: Small. A second source of the spots stays.
- **Left out:** Removing the `at` prop with no replacement, because it breaks the artboard positions.
- **Wider fix:** A, which removes the second source.
- **Previous examples:** The component sets of the same spread, which branch `calummoore/non-overlapping-m1rs` moved from inline spots to shared column rules.
- **Related:** `plans/follow-ups/home-overlap-measure-reads-paint-on-both-pages.md`.
- **Recommendation:** A. One set of rules holds the spots, and the existing parity test guards them.
- **Action:** fix after merge, apply A.
