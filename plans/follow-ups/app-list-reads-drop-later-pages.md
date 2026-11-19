# App list reads drop the later pages

- **Severity:** Medium (estimate). **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the follow-up for finding 10 and an outside-the-scope note of the Milestone 5 review TODO in the deleted `plans/require-the-installation.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `apps/app/src/data/workspaces.ts:18-23`, `apps/app/src/data/workspaces.ts:30-40`, `apps/app/src/data/workspaces.ts:102-111`, `apps/app/src/data/projects.ts:16-25`, `apps/app/src/data/projects.ts:122-131` and `apps/app/src/data/publications.ts:86-96`.
- **Reason:** The wider fix is Large, and a Large fix needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The bug is still open. The four reads still return the first page's items only. `listEveryWorkspace` stops after 20 pages and drops the `truncated` flag.
- **Category:** Product bug.

- **Terms:**
  - **Page envelope:** The `{ items, nextCursor }` shape of every list response of the API. Lists return 50 rows by default.
  - **`followPages`:** The helper in `apps/app/src/data/publications.ts:86-96` that reads up to 20 list pages and returns the rows with a `truncated` flag.
- **Background:** The API returns every list in pages. Four reads still return only the first page's items: `listWorkspaces`, `listMembers`, `listProjects` and `listProjectGrants`. The callers cannot tell that more rows exist. `listEveryWorkspace` follows the pages through `followPages`, up to 20 pages of 50 rows. It returns the items only and drops the `truncated` flag.
- **Problem:** A reader with more than 50 workspaces, members, projects or grants sees only the first 50, and nothing says that the list stopped. A select that reads `listEveryWorkspace` also stops after 1,000 workspaces without a notice.
- **Impact if no action:** A large workspace hides members and projects in settings and panels. Each new list read copies the first-page pattern.
- **Root question:** How does every list read in the app either show all rows or say where it stopped?
- **Options:**
  - **A.** Change the four reads to follow the pages with `followPages`, and keep its `truncated` flag with the rows. Give `listEveryWorkspace` the flag too. Each caller that shows a list then says when the list stopped at the cap. The reads and their callers span about ten code files. The review graded the earlier A, which dropped the flag, Medium. Effort: Large (estimate).
  - **B.** Return the page envelope from every list read in `apps/app/src/data/`, so each caller follows the cursor or states its cap. Effort: Large.
- **Left out:** Raise the page size. It moves the limit and keeps the silence.
- **Wider fix:** B. Callers then cannot drop the cursor without a decision.
- **Previous examples:** Commit `048b6efb` fixed "Share loses screens after the first page" in the dependency upgrade. The switcher states its cap, as `plans/follow-ups/switcher-truncated-list-lacks-mockup.md` describes.
- **Related:** The list below gives the links.
  - `plans/follow-ups/reference-search-stops-at-the-cap.md`, same class for references.
- **Recommendation:** B. The review recommended the envelope as the wider fix of finding 10.
- **Action:** ask the user, because condition 3 holds: B is Large.

The review graded the follow-up Large and recorded `048b6efb` as the earlier example.

Source: [the Milestone 5 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/require-the-installation.md?plain=1#L244-L261) of the deleted plan.
