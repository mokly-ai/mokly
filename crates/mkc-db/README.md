# mkc-db

The platform database schema and migration runner of Mokly Cloud. The crate
embeds the Diesel migrations, applies them, reports migration readiness and
holds the generated schema that `mkc-store-pg` queries through. Depend on it
from a composition root that must migrate before it serves (`mkc-api`,
`mkc-catalogue-server`), from a Postgres adapter, or from an integration test
that migrates its own scratch schema. It owns no queries and performs no
product authorization.

## Responsibilities

Own the immutable migration pairs, their checksums in the migration lock, the
generated schema and migration execution.

## What This Crate Does

`MigrationRunner::migrate` applies the pending embedded migrations under a
Postgres advisory lock, so concurrent process starts serialize and each
migration applies once. `MigrationStatus::is_current` reports whether
migrations are pending without applying them; `PooledMigrationStatusFactory`
gives it a one-connection pool separate from the product-query pool, and the
API's `/v1/health` reads it. `schema` is the Diesel schema generated from a
migrated database and split into table groups, so that every generated file
stays below the line cap.

Migrations are append-only. Each migration is a `<YYYYMMDDHHMM>_<description>`
directory with an `up.sql` and a `down.sql` that reverses it, and
`migration-lock.txt` records the checksum of every SQL file.
`cargo xtask migration-immutability` fails when a file listed in the lock on
`origin/main` changes, so a merged migration is frozen: change a schema with
a new migration, never by editing SQL that has merged. There are no seed
migrations; scripts and fixtures create data through the API after migrating.
When you edit an unmerged migration that a local database has already
applied, use a fresh disposable database.

## Quick Start

```rust
use mkc_db::migration::{
    DieselMigrations, MigrationRunner, MigrationStatusFactory, PooledMigrationStatusFactory,
    Result,
};

/// Apply pending migrations, then read readiness on a separate one-connection pool.
fn migrate(database_url: &str) -> Result<bool> {
    DieselMigrations.migrate(database_url)?;
    PooledMigrationStatusFactory
        .connect(database_url)?
        .is_current()
}
```

The API binary wraps the same runner, and the schema is regenerated from a
migrated database:

```sh
cargo run -p mkc-api -- migrate
cargo install diesel_cli --no-default-features --features postgres
DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test scripts/cloud/db-schema.sh
cargo xtask migration-immutability
```

## Development

```sh
cargo test -p mkc-db
cargo clippy -p mkc-db --all-targets -- -D warnings
```

The migration tests need Postgres 16 with the UTF8 server encoding, because the
slug migration calls `normalize`. With a native Postgres, use a cluster with
that encoding, for example one created with `initdb -E UTF8 --locale=C.UTF-8`.
The tests read `MKC_TEST_DATABASE_URL`
(default `postgres://postgres:postgres@localhost/mkc_test`); each one creates
and drops its own schema. The optional `unimock` feature exposes the
`MigrateMock` and `CurrentMock` APIs for downstream unit tests; keep it in
dev-dependencies, because production readiness uses the real Diesel
implementation.

`RENAME COLUMN` does not rewrite PL/pgSQL function text. A migration that
renames a column a trigger function reads therefore replaces the function
body in both `up.sql` and `down.sql`, as `202610081500_screen_paths` does for
`publication_screen_immutable()`: `up.sql` reads `NEW.screen_path` and
`down.sql` restores `NEW.screen_id`, while the digest column, its index and
the existing rows are preserved.

### Key Code

