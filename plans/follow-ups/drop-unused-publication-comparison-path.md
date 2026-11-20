# Drop the unused publication comparison path

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-02, from branch `conductor/mokly-rust-core-upgrade-m2-a-non-ui`, after the user's answer to item 14.
- **Location:** `crates/mkc-db/migrations/202611021200_publication_base_comparison/`, `crates/mkc-db/migrations/202609162000_publications/up.sql:38`, `crates/mkc-db/src/schema/publication.rs`, `crates/mkc-store-pg/src/publication_row.rs`, `crates/mkc-publications/tests/maintenance/rejected_identity_tests.rs`.
- **Reason:** The column must stay until the database reset after the 0.18.0 deploy makes the deploy rollback window unnecessary.

- **Terms:**
  - **Comparison:** An upload with a pinned base commit in `base_sha`.
  - **Generation:** The comparison directory that the stored `mokly-viewer/index.json` names.
- **Background:** Mokly Cloud stores uploads from the Mokly CLI in Postgres and a file store. Envelope 3 gives the base identity. Only the stored catalogue index gives the generation. On 2026-11-02, the user chose `base_sha` as the stored comparison flag. Migration `202611021200_publication_base_comparison` applies that choice without changing stored 0.14.0 rows.

  The code no longer reads or writes the generation in publication metadata. The unused `publications.comparison_path` column remains for deploy rollback. The `publication_immutable()` trigger still protects it. The private Diesel row still maps it and inserts null. `PublicationMetadata` has no such field.

- **Task:** After the database reset, add one forward migration that drops `publications.comparison_path`. Remove the column from both row expressions in `publication_immutable()`. Give the migration a reversing `down.sql` and two new migration-lock entries. Regenerate the Diesel schema. Remove the field and null initializer from `crates/mkc-store-pg/src/publication_row.rs`. Update the affected crate READMEs.

  The original `publication_immutable()` body is in `crates/mkc-db/migrations/202609162000_publications/up.sql`. Read it to build the replacement function. Preserve `base_sha` in the base CHECK, the observation CHECK and `publication_screen_immutable()`. Keep historical migrations unchanged. Remove the direct SQL assertion of a null `comparison_path` from `crates/mkc-publications/tests/maintenance/rejected_identity_tests.rs`. Keep every identity, refusal and failure-check assertion in that test.

- **Impact if no action:** The database and private row keep an unused field. Its immutability rule adds work to later schema changes.
- **Needs:** The 0.18.0 upgrade must be merged and deployed. The user chose a full database reset on 2026-10-26. Recreate each stable environment's database after deploy. This includes production when enabled. Republish the dogfood catalogue and recreate labelled PR previews. The reset removes accounts, workspaces, projects and 0.14.0 publications.

  Confirm that no deployment still needs the old column before dropping it.

- **Done when:** A fresh database migrates with no `publications.comparison_path` column. The immutability trigger and generated Diesel schema have no reference to it. The private row has no field for it. The new migration reverses successfully. Publication ingest, screen selection and check delivery pass their existing tests. The refused-comparison regression test still retains the authorized base identity and delivers its failure check.
