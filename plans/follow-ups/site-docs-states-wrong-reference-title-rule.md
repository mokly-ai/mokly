# Site docs states the wrong Reference title rule

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the closed [PR #67](https://github.com/mokly-ai/mokly-cloud/pull/67), review finding 1. The closed PR #39 left the title choice open as finding F9.
- **Location:** the sentence "The document's first `h1` becomes the page title" in `docs/protocol/cloud/site-docs.md`, `apps/site/src/docs/reference.ts:1-8` and `:93-99`, `apps/site/src/docs/pages.ts:108-118` and `apps/site/src/docs/reference-allowlist.ts:18-19` and `:43-49`.
- **Reason:** The closed PR #39 left the title choice open as a product decision, and the recommended option changes a protocol requirement.
- **Checked:** 2026-11-17, in the combined repository. The choice is still open. The pages still show the allowlist titles, and both `site-docs.md` and `docs/protocol/mokly-guides.md` still name the source heading as the title.
- **Category:** Docs or spec.

- **Terms:**
  - **Reference section:** The site docs section that republishes allowlisted protocol documents of the `@mokly/mokly` package under `/docs/reference/<slug>/`.
  - **Allowlist:** `REFERENCE_DOCUMENTS` in `apps/site/src/docs/reference-allowlist.ts`, which gives each published document its source, slug, title, description and order.
  - **`mokly-guides.md`:** The guide contract `docs/protocol/mokly-guides.md` of `@mokly/mokly`, whose lines 105-106 make a document's first level-one heading its page title.
- **Background:** The site removes the first `h1` of each published document. It shows the allowlist title as the page title, at `pages.ts:117`. The allowlist titles are in sentence case and have no version suffix, for example "Catalogue upload". The source headings differ, for example "Catalogue Upload Exchange v1".
- **Problem:** That sentence of `site-docs.md` and the comment in `reference.ts:1-8` say that the document's first `h1` becomes the page title. Both contradict the code. No cloud doc records that the site departs from the rule in `mokly-guides.md`.
- **Impact if no action:** The protocol doc states a requirement that the site does not meet. A change that follows the doc would give the six published pages their package headings as titles.
- **Root question:** Which title does a published Reference page show, and where is that rule stated?
- **Options:**
  - **A.** Keep the allowlist titles. Replace the sentence in `site-docs.md` with the implemented rule. Say that it departs from `mokly-guides.md`, because the allowlist supplies sentence-case titles without version suffixes. Correct the comment in `reference.ts`. It changes a protocol requirement. Effort: Small.
  - **B.** Follow the package rule. Use each document's first `h1` as the page title, and keep the allowlist title as the sidebar label. Visible titles then become headings such as "Catalogue Upload Exchange v1". The change is in the page mapping and the renderer, with no new helper. The source graded B Medium. Effort: Small (estimate).
  - **C.** Change `docs/protocol/mokly-guides.md:105-106` so that the cloud renderer shows the allowlist title, replace the sentence in `site-docs.md` to match, and correct the comment in `reference.ts`, in one change. The code does not change. It changes the title requirement of the package's guide contract and of `site-docs.md`. Effort: Small.
- **Left out:** None. The site, the cloud doc and the package contract are the three places that can change.
- **Wider fix:** C. One title rule in the package contract removes the local exception.
- **Previous examples:** On the branch of the closed cloud PR #39, in the old repository `mokly-ai/mokly-cloud`, commit `065c9fc0` fixed the comment and commit `c26368dc` fixed the sentence with the option A text. Commit `9a4ed003` added the current sentence, and commit `6a27c76b` added the allowlist titles.
- **Related:** None open. `plans/follow-ups/site-reference-omits-upload-exchange.md` changed the same code, and the cloud pull request #94 deleted it on 2026-11-03. The closed branch of that item rewrote the comment in `reference.ts` to the option A rule.
- **Recommendation:** C. The guide contract is now in this repository, so C costs about as much as A, and it removes the local exception. The first recommendation was A, when C needed a release of another repository.
- **Action:** ask the user, because condition 1 holds: options A and C change the title requirement, and the closed PR #39 left that choice open.
