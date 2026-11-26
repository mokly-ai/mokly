# Cloud database tests migrate every scratch schema

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-26, from branch `calummoore/test-audit-app-and-cloud-rust-fl63`, the cloud test audit.
- **Location:** `crates/mkc-test-pg/src/scratch_schema.rs`, `crates/mkc-db/src/migration.rs:46`, `crates/mkc-store-pg/src/_tests_/build_pg/support.rs:38`.
- **Reason:** The user chose on 2026-11-26 to change nothing now, because the job that runs these tests is not on the critical path of CI.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Scratch schema:** the unique Postgres schema that `ScratchSchema::create` in `crates/mkc-test-pg/src/scratch_schema.rs` makes for one test, with a connection URL that selects it as the search path. It is dropped when the test ends.
  - **Workspace checks (Rust):** the CI job that runs the tests of the `mkc-*` crates with `cargo nextest`.
- **Background:**
  - Each Postgres test of the `mkc-*` crates creates its own scratch schema. Most fixtures then call `DieselMigrations.migrate`, which applies all 23 migrations of `crates/mkc-db/migrations` to that schema. `ScratchSchema::create` is called from 9 files in `mkc-api`, 11 in `mkc-store-pg`, 4 in `mkc-db`, and 1 in `mkc-publications`, and 23 call sites outside `mkc-db` run `migrate`.
  - `DieselMigrations.migrate` (`crates/mkc-db/src/migration.rs:46`) holds the Postgres advisory lock `739217004` while it migrates. So tests that run side by side migrate one at a time.
  - Measured on 2026-11-26 on a 4-core machine: the cheapest `mkc-store-pg` build test, which is mostly the migrated fixture, takes 0.40 s alone. The test with no migration, `serial_calls_reuse_one_session`, takes 0.19 s. The 56 `build_pg_tests` took 61.6 s of test time in CI run 45850457691, about 1.1 s each.
  - In CI run 45858742920 the job took 4.4 minutes, and the `mkc-*` tests took 283.4 test seconds. The App browser shards take 6 to 8 minutes, so this job does not set the CI wall time.
- **Problem:** Every database test repeats the same 23 migrations, one test at a time behind one lock.
- **Impact if no action:** The job keeps its runner time. CI wall time does not change while the job stays off the critical path.
- **Root question:** Should the `mkc-*` database tests start from a schema that is already migrated?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Migrate one template database once for each test process, and give each test a copy of it, for example with `CREATE DATABASE ... TEMPLATE`. `ScratchSchema` and the fixtures that call `migrate` change, and the migration tests of `mkc-db` keep their own migrations. Effort: Medium.
- **Left out:** One shared migrated schema with a rolled-back transaction for each test, because many tests check real concurrent transactions and need committed rows.
- **Wider fix:** B.
- **Previous examples:** None found.
- **Recommendation:** A, while the job stays off the critical path. Choose B when this job sets the CI wall time.
- **Action:** ask the user, because the change is a speed-up of a shared test fixture with no effect on the CI wall time today. The user chose A on 2026-11-26.
