# Preview hosts serve no marketing site

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the post-merge notes of the deleted plans `unified-domain-layout.md`, `readable-addresses.md` and `pr-preview-environments.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `ts/worker/src/index.ts:235-249` and `docs/protocol/origin-router.md:40-54`.
- **Reason:** The plans descoped marketing on preview hosts, and they left it for when the team wants it.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The Worker still sends every preview path to the app, as the origin router contract requires.
- **Category:** Docs or spec.

- **Terms:**
  - **Origin router:** The Cloudflare Worker in `ts/worker` that sends site paths to Pages and product paths to the app.
  - **Pages alias:** The `pr-N.mokly-site.pages.dev` address of a pull request's site preview.
- **Background:** The list below gives the facts.
  - Production serves the site and the product on one origin. Preview hosts `https://<label>.preview.<domain>` serve the app at every path. The main-preview host has no marketing site.
  - A pull request's site preview lives on its Pages alias, where the site's relative app links are inert. The bot comment names the preview's sign-in address for app review.
  - `docs/protocol/origin-router.md:40-54` requires that every preview path goes to the app, and that only production shares the site and app origin.
  - `docs/ops/environment.md:99-103` keeps the apex as the only Pages custom domain.
- **Problem:** A reviewer cannot see the site and the product of one change on one origin before merge.
- **Impact if no action:** Site links into the app stay untested on previews, and reviewers use two addresses.
- **Root question:** Do preview hosts serve the marketing site beside the app?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Serve the production marketing build on `br-main.preview.mokly.ai` through the Worker, with `noindex`. The site-segment pass-through rule makes this a Pages origin choice. It covers only `br-main` with the production site build, so it does not show the site and the app of one change together. Effort: Medium.
  - **C.** Proxy each pull request's Pages alias on `pr-N.preview.mokly.ai` outside the product paths. The site's relative app links then work on previews, and the `pages.dev` bot link can go. A design must first settle the origins, the case when only one of the two previews exists, and `noindex`. Effort: Medium (estimate), to regrade after that design.
- **Left out:** A second Pages custom domain for previews. `docs/ops/environment.md` forbids a second custom domain on the site's project.
- **Wider fix:** C. Every pull request then gets the production shape.
- **Previous examples:** None found.
- **Recommendation:** C. It tests the site's app links in each change. The user has not chosen it, and the current contract does not allow it.
- **Action:** ask the user, because condition 1 holds: B and C change the requirement of `docs/protocol/origin-router.md` that every preview path goes to the app.

Source: [the unified domain post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/unified-domain-layout.md?plain=1#L607-L641) and [the readable addresses post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/readable-addresses.md?plain=1#L1223-L1254) of the deleted plans.
