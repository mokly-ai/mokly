# mkc-test-pg

`mkc-test-pg` provides disposable, verified Postgres schemas for Cargo workspace
integration tests. Depend on it only as a dev-dependency when a test needs its
own migration and persistence scope.

## Responsibilities

- Allocate a unique scratch schema with a URL selecting that schema.
- Verify the connection's current schema before tests run destructive SQL.
- Clean up the schema on drop without masking a test failure.

## What This Crate Does

Use it for any test that counts or reads a bounded queue, shares deliberately
retained rows, or runs destructive DDL, so data left by another test cannot
change a result.

`ScratchSchema::create(prefix)` returns `None` only when an unconfigured local
Postgres is unreachable. When `MKC_TEST_DATABASE_URL` or `CI` is set, an
unreachable database fails the test. It creates a UUID v7 schema, verifies
`current_schema()` on a connection opened from the scoped URL, and drops the
schema best-effort on scope exit. Use `scoped_url()` for migrations and queries.

## Quick Start

```rust
use mkc_test_pg::scratch_schema::ScratchSchema;

let Some(schema) = ScratchSchema::create("billing") else {
    return;
};
assert!(schema.name().starts_with("billing_"));
let database_url = schema.scoped_url();
```

## Development

```sh
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test cargo test -p mkc-test-pg
cargo clippy -p mkc-test-pg --all-targets -- -D warnings
```

### Key Code

- [scratch_schema.rs](./src/scratch_schema.rs) — `ScratchSchema`: `create` makes and verifies a UUID v7 schema or skips an unconfigured unreachable database, `scoped_url` selects it as the connection's search path, and `Drop` removes it best-effort.
- [tests/scratch_schema_tests.rs](./tests/scratch_schema_tests.rs) — the live Postgres test that the scoped connection selects the schema and that the schema is gone after drop.

### Related Docs

- [Repository layout](../../docs/protocol/cloud/repository-layout.md)
- [Persistence boundaries](../../docs/protocol/cloud/persistence-boundaries.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
