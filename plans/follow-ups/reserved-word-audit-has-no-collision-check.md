# Reserved word audit has no collision check

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the post-merge decision of the deleted `plans/readable-addresses.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-domain/src/slug.rs:40-83`, `docs/protocol/cloud/platform-model.md:99-104`, `crates/mkc-store-pg/src/organization.rs:165-182` and `crates/mkc-db/migrations/202609221500_slugs/up.sql:116-126`.
- **Reason:** The plan left the question for when the product is live, and the fix is new tooling.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. `platform-model.md:98-103` still requires a collision audit, and no command or runbook query lists the collisions of a candidate word.
- **Category:** Process.

- **Terms:**
  - **Reserved word:** A first path segment that a workspace slug may not take, because the site, the app or the policy set owns it.
- **Background:** `crates/mkc-domain/src/slug.rs` lists the reserved first segments: the site's, the app's static routes and a forward-looking policy set. `docs/protocol/cloud/platform-model.md:99-104` says that a new reserved word after launch needs an audit migration for collisions before validation changes. It requires no command and no gate. Current and retired workspace claims share one globally unique slug table, so the audit must include retired claims.
- **Problem:** No tool lists the workspaces whose slug collides with a candidate word. The audit migration then depends on a manual query.
- **Impact if no action:** A new site or app route can ship before its collision audit, and a workspace that holds the word then hides the route.
- **Root question:** How does a new reserved word find its collisions before it ships?
- **Options:**
  - **A.** Keep the manual audit, and give the query in a runbook. Effort: Small.
  - **B.** Add a command that lists the workspaces that collide with a candidate word, and run it before each new reserved word. It is optional new tooling. Effort: Medium.
- **Left out:** A gate that fails each new route without a collision report. It would be a new gate for a rare change.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** A. New reserved words are rare, and a runbook query is enough for them.
- **Action:** ask the user, because condition 5 holds: the plan asked the user to decide this policy question.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/readable-addresses.md?plain=1#L1223-L1254) of the deleted plan.
