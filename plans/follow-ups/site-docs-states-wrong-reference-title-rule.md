# Site docs states the wrong Reference title rule

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the closed [PR #67](https://github.com/mokly-ai/mokly-cloud/pull/67), review finding 1. The closed PR #39 left the title choice open as finding F9.
- **Location:** `docs/protocol/site-docs.md:154-159`, `ts/site/src/docs/reference.ts:1-8` and `:93-99`, `ts/site/src/docs/pages.ts:108-118` and `ts/site/src/docs/reference-allowlist.ts:18-19` and `:43-49`.
- **Reason:** The closed PR #39 left the title choice open as a product decision, and the recommended option changes a protocol requirement.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The pages still show the allowlist titles, and both `site-docs.md` and the pinned `mokly-guides.md` still name the source heading as the title.
- **Category:** Docs or spec.

- **Terms:**
  - **Reference section:** The site docs section that republishes allowlisted protocol documents of the pinned `@mokly/mokly` package under `/docs/reference/<slug>/`.
  - **Allowlist:** `REFERENCE_DOCUMENTS` in `ts/site/src/docs/reference-allowlist.ts`, which gives each published document its source, slug, title, description and order.
  - **`mokly-guides.md`:** The guide contract in `ts/node_modules/@mokly/mokly/docs/protocol/`, whose lines 105-109 make a document's first level-one heading its page title.
- **Background:** The site removes the first `h1` of each published document. It shows the allowlist title as the page title, at `pages.ts:117`. The allowlist titles are in sentence case and have no version suffix, for example "Catalogue upload". The source headings differ, for example "Catalogue Upload Exchange v1".
- **Problem:** `site-docs.md:156-157` and the comment in `reference.ts:1-8` say that the document's first `h1` becomes the page title. Both contradict the code. No cloud doc records that the site departs from the rule in `mokly-guides.md`.
- **Impact if no action:** The protocol doc states a requirement that the site does not meet. A change that follows the doc would give the six published pages their package headings as titles.
- **Root question:** Which title does a published Reference page show, and where is that rule stated?
- **Options:**
  - **A.** Keep the allowlist titles. Replace the sentence in `site-docs.md` with the implemented rule. Say that it departs from `mokly-guides.md`, because the allowlist supplies sentence-case titles without version suffixes. Correct the comment in `reference.ts`. It changes a protocol requirement. Effort: Small.
  - **B.** Follow the package rule. Use each document's first `h1` as the page title, and keep the allowlist title as the sidebar label. Visible titles then become headings such as "Catalogue Upload Exchange v1". The change is in the page mapping and the renderer, with no new helper. The source graded B Medium. Effort: Small (estimate).
  - **C.** Ask the open Mokly repository to let the cloud supply its own titles in `mokly-guides.md`, and adopt that release. It needs a release in another repository. Effort: Large.
- **Left out:** None. The site, the cloud doc and the package contract are the three places that can change.
- **Wider fix:** C. One title rule in the package contract removes the local exception.
- **Previous examples:** On the branch of the closed PR #39, commit `065c9fc0` fixed the comment and commit `c26368dc` fixed the sentence with the option A text. Commit `9a4ed003` added the current sentence, and commit `6a27c76b` added the allowlist titles.
- **Related:** `plans/follow-ups/site-reference-omits-upload-exchange.md`, same code. The closed branch of that item already rewrites the comment in `reference.ts` to the option A rule.
- **Recommendation:** A. It makes the protocol doc match the shipped titles. C best protects the codebase, because the package contract then matches the cloud.
- **Action:** ask the user, because condition 1 holds: option A changes the title requirement, and the closed PR #39 left that choice open.
