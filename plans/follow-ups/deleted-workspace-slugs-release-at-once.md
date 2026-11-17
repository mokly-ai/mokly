# Deleted workspace slugs release at once

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the post-merge decision of the deleted `plans/readable-addresses.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/protocol/platform-model.md:92-102`, `crates/mkc-db/migrations/202609221500_slugs/up.sql:116-140` and `crates/mkc-store-pg/src/organization.rs:165-182`.
- **Reason:** The plan left the cooling-off question for when the product is live, and the answer changes a requirement.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. Deletion still releases every slug claim at once through `ON DELETE CASCADE`, and a new subject can claim a vacant slug.
- **Category:** Security.

- **Terms:**
  - **Slug claim:** The record that reserves a workspace or project slug for its subject. A rename keeps the old claim as retired.
- **Background:** `docs/protocol/platform-model.md:92-102` states the rules. A rename keeps the old slug as a retired claim, and old addresses then resolve to the current one. Another subject can never take a current or retired claim. Deleting a subject releases all of its claims.
- **Problem:** After a workspace is deleted, anyone can register its slug at once. Old workspace links then open the new owner's workspace. An old project link reaches the new owner's content only when the new workspace also has a project with that slug. A UUID link cannot reach it.
- **Impact if no action:** Links and bookmarks that readers trust can lead to a stranger's workspace. Each new live workspace adds more such links.
- **Root question:** How long does a deleted workspace's address stay out of reach for others?
- **Options:**
  - **A.** Keep the immediate release. Effort: Small.
  - **B.** Keep the claims of a deleted workspace reserved for a cooling-off period, then release them. The claims cascade on delete today, so B needs a migration. Effort: Large.
- **Left out:** Keep the claims forever. Popular names would run out over time.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** B. A cooling-off period protects readers of old links at small cost.
- **Action:** ask the user, because condition 1 holds: B changes the release rule in `platform-model.md`. Condition 3 also holds, because the migration makes B Large.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/readable-addresses.md?plain=1#L1223-L1254) of the deleted plan.
