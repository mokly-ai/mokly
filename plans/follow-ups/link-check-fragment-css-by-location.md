# Link check judges CSS fragments by location

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-20, from the review of the branch `ci-fix/site-lighthouse-run-lighthouse-budget` (PR #431, closed without a merge), the wider fix of its finding 2 and two problems that its check found.
- **Location:** `apps/site/scripts/links/check.ts:96-102`, which drops the fragment-only references of a `.css` file. `apps/site/scripts/links/documents.ts:49-61`, `htmlDocument`, which keeps them for `style` attributes and `style` elements. `apps/site/astro.config.mjs:42`, `build.inlineStylesheets: "auto"`. `docs/protocol/cloud/site-delivery.md:157-158`, the link-check rule under "Checks".
- **Reason:** The best fix changes the verdict of a required check, so the user must choose it.

- **Terms:**
  - **`site:links`:** the required check of the public site, `npm run site:links`, which resolves every internal reference of the built HTML and CSS in `apps/site/dist`.
  - **Fragment-only CSS reference:** a CSS URL that holds only a fragment, such as `filter: url(#glow)`. It names an element of the document that uses the rule.
- **Background:** `site:links` reads each built HTML, SVG, and CSS file. For a `.css` file it drops every fragment-only reference, because one stylesheet serves many documents. For an HTML `style` element or a `style` attribute it keeps them, and it fails when the document has no element with that id. Astro inlines each site stylesheet under 4 kB into a `style` element, because `build.inlineStylesheets` is `auto`.
- **Problem:** The verdict on one CSS rule depends on where the build puts its sheet.
  - A fragment-only reference in a sheet that Astro inlines gets the anchor check. The same reference in a larger sheet does not. No site stylesheet holds such a reference on 2026-11-24.
  - The link-check rule of `docs/protocol/cloud/site-delivery.md` says that every internal anchor, asset, and CSS URL resolves. The code skips fragment-only references in `.css` files, so the rule and the code disagree.
- **Impact if no action:** A valid shared rule with a fragment-only reference can fail `site:links` when Astro inlines its sheet, and a missing target in a large sheet passes. Readers of the protocol expect a check that the code does not make.
- **Root question:** How should `site:links` judge a fragment-only CSS reference, wherever the build puts its stylesheet?
- **Options:**
  - **A.** Keep the code, and state the `.css` exception in the link-check rule of the protocol. Small sheets that Astro inlines keep the anchor check. Effort: Small.
  - **B.** Separate CSS references from HTML anchors throughout the checker, with one fragment rule for `.css` files, `style` elements, and `style` attributes. Authored `style` attributes lose a check whose declarations always apply to their own element. Effort: Medium.
  - **C.** Give every `style` element the rule of a `.css` file, keep the anchor check for `style` attributes, and state the rule in the protocol. One verdict then holds for every sheet that a build step moves inline. Authored `style` elements lose a fragment check that no site source uses today. Effort: Small.
  - **D.** Check a fragment-only reference only where its rule applies: match the selectors of each document's sheets against the parsed document, and fail when a matching rule names a missing id. It adds `css-select` as a direct dependency and a map from each document to its sheets. A rule that applies only after a script adds a class stays unchecked. Effort: Large.
- **Left out:**
  - Turning off Astro's inlining. It breaks the rule of `docs/protocol/cloud/site-delivery.md` that small stylesheets are inlined to avoid a render-blocking request.
  - Placeholder SVG targets. They change the published document, can change how an element renders, and hide real defects.
  - A lint that rejects fragment-only references in shared sheets. It rejects valid styles.
- **Wider fix:** C. It does not depend on which build step moved a sheet inline.
- **Previous examples:** The closed PR #431 inlined the stylesheets of the old home stage frame. It needed a marker attribute, so that `site:links` gave those `style` elements the rule of a `.css` file. #488 removed that frame.
- **Recommendation:** C. One rule for every stylesheet text, at Small effort, with the protocol stating it.
- **Action:** ask the user, because C changes the verdict of the required `site:links` check for authored `style` elements, and a check change needs the user's approval.