- [migrations/](./migrations/) — one `<YYYYMMDDHHMM>_<description>` directory per migration with `up.sql` and `down.sql`; [migration-lock.txt](./migration-lock.txt) records their hashes.
- [migration.rs](./src/migration.rs) — `MigrationRunner`, which applies the embedded migrations under a Postgres advisory lock so concurrent starts serialize, and `MigrationStatus`, the readiness reader on its own one-connection pool.
- [schema/mod.rs](./src/schema/mod.rs) — the generated Diesel schema and the column reference for every table; `scripts/cloud/db-schema.sh` regenerates it with `diesel print-schema` into the fifteen table groups of the root `diesel.toml`, each file below the line cap.
- [build schema](./src/schema/build.rs) and [build output schema](./src/schema/build_output.rs) — `builds`, and the `build_upload_grants`, `build_log_chunks` and `build_checks` rows that cascade with their build.
- [publication schema](./src/schema/publication.rs), [publication event schema](./src/schema/publication_events.rs) and [screen selection schema](./src/schema/publication_screens.rs) — `publications`, `publication_files`, `blobs`, `publication_events`, `catalogue_grants`, `publication_branch_aliases` and `publication_screen_views`; expiry keeps the publication row and `publication_events` and deletes the files, grants and screen views that reference the publication.
- [slug schema](./src/schema/slug.rs) — the workspace and project slug claim registries.
- [migrations/202609171200_retention_indexes](./migrations/202609171200_retention_indexes/) — the partial indexes behind the bounded retention and collection candidate reads: attempt deadlines, retained ages, collectible blobs by grace and by tombstone, and undelivered dead letters.
- [migrations/202611041200_failed_publication_retention](./migrations/202611041200_failed_publication_retention/) — replaces the ready-and-failed age index with a failed-only age index, so failed-attempt pruning never scans retained ready publications.
- [migrations/202611041201_github_retention](./migrations/202611041201_github_retention/) — the terminal-delivery partial index by receipt time behind bounded 30-day webhook payload cleanup; the existing OAuth expiry index serves the one-day flow cleanup.
- [migrations/202609271200_project_owned_blobs](./migrations/202609271200_project_owned_blobs/) — the `(project_id, hash)` blob identity, the `(hash, incarnation)` unique maintenance lookup and the `publication_file_reference` trigger that keeps `blobs.ref_count` and `unreferenced_at` current on every file insert, delete and parent cascade.
- [migrations/202609162130_viewer_pr_author](./migrations/202609162130_viewer_pr_author/) — adds the nullable `github_pull_requests.author` login that provider reconciliation fills, and the project history and ready-PR indexes.
- [migrations/202610081500_screen_paths](./migrations/202610081500_screen_paths/) — renames `publication_screen_views.screen_id` to `screen_path` and replaces the `publication_screen_immutable()` trigger body in both directions so that its SHA-256 digest reads the active column.
- [migrations/202610100900_cloud_builds](./migrations/202610100900_cloud_builds/) — adds the durable builds with their failure causes, the per-attempt upload digests, the redacted log chunks with a permanent sequence counter that retry cleanup never resets, and the versioned check outbox whose delivery claim expires independently of its state version; `projects.automatic_builds` starts off for every existing project, a publication can name a build and reserves its cleanup event ID, deleting the build clears that link while ready and expired publications keep their history, and only a failed build may keep an exit code, including upload and plan refusals.
- [migrations/202610100901_github_pull_repository_ids](./migrations/202610100901_github_pull_repository_ids/) — adds the nullable head and base GitHub repository IDs of `github_pull_requests`; older observations stay null until reconciliation, so builds skip them safely.

- [migrations/202610291200_workspace_installations](./migrations/202610291200_workspace_installations/) — replaces the installation's workspace uniqueness constraint with an ordinary index; [workspace_installations_migration_tests.rs](./tests/workspace_installations_migration_tests.rs) verifies two bindings and the reversing constraint.
- [migrations/202611011910_build_failure_causes](./migrations/202611011910_build_failure_causes/) — narrows build failure causes to the 0.18.0 runner. It changes legacy failures to `exit` before validating the constraint. `legacy_build_failures` keeps only their build IDs for rollback and cascades on build deletion. Rollback restores those causes, leaves ordinary `exit` rows unchanged and removes the ID table. Both directions preserve exit codes and other build fields.
- [migrations/202611021200_publication_base_comparison](./migrations/202611021200_publication_base_comparison/) — uses `base_sha` for the paired base, Changes observation and validating screen-selection rules. Existing 0.14.0 rows remain valid. The unused `comparison_path` column stays immutable for deploy rollback. Schema rollback restores the old constraints and trigger when rows satisfy them. Otherwise, its guard tells the operator to reset the environment.

### Related Docs

- [Persistence boundaries](../../docs/protocol/cloud/persistence-boundaries.md)
- [Repository Rust workspace](../../docs/protocol/cloud/repository-rust-workspace.md#dependencies-and-migrations) — the migration lock.
- [Platform model](../../docs/protocol/cloud/platform-model.md)
- [Authentication](../../docs/protocol/cloud/auth-sessions.md)
- [Changes check](../../docs/protocol/cloud/changes-check.md)
- [Retention](../../docs/protocol/cloud/retention.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
