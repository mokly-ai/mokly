# Link check follows a base that the CSP blocks

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from the check of review finding 10 of the branch `calummoore/ci-fix-site-lighthouse-hn4n`.
- **Location:** `apps/site/scripts/links/check.ts:114-116`, which resolves each reference of a document against its `<base href>`. `apps/site/scripts/links/documents.ts`, which records the first `<base href>`. `docs/protocol/cloud/site-delivery.md:83`, the site CSP with `base-uri 'none'`.
- **Reason:** No site page has a `<base>` element today, so the gap is latent, and the site change that found it did not touch the link check.

- **Terms:**
  - **`site:links`:** the required check of the public site, `npm run site:links`, which resolves every internal reference of the built HTML and CSS in `apps/site/dist`.
  - **`base-uri 'none'`:** a CSP directive. With it, a browser ignores each `<base>` element of the page, so relative URLs resolve against the page's own URL.
- **Background:** The site sends its CSP from `apps/site/public/_headers`, and local preview sends the same header. The CSP holds `base-uri 'none'`.
- **Problem:** `site:links` resolves the references of a document against its `<base href>` when the document has one. A browser that applies the site CSP ignores that element. A probe of 2026-11-24 showed the difference: under `<base href="/docs/">`, `style="clip-path:url(#x)"` failed with "missing anchor #x in docs/index.html", although the page itself holds `#x`.
- **Impact if no action:** A page that gains a `<base>` element gets link verdicts for URLs that its readers' browsers never request.
- **Root question:** Which base URL must `site:links` use, so that it checks the URLs that the browser requests?
- **Options:**
  - **A.** Ignore `<base href>` in `site:links`, as the browser does under the site CSP, and resolve each reference against the document's own URL. Add a link test with a `<base>` element. Effort: Small.
  - **B.** Reject a `<base>` element in a built page, with an error that names the CSP. It is a new build error, which needs the user. Effort: Small.
  - **C.** Leave the code, and state in the link-check rule of `docs/protocol/cloud/site-delivery.md` that `site:links` follows `<base href>`. Effort: Small.
- **Left out:** Removing `base-uri 'none'` from the CSP. It weakens the security policy of the site to fit a check, so it fails the goal.
- **Wider fix:** A. The check then follows the same resolution as the browser under the CSP.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/link-check-skips-svg-presentation-urls.md` reuses the same resolution in its option A.
- **Recommendation:** A. It matches the browser and adds no new error.
- **Action:** fix after merge, apply A, because the gap is latent and outside the scope of the change that found it.
