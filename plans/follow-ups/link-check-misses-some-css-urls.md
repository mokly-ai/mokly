# Link check misses some CSS URLs

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-21, from the review checks of the branch `ci-fix/site-lighthouse-run-lighthouse-budget` (PR #431), findings 5 and 7.
- **Location:** `apps/site/scripts/links/documents.ts`, `cssReferences` and the `style` attribute branch of `htmlDocument`. `apps/site/tests/links.test.ts`.
- **Reason:** `origin/main` has the same code and tests, and the best fix makes a required check stricter, which needs the user.

- **Terms:**
  - **`site:links`:** the required check of the public site, `npm run site:links`, which resolves every internal reference of the built HTML and CSS in `apps/site/dist`.
  - **`cssReferences`:** the function of `apps/site/scripts/links/documents.ts` that lists the URLs of CSS text with the Lightning CSS dependency analysis.
- **Background:** `site:links` reads every `.css` file, every HTML `style` element, and every `style` attribute of the built site. It finds their URLs with `cssReferences`, which calls `transform({ analyzeDependencies: true })` of Lightning CSS and keeps the `url` and `import` dependencies.
- **Problem:** Probes of 2026-11-21 found three gaps:
  - Lightning CSS reports the dependencies after its minify pass. In `.e{background-image:url(six.svg);background-image:url(seven.svg)}` it dropped the overridden declaration, so `site:links` never checked `six.svg`.
  - A relative `url()` in a custom property makes the call throw `AmbiguousUrlInCustomProperty`. `site:links` then reports a parse error for that text and checks none of its files.
  - No link test fails when `htmlDocument` drops the CSS references of `style` attributes. All 24 link tests passed with that change.
- **Impact if no action:** A missing file can pass the required check when only an overridden declaration or a custom property names it, and a regression in the `style` attribute branch goes unnoticed.
- **Root question:** How does `site:links` see every URL that the built CSS can load?
- **Options:**
  - **A.** Add the missing test for `style` attributes, and accept the other two gaps with a sentence in the link-check rule of `docs/protocol/cloud/site-delivery.md`. Effort: Small.
  - **B.** Read the dependencies without the minify effect, for example from the Lightning CSS visitor API or from a tokenizer that keeps every declaration, and resolve a relative `url()` in a custom property against the sheet. Add tests for all three gaps. Effort: Medium.
  - **C.** Share one CSS reference reader between `site:links` and the home stage, which has its own tokenizer in `apps/site/scripts/stage/stylesheets.ts`, so that both see the same URLs. Effort: Medium.
- **Left out:** Rejecting custom properties with relative URLs. It rejects valid CSS.
- **Wider fix:** C. One reader then defines which text is a URL for both the stage and the check.
- **Previous examples:** None found.
- **Recommendation:** C. It closes the gaps once and stops the two readers from drifting apart.
- **Action:** ask the user, because C makes the required `site:links` check see more URLs, which is a stricter check.
