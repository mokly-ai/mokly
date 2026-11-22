# Site pages still marked ahead of release

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge tasks of the deleted plans `public-site.md`, `mokly-cloud-initial-scope.md` and `billing.md`, on the branch `calummoore/plans-skill-update`. On 2026-11-01 the merge of `main` into `calummoore/maseru` merged the duplicate item `billing-pages-go-live-check.md` into it.
- **Location:** `apps/site/src/content/docs/cloud/overview.md`, `connect-a-repository.md`, `branches-and-pull-requests.md`, `builds.md`, `sharing-and-access.md`, `workspaces-and-roles.md`, `settings.md` and `plans-and-billing.md` in the same folder, `apps/site/src/content/docs/review/agent-sessions.md`, `approvals.md`, `click-to-reference.md`, `comments.md` and `pull-request-sync.md` in the same folder, `docs/protocol/cloud/site.md:197-208` and `docs/ops/deploy.md:383-384`.
- **Reason:** The alignment pass compares the site with the deployed product, so it waits until the product ships.
- **Checked:** 2026-10-31, at commit `f568853e`. Not verified. All eight cloud pages still carry `status: "ahead"`, and no dated alignment result was found. The marker alone does not prove that the deployed docs are wrong.

- **Terms:**
  - **Ahead page:** A site docs page with `status: "ahead"` in its frontmatter, written before the behaviour that it describes shipped.
  - **Marked drawing:** A drawing in the site or its mockups of a feature that the product does not have yet, with a `status: "ahead" (features)` comment.
  - **Go-live alignment pass:** The comparison of every ahead page and every marked drawing with the deployed product before the production domain goes live.
- **Background:** `docs/protocol/cloud/site.md:197-208` defines the rule. A page keeps the status until its routes, fields, labels and behaviour match the shipped product. On 2026-10-30, eight cloud pages carry `status: "ahead"`: `overview.md`, `connect-a-repository.md`, `branches-and-pull-requests.md`, `builds.md`, `sharing-and-access.md`, `workspaces-and-roles.md`, `settings.md` and `plans-and-billing.md`. On 2026-11-22, the five Review and edit pages under `apps/site/src/content/docs/review/` carry it too: `agent-sessions.md`, `approvals.md`, `click-to-reference.md`, `comments.md` and `pull-request-sync.md`. The legal pages carry the company's real text. The operator reported in PR #82 that production billing went live on 2026-10-30. `docs/ops/production.md:100-106` records only an older rollout and a sign-in smoke.
- **Task:** Run the go-live alignment pass.
  - Compare each ahead page with the deployed product, and remove or reword the text that did not ship.
  - Drop `status: "ahead"` from each page that now matches.
  - Check every marked drawing. "Boundary" in `docs/protocol/cloud/site.md` and "Content Boundaries" in `apps/site/README.md` give the rule. From the repository root, run `grep -rn 'status: "ahead"' apps/site/src docs/mockups/src/screens/design/site`. It lists the ahead pages and the marked drawings.
  - Check each feature that a mark names against the deployed product. A named agent, Claude or Codex, stays only when agent sessions support it.
  - Remove each drawing of a feature that did not ship, together with the copy that names the feature. Remove it from the site mockups first, because they are the visual source of truth. Then remove it from the site and from `docs/protocol/cloud/site-copy.md`. When an agent goes from `apps/site/src/components/people.ts` or `docs/mockups/src/screens/design/site/parts/people.tsx`, the type check fails at each `person` that still names it.
  - Remove the mark of each drawing whose features all shipped, in the mockups and on the site.
  - Confirm the Plans and billing docs page against production billing.
  - Confirm that the production domain serves the latest Pages deployment, and smoke it.
- **Impact if no action:** Public docs can describe behaviour that the product does not have, and the Plans and billing page can contradict live billing.
- **Needs:** The deployed production product and site. The review is read-only. Grade the code effort of each later edit from its own scope.
- **Done when:** A dated result names the deployed app and site revisions. It covers the routes, fields and labels of all 13 ahead pages, the eight cloud pages and the five Review and edit pages, billing and the domain deployment. No cloud page then carries `status: "ahead"` without a reason. The result also covers every marked drawing, and the search of the Task then lists no drawing in the site or its mockups.

Source: [the public site post-merge task](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/public-site.md?plain=1#L294-L303) and [the billing post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/billing.md?plain=1#L1090-L1106) of the deleted plans.
