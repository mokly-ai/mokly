# Link check skips SVG presentation URLs

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-24, from the check of review finding 3 of the branch `calummoore/ci-fix-site-lighthouse-hn4n`.
- **Location:** `apps/site/scripts/links/documents.ts:34-51`, the attribute loop of `htmlDocument`. `apps/site/src/components/home/StorybookMark.astro:35`, an inline SVG path with `clip-path="url(#site-home-storybook-shape)"`.
- **Reason:** The fix makes the required `site:links` check read more references, which is stricter validation and needs the user.

- **Terms:**
  - **`site:links`:** the required check of the public site, `npm run site:links`, which resolves every internal reference of the built HTML and CSS in `apps/site/dist`.
  - **Presentation attribute:** an SVG attribute that sets a CSS property, such as `clip-path`, `mask`, `filter`, `fill`, or `marker-start`. Its value can be `url(#id)`.
- **Background:** `htmlDocument` reads the `href`, `src`, `poster`, `data`, `srcset`, and `style` attributes, and the text of each `style` element. The site draws inline SVG in its built HTML, for example the Storybook mark of the home page.
- **Problem:** `htmlDocument` reads no SVG presentation attribute. So `site:links` never checks the target of `clip-path="url(#site-home-storybook-shape)"`, or of any other `url(#id)` in such an attribute. The target of the Storybook mark exists today, in the same component.
- **Impact if no action:** A renamed or deleted SVG `clipPath`, `mask`, `filter`, gradient, or marker passes the required check, and the element renders without it.
- **Root question:** Which attribute values of the built HTML hold references that `site:links` must resolve?
- **Options:**
  - **A.** Read the `url()` value of each SVG presentation attribute that can hold one, from a fixed list, and resolve it as a fragment of the document. Add a link test for a missing target. Effort: Small.
  - **B.** Read every attribute value of an SVG element that starts with `url(` with `cssReferences`, whatever its name. Add the same test. It needs no list, but it can also read an attribute that holds no CSS. Effort: Small.
  - **C.** Leave the check as it is, and state in the link-check rule of `docs/protocol/cloud/site-delivery.md` that SVG presentation attributes are not checked. Effort: Small.
- **Left out:** A browser check of the computed style. Option E of `plans/follow-ups/link-check-fragment-css-by-location.md` holds that approach for CSS rules, and a static read is enough for an attribute, whose value always applies to its own element.
- **Wider fix:** A. The list names each property that the SVG specification lets hold a URL.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/link-check-fragment-css-by-location.md` judges fragment-only references of CSS text. An attribute value always applies to its own element, so its anchor check stays right under every option of that item.
- **Recommendation:** A. It checks every reference that the site can draw, with a small and explicit list.
- **Action:** ask the user, because A makes the required `site:links` check read more references.
