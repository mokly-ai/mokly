# No check flags breaking SQL in new migrations

- **Severity:** Medium (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from the closed [PR #73](https://github.com/mokly-ai/mokly-cloud/pull/73), which re-landed finding R1 of the closed PR #39.
- **Location:** `xtask/src/checks/workspace.rs:240-265`.
- **Reason:** On 2026-10-30 the user closed the pull request with the check and asked to track its work as a follow-up item.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. The migration stage still checks only the lock, the order and the file layout, and it parses no SQL.
- **Category:** Process.

- **Terms:**
  - **Migration lock:** `crates/mkc-db/migration-lock.txt`, the list of merged migrations and their hashes that `cargo xtask migration-immutability` compares.
  - **Breaking schema change:** A statement that renames or drops a table, a column or a schema, moves a table to another schema, or changes a column type.
  - **Marker:** The line `-- breaking-schema-change: <reason>` in an `up.sql`, with a reason that names a reset gate or a rollout rule.
- **Background:** The migration `202610081500_screen_paths` renamed a column with no reset gate. An older running release and a rollback then broke screen Share. On 2026-10-12 the user approved a migration lint in the migration stage. It fails a new `up.sql` with a breaking schema change unless the file carries the marker with a nonempty reason. Review checks that the reason names a reset gate in that migration or a rollout rule in `docs/ops/deploy.md`.
- **Problem:** The migration stage on `main` checks only that merged migrations do not change. A new migration can rename or drop a column with no rollout plan, and every check passes.
- **Impact if no action:** The next breaking migration can break a running older release or a rollback, as `202610081500_screen_paths` did.
- **Root question:** How does each new migration state how a breaking schema change rolls out?
- **Options:**
  - **A.** Add only a review rule. The review focus in `AGENTS.md` then asks a reviewer to look for breaking schema changes in each new migration. No check runs. Effort: Small.
  - **B.** Bring back the closed branch. Effort: Large, because it adds three new modules and a new check.
    - `cargo xtask migration-immutability` also scans the `up.sql` of every migration that the lock on `origin/main` does not list. A breaking schema change fails the stage unless the file holds exactly one marker line with a nonempty reason. A duplicate, indented or empty marker fails with its line.
    - The scanner in `xtask/src/checks/migration_sql.rs` skips comments, strings, quoted identifiers, dollar-quoted and `BEGIN ATOMIC` bodies, and `DO` blocks, and counts lines once. Unit tests prove linear work with operation counts.
    - A CLI fixture with a large migration runs through the bounded process runner of `plans/follow-ups/integration-tests-need-gnu-timeout.md`.
    - `docs/protocol/repository-rust-workspace.md` states the rule and its reason. `xtask/README.md` names the stage change. The review focus in `AGENTS.md` asks a reviewer to check each marker's reason.
  - **C.** Scan each new migration with the Postgres parser, through a parser crate, instead of a hand-written lexer. It adds a dependency. Effort: Large.
- **Left out:** Change the merged `202610081500_screen_paths`. `AGENTS.md` freezes merged migrations, and `main` has deployed it since the closed PR #39 proposed a rollout rule for it.
- **Wider fix:** B. The check catches the class in every new migration. C is the same check with a real parser.
- **Previous examples:** `202610081500_screen_paths` renames a column, and `202609281203_billing_commands` drops columns. Before PR #77, a read-only port of the scanner flagged only these two of the 17 merged migrations of that time. PR #77 then added `202610291200_workspace_installations`, which drops a constraint, a class outside the approved rule.
- **Related:** `plans/follow-ups/integration-tests-need-gnu-timeout.md`, same code. The closed branch is stacked on that work, so it lands after it or with it.
- **Recommendation:** B. The user approved this check on 2026-10-12, and the closed branch passed the gate on 2026-10-27. That gate result is history. The approval does not cover constraints, indexes or `DO` bodies.
- **Action:** fix after merge, apply B, because the user approved the lint on 2026-10-12 and closed its pull request on 2026-10-30.

Facts for the work:

- The review of the closed branch found no problem. It named the residual risk. The scanner is a hand-written lexer, not the Postgres parser.
- An escape string that continues on a new line with `\'` hides the next statements from the scanner. `ALTER TABLE U&"t" UESCAPE '!' RENAME TO x` passes without a marker.
- The approved rule does not cover constraint, index or nullability changes, or DDL inside `DO` blocks. Review must still catch those. Store code names an `ON CONFLICT` target in 21 places, and a replaced unique constraint or index can break an older release.
- The closed branch `calummoore/reland-migration-breaking-check` holds the work at commit `e79c159e`, on top of `calummoore/reland-portable-process-runner`. On 2026-10-30 it conflicted with `main` in `xtask/README.md`. The branch did not land. Check the merge again and rerun the complete gate before a re-land.
