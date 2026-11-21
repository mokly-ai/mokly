# Link check judges CSS fragments by location

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-20, from the review of the branch `ci-fix/site-lighthouse-run-lighthouse-budget` (PR #431), the wider fix of finding 2 and two problems that its check found.
- **Location:** `apps/site/scripts/links/documents.ts`, `htmlDocument`, which reads `style` elements and `style` attributes. `apps/site/scripts/links/check.ts`, which drops fragment-only references of `.css` files. `apps/site/astro.config.mjs`, `build.inlineStylesheets: "auto"`. `docs/protocol/cloud/site-delivery.md`, the link-check rule under "Checks".
- **Reason:** The wider fix changes the verdict of a required check, so the user must choose it.

- **Terms:**
  - **`site:links`:** the required check of the public site, `npm run site:links`, which resolves every internal reference of the built HTML and CSS in `apps/site/dist`.
  - **Fragment-only CSS reference:** a CSS URL that holds only a fragment, such as `filter: url(#glow)`. It names an element of the document that uses the rule.
- **Background:** `site:links` reads each built HTML, SVG, and CSS file. For a `.css` file it drops every fragment-only reference, because one stylesheet serves many documents. For an HTML `style` element or a `style` attribute it keeps them, and it fails when the document has no element with that id. The home stage now inlines its catalogue stylesheets into `style` elements. PR #431 marks those elements, and `site:links` gives a marked element the rule of a `.css` file. That keeps the verdict that the same sheets got as files on `origin/main`.
- **Problem:** The verdict on one CSS rule still depends on where the build puts its sheet.
  - Astro inlines a site stylesheet under 4 kB into a `style` element, because `build.inlineStylesheets` is `auto`. A fragment-only reference of that sheet then gets the anchor check, and the same reference in a larger sheet does not. No current site sheet holds such a reference.
  - The link-check rule of `docs/protocol/cloud/site-delivery.md` says that every internal anchor, asset, and CSS URL resolves. The code skips fragment-only references in `.css` files, so the rule and the code disagree.
- **Impact if no action:** A valid shared rule with a fragment-only reference can fail `site:links` when Astro inlines its sheet, and a missing target in a large sheet passes. Readers of the protocol expect a check that the code does not make.
- **Root question:** How should `site:links` judge a fragment-only CSS reference, wherever the build puts its stylesheet?
- **Options:**
  - **A.** Keep the marker rule of PR #431, and change the protocol rule so that it states the `.css` and marked-element exception. Small sheets that Astro inlines keep the anchor check. Effort: Small.
  - **B.** Separate CSS references from HTML anchors throughout the checker, with one fragment rule for `.css` files, `style` elements, and `style` attributes. Authored `style` attributes lose a check whose declarations always apply to their own element. Effort: Medium.
  - **C.** Give every `style` element the rule of a `.css` file, keep the anchor check for `style` attributes, drop the marker, and state the rule in the protocol. One verdict then holds for a sheet that the stage, Astro, or an import moves inline. Authored `style` elements lose a fragment check that finds nothing in the current output. Effort: Small.
  - **D.** Check a fragment-only reference only where its rule applies: match the selectors of each document's sheets against the parsed document, and fail when a matching rule names a missing id. It adds `css-select` as a direct dependency and a map from each document to its sheets. A rule that applies only after a script adds a class stays unchecked. Effort: Large.
- **Left out:** Placeholder SVG targets in the stage. They change the published document, can change how an element renders, and hide real defects. A lint that rejects fragment-only references in shared sheets. It rejects valid styles.
- **Wider fix:** C. It does not depend on which build step moved a sheet inline.
- **Previous examples:** None found. The marker of PR #431 is the direct fix for the stage sheets.
- **Recommendation:** C. One rule for every stylesheet text, at Small effort, with the protocol stating it.
- **Action:** ask the user, because C changes the verdict of the required `site:links` check for authored `style` elements, and a check change needs the user's approval.
