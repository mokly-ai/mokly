# Integrations keep the organization subject kind

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the post-merge notes of the deleted `plans/workspaces.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-db/migrations/202609161100_platform/up.sql:15-25`, `crates/mkc-store-interface/src/integration.rs:8-15` and `crates/mkc-store-pg/src/integration.rs:12-57`.
- **Reason:** The recommended migration is Large, and the design call that chose it was the agent's, not a user decision.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. The API writes only user-kind rows, but the schema, the interface and the adapter still support the organization kind. The row counts of each environment are unknown.
- **Category:** Dead code.

- **Terms:**
  - **Subject kind:** The column of an `integrations` row that says whether the row belongs to a user or to an organization, the persistence name of a workspace.
- **Background:** The list below gives the facts.
  - Before the workspaces change, binding a GitHub App installation also wrote an organization-kind `integrations` row.
  - The workspaces change of PR #77 stopped writing and reading those rows. GitHub sign-in still writes the user-kind row.
  - No migration touched `integrations`, because nothing is in production and stale rows are a development concern. The design call of 2026-10-29 left the drop for a later migration.
  - `subject_kind` is a text column with a CHECK for `user` or `organization`, not a native enum. Generated parent columns and foreign keys depend on it.
  - `IntegrationSubject::Organization` and the adapter still support both kinds.
- **Problem:** The schema still allows the organization subject kind, and old rows of that kind can remain in an environment.
- **Impact if no action:** Dead rows and a dead allowed value stay in the schema. A later reader can take them for live data.
- **Root question:** When and how does the schema lose the unused subject kind?
- **Options:**
  - **A.** Keep the kind and its rows, and record them as unused in the `mkc-db` README. Effort: Small.
  - **B.** Count the organization-kind rows of each environment with a read-only query. When none remain, add a forward migration. It removes the kind from the CHECK and from the generated columns and foreign keys that depend on it. Give it a `down.sql` that restores it, and two lock entries. Remove the organization branch of the interface and the adapter. Effort: Large.
- **Left out:** Delete the rows in the same migration without the check. A merged migration cannot change, so a wrong delete cannot be undone by editing it.
- **Wider fix:** None. The migration lock already guards merged migrations.
- **Previous examples:** The workspaces migration `202610291200_workspace_installations` changed the installation uniqueness constraint in the same way, with a reversing `down.sql`.
- **Recommendation:** B. The schema then states only what the product uses.
- **Action:** ask the user, because condition 3 holds: B is a migration, which is Large. The design call of 2026-10-29 that chose it is not a user decision.

Use the `databases` skill for the migration. The `migration-immutability` stage checks the lock in `crates/mkc-db/migration-lock.txt`.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/workspaces.md?plain=1#L1019-L1038) of the deleted plan.
