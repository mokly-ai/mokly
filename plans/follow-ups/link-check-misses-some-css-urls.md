# Link check misses some CSS URLs

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-21, from the review checks of the branch `ci-fix/site-lighthouse-run-lighthouse-budget` (PR #431, closed without a merge), its findings 5 and 7.
- **Location:** `apps/site/scripts/links/documents.ts`, `cssReferences` and the `style` attribute branch of `htmlDocument`. `apps/site/tests/links.test.ts`.
- **Reason:** The best fix makes a required check stricter, which needs the user.

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
  - **B.** Keep Lightning CSS as the reader, but get every declaration before its minify pass, and resolve a relative `url()` in a custom property against its sheet. Add tests for all three gaps. The same probes found that `transform` drops an overridden declaration also without its `minify` option, so B may need another entry point or a second parser. Effort: Medium.
  - **C.** Replace the reader in `cssReferences` with a small CSS tokenizer. It skips comments and strings, and it reports each `url()`, each string candidate of `image-set()`, and each top-level `@import`, also in a custom property or an overridden declaration. Add tests for all three gaps. The closed PR #431 built such a tokenizer for the reader of the old home stage. Effort: Medium.
- **Left out:** Rejecting custom properties with relative URLs. It rejects valid CSS.
- **Wider fix:** C. One reader that keeps the source text sees every declaration, so an overridden declaration or a custom property cannot hide a URL.
- **Previous examples:** None found.
- **Recommendation:** C. It sees the URLs that the Lightning CSS pass drops or rejects, and the closed PR #431 showed that such a tokenizer stays small.
- **Action:** ask the user, because C makes the required `site:links` check see more URLs, which is a stricter check.
