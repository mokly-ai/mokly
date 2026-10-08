# Databases

Rules for database code, Diesel migrations, preview seed migrations, and
Postgres store crates.

Separate database operations from business logic:

- Database queries should be in dedicated functions, separate from business logic
- Makes testing easier and improves code organization
- Enables better error handling and query optimization
- Database migrations are frozen once they have been merged to the target
  branch. Do not edit an existing merged migration to change schema history;
  create a new forward migration instead, with a matching rollback when
  rollback is supported.
- Preview seed migrations under `crates/bkf-db/seed_migrations` are also
  immutable once committed or applied by a preview database. Do not rewrite,
  delete, renumber, or "clean up" an existing seed migration file; add a new
  forward seed migration for fixture changes or repairs.

Database migrations:

- Name new migrations with a full date, hour, and minute prefix in the format
  `<YYYYMMDDHHMM>_<description>` to avoid timestamp conflicts.
- Never update an existing migration after it has been committed to `main`;
  create a new follow-up migration instead.
- `cargo xtask check` enforces the migration lock for Diesel migrations and
  preview seed migrations. When adding a new migration, add only the new file
  and its checksum lock entry; never update a lock entry for an existing file.

Postgres store crates:

- Crates named `*-store-pg` must contain only database query implementations, Diesel row mappings, migrations/schema integration, and mappings to their store-interface DTOs/errors
- `*-store-pg` crates may depend on their store-interface crate and `juno-db` for shared schema/migrations, plus necessary external database/serialization/error crates
- Do not put business logic, service orchestration, runtime wiring, agent turn runners, model/tool providers, queue scheduling, HTTP/gRPC clients, KMS composition, or other side-effecting service adapters in `*-store-pg` crates
- If a Postgres-backed service needs more than query execution and interface mapping, keep the query code in the `*-store-pg` crate and put the service/composition logic in a separate non-store crate
- Existing `*-store-pg` code that violates this rule should be treated as legacy structure to extract, not as precedent for new code
