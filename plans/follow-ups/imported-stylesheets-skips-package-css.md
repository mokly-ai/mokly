# Test CSS reader skips package imports

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from branch `calummoore/stylesheets-listing-51ma`, check of review item 3.
- **Location:** `docs/mockups/src/_tests_/imported-stylesheets.ts:48`.
- **Reason:** No site mockup imports package CSS today, so the gap is latent and the branch that found it had used both fix rounds.
- **Category:** Test.

- **Background:** `importedStylesheets` in `docs/mockups/src/_tests_/imported-stylesheets.ts` walks a module's relative imports and returns the CSS files that Mokly bundles, in bundle order. The site mockup tests read each page's CSS through it.
- **Problem:** The walk keeps only specifiers that start with `.`. A package CSS import, such as `@mokly/ui/styles.css`, is skipped without a failure. Mokly bundles package CSS into the entry's stylesheet, so the reader would return less than the page loads.
- **Impact if no action:** If a site screen imports package CSS later, the site CSS tests miss those rules and give no sign of it.
- **Root question:** How does the test CSS reader treat a CSS import that it cannot resolve?
- **Options:**
  - **A.** Fail with a message that names the importer and the specifier when a non-relative import ends in `.css`. Effort: Small.
  - **B.** Resolve package CSS through Node's resolution and return it. Effort: Small.
- **Left out:** Change nothing, because the gap stays silent.
- **Wider fix:** A. A loud failure covers every unsupported form.
- **Previous examples:** None found.
- **Recommendation:** A. It needs no resolver and keeps the reader honest.
- **Action:** fix after merge, apply A, because the gap is latent.
