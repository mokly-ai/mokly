# mkc-store-pg

The Postgres implementation of the Mokly Cloud persistence contracts. It
implements `Store` and every query trait of `mkc-store-interface` with Diesel
against the schema that `mkc-db` migrates. Construct it once at a composition
root (`mkc-api`, `mkc-catalogue-server` or a test harness) and pass the
`Arc<dyn Store>` to the services; the services depend on the interface crate,
never on this one.

## Responsibilities

Run the SQL, map private rows to the interface records, and enforce the
transaction isolation and retry policy of the `Store` modes.

## What This Crate Does

`PgStoreFactory::connect` opens a bounded connection pool and returns the
store. `Store::transaction` runs the callback serializable and retries a
serialization or uniqueness failure with exponential backoff and jitter;
`Store::read` runs read-only at READ COMMITTED; `Store::autocommit` runs one
statement without a transaction envelope. A `Decision::Rollback` commits
nothing and is not an error. Queries return `Error::Internal` with the source
kept or the handled `SlugTaken` conflict, and `Option` for a missing row;
authorization lives in the service callback and is rechecked on every
attempt. The doc comments of each module hold the SQL, the lock order and the
index choices.

Slug writes claim the authoritative registry row before they insert or update
the subject: reusing the same subject's historical claim succeeds and another
subject receives `SlugTaken`, and lookups resolve through the registry and
report whether the requested spelling is retired. The GitHub modules persist
installation and repository bindings, one-use OAuth flow hashes, stable
identities, current branch and pull request observations and check
identities, and give the delivery worker atomic claims, expired-lease
recovery and fenced completion. Check recording preserves marked rerequests
and rejects identity conflicts. Both Re-run workers use one parent-first
claim for at most 100 marks of one external-ID prefix. It locks
organizations, then projects, in UUID order before the check rows. Busy
parents and checks stay marked. Effects and mark clears commit in the same
transaction. Provider calls remain outside those transactions.
The billing modules persist customers, exact
Checkout sessions, subscriptions, confirmed seat items and leased seat
commands, the Stripe delivery queue with the same lease boundary, and the one
statement that counts distinct active users by their strongest seat kind.

The publication modules enforce the conditional lifecycle transitions, the
ready-identity uniqueness, exact path-to-hash reads, one-use grants and
incarnation-fenced collection. Blob rows are keyed by project and hash, so
equal bytes in two projects have separate incarnations and durability, and
every reference-releasing query locks the referenced blobs in one canonical
order before its cascade runs. Releasing the files of a ready publication is
refused, so a published catalogue keeps its file list until its project or
workspace is deleted. The outbox queries return due events, optionally scoped
to one project before the batch limit, and fence retries and requeues with a
version. Retention candidates are unfinished attempts past their deadline and
failed attempts past the age cutoff, never ready or expired rows. Retention and
collection candidates are bounded reads whose predicates match partial
indexes. Auth and GitHub cleanup receive explicit cutoffs and row limits and
return bounded delete counts; services own those windows. Each auth cleanup
delete also sets a transaction-local `statement_timeout` from its
`PruneBatch`, so a slow delete or a lock wait fails with `Error::Internal`
instead of running on. GitHub cleanup uses the flow-expiry
index and a terminal-delivery partial index and never deletes pending or
processing deliveries.

Each delivery claims one due event immediately before provider work in a short
transaction. The claim reserves five minutes and advances the retry version.
Success and failure writes require that version. Failure keeps the existing
backoff and permanent budget rules without another version increment. A dead
process's claim becomes due again after five minutes; operator requeue also
fences stale outcomes.

The viewer modules page in SQL with complete ordering keys: one statement per
list returns the branch union or the pull requests with each reference's
newest attempt, newest build, and latest ready publication, history includes
failed and expired rows with their Changes observations except the unfinished
and failed uploads of a build, which the build stands for, and an exact read
excludes expired and foreign records. The newest-attempt probes and the
`listHistory` statement also skip failed `superseded` replay attempts, which
another publication of the same identity stands for. `listPublications` and
exact reads keep them.
The share-selection query compares the SHA-256
digest and the full path of a stored `screen_path`.

Build persistence serializes claims and starts through an organization row
lock, then counts live leases in a fresh statement and skips locked candidates.
This enforces two live builds across that organization's projects at READ
COMMITTED too. Call claim and start or recovery in one transaction; candidate
reads alone do not reserve work after commit. Logs lock their build, allocate
permanent sequences and retain the first 256 KiB plus a rolling tail within one
MiB. Attempt cleanup never resets that counter. Upload consumption locks the
project, build, grant and completion publications in that order. Completion
takes these locks before its first publication write. The project key-share
lock covers the branch alias foreign key; publication locks also cover a ready
identity winner. Consumption then finds those locks already held, so
cancellation and a ready completion have one winner. Claims, renewal and grant consumption use the shared `BuildClock` guard.
They sample it after all required ownership locks and again after transaction
retries. Claims recheck the locked candidate. Renewal requires a stored expiry
strictly later than its fresh reading and extends from that reading.
Consumption checks the grant, lease and deadline against its fresh reading.
Equality is expired; renewal never restores an expired lease.
Ranked outcomes survive concurrent lower-ranked answers. Ending-attempt
cleanup selects unfinished build uploads from the stored start time, pre-locks
all affected blobs in canonical order, releases references and records failed
events in the same build-transition transaction. Supersession pre-locks all
affected publications across its build batch before any blob. Cancellation
and supersession
use the same query as finalization and lease recovery. Events use the UUID v7
reserved by the upload caller before admission; SQL generates no event IDs. Check bumps preserve
a separate five-minute claim; attempts fence both outcomes and success
acknowledges only the claimed state version. Terminal pruning deletes failed
uploads under the canonical blob lock order and cascades build children.
It locks grants and every linked publication before blobs, including retained
ready and expired rows. It selects a bounded candidate batch first and locks
their projects in UUID order before the builds and supersession links.
This also serializes pruning and parent deletion. Parent deletion locks its
organization when needed,
all projects, builds, grants and publications before its blob pre-locks.

Publication metadata reads and writes use `base_sha` to identify comparisons.
The private row keeps the unused `comparison_path` column for deploy rollback.
New rows leave it null, and metadata updates do not write it.

The Postgres integration module under `src/_tests_/build_pg` uses the actual
private query implementation with two overlapping READ COMMITTED connections.
It checks blocked writes with `pg_blocking_pids` before releasing the first
transaction. Each test owns one `mkc-test-pg` schema. The publications worker
and webhook scheduling now use these queries. PR mappings retain nullable
head and base repository IDs for the fork rule.
Viewer PR reads return these
IDs and the bound repository's GitHub ID in the existing SQL statement.
The API applies the shared domain rule; this adapter adds no eligibility policy.

## Quick Start

```rust
use std::sync::Arc;

use mkc_store_interface::error::Result;
use mkc_store_interface::store::Store;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;

/// Connect the Postgres store once and share it as `Arc<dyn Store>`.
fn connect(database_url: &str) -> Result<Arc<dyn Store>> {
    PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    }
    .connect(database_url)
}
```

Migrate before you connect: `mkc-api` and `mkc-catalogue-server` run the
`DieselMigrations` runner of `mkc-db` first.

## Development

```sh
cargo test -p mkc-store-pg
cargo clippy -p mkc-store-pg --all-targets -- -D warnings
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  cargo test -p mkc-store-pg --test maintenance -- --nocapture
```

The integration tests need Postgres 16 and `psql`, read
`MKC_TEST_DATABASE_URL` (default
`postgres://postgres:postgres@localhost/mkc_test`) and run each test in its
own `mkc-test-pg` scratch schema, so a test never reads another test's rows.
An unreachable database fails when `MKC_TEST_DATABASE_URL` or `CI` is set;
only an unconfigured developer machine skips, with a printed reason.
Developers with Docker can start the root Compose file. Add a query to the
module that owns its table, and keep it query-only: policy, hashing, clocks
and provider calls stay in the service.

### Key Code

- [connection.rs](./src/connection.rs) — `PgStoreFactory` and the pool of eight connections with a five-second acquisition wait; it implements the transaction, read and autocommit modes of `Store`.
- [transaction.rs](./src/transaction.rs) — one attempt: serializable for writes, READ COMMITTED read-only for reads; a `Decision::Rollback` is not an error, and a query error rolls back with its source kept.
- [retry.rs](./src/retry.rs) — `Backoff`, eight attempts on serialization and uniqueness failures with base delays 5, 10, 20, 40, 80, 160 and 250 ms plus uniform jitter up to the delay.
- [runtime.rs](./src/runtime.rs) — `Runtime`, the injected sleep and jitter the retry policy uses, and the native `SystemRuntime`.
- [queries.rs](./src/queries.rs) — `PgQueries`, the borrowed transaction connection that implements `Queries` and never outlives its transaction.
- [user.rs](./src/user.rs), [magic_link.rs](./src/magic_link.rs) and [rate_limit.rs](./src/rate_limit.rs) — the account, one-use link and admission-window queries that `mkc-auth` calls.
- [desktop_grant.rs](./src/desktop_grant.rs) — desktop grant insertion, `SELECT FOR UPDATE` for service-owned challenge checks, conditional unused and unexpired consumption, and expiry-based pruning.
- [desktop_grant_tests.rs](./tests/desktop_grant_tests.rs) — Postgres concurrency, expiry, inherited deadline, replay and inclusive retention checks in isolated schemas.
- [session.rs](./src/session.rs) — session rows and `touch`, one conditional UPDATE whose predicate rechecks staleness, run through `Store::autocommit`.
- [auth_prune.rs](./src/auth_prune.rs), [magic_link_retention.sql](./src/magic_link_retention.sql), [desktop_grant_retention.sql](./src/desktop_grant_retention.sql), [session_retention.sql](./src/session_retention.sql) and [rate_limit_retention.sql](./src/rate_limit_retention.sql) — `configure_batch`, which sets the transaction-local `statement_timeout` of a `PruneBatch` and caps its row limit at 1,000, and the bounded authentication deletes that each remove at most that many eligible rows.
- [organization.rs](./src/organization.rs) — organization rows and `claim_slug`, which claims the registry row before the write; a claim is current when it equals the stored slug, so no current flag exists. `seat_counts` is the one statement that counts distinct active users by their strongest role.
- [project.rs](./src/project.rs), [member.rs](./src/member.rs), [grant.rs](./src/grant.rs) and [token.rs](./src/token.rs) — the project rows with their slug claims, the membership, direct-grant and publishing-token queries.
- [integration.rs](./src/integration.rs) — reads and writes the one GitHub integration row per user or organization; the migration defines the generated parent columns and the cascade.
- [github_installation.rs](./src/github_installation.rs), [github_repository.rs](./src/github_repository.rs), [github_refs.rs](./src/github_refs.rs), [github_check.rs](./src/github_check.rs), [github_identity.rs](./src/github_identity.rs) and [github_delivery.rs](./src/github_delivery.rs) — the installation and repository bindings, branch and pull request observations, check identities, hashed OAuth flows and the leased delivery queue; [github_rows/](./src/github_rows/) holds their row mappings.
- [billing_customer.rs](./src/billing_customer.rs), [billing_checkout.rs](./src/billing_checkout.rs), [billing_subscription.rs](./src/billing_subscription.rs), [billing_seat_command.rs](./src/billing_seat_command.rs) and [billing_delivery.rs](./src/billing_delivery.rs) — customer upserts, Checkout reservation and completion, subscription and seat-item upserts, leased seat commands and the Stripe delivery queue with lease fencing; [billing_rows/](./src/billing_rows/) holds their row mappings.
- [publication.rs](./src/publication.rs), [retention_candidates.sql](./src/retention_candidates.sql) and [garbage_candidates.sql](./src/garbage_candidates.sql) — the conditional lifecycle transitions; `expire_publication`, the historical transition that also deletes the publication's grants and screen selections and that no scheduled cleanup calls; `delete_failed_publication`; and the bounded reads of unfinished and failed attempts and collectible blobs, whose predicates match their partial indexes.
- [github_retention.rs](./src/github_retention.rs), [github_oauth_retention.sql](./src/github_oauth_retention.sql) and [github_delivery_retention.sql](./src/github_delivery_retention.sql) — the bounded `GitHubRetention` deletes of expired OAuth flows and terminal webhook deliveries.
- [publication_event.rs](./src/publication_event.rs) and [pending_publication_events.sql](./src/sql/pending_publication_events.sql) — the check-delivery outbox: due events with the optional project scope, version-fenced retries and requeues, the dead-letter count and the one-use grant queries.
- [blob.rs](./src/blob.rs) — blob reservation, the project-scoped and exact lookups, the durability marker confirmation that keeps its first timestamp, and the fenced collection queries.
- [blob_locks.rs](./src/blob_locks.rs) — the canonical pre-lock queries: publication release, failed build upload pruning, and project and organization deletion lock every referenced blob in ascending project and hash order before their cascades run.
- [build queries](./src/build/mod.rs), [log queries](./src/build_log/mod.rs) and [build_check.rs](./src/build_check.rs) — the build scheduling, claim, start, lease, supersession and outcome statements, the log appends with their locked per-build sequence allocator, and the build check state bumps, live claims and retry-fenced delivery outcomes.
- [build schema tests](./src/_tests_/build_pg/schema_tests.rs) — check lifecycle constraints and undo dependent failure-cause migrations before checking the original build defaults.
- [publication_screens.rs](./src/publication_screens.rs) — bulk insert of the validated screen/view selections and the indexed existence query that sharing uses, which compares `sha256(convert_to(screen_path, 'UTF8'))` with the trigger-filled `screen_hash` and the full path.
- [viewer/branches.rs](./src/viewer/branches.rs) and [branches.sql](./src/viewer/branches.sql) — the `listBranches` union of the bound repository's `github_branches` observations with the project's publication branches, default first then bytewise name, with each branch's newest attempt and latest ready publication in the same statement.
- [viewer/pull_requests.rs](./src/viewer/pull_requests.rs) and [pull_requests.sql](./src/viewer/pull_requests.sql) — the `listPullRequests` rows from the bound repository's `github_pull_requests`, open first then newest observation, with the same newest-attempt and latest-ready columns.
- [viewer/newest_publication.rs](./src/viewer/newest_publication.rs) — the nullable newest-attempt columns that both reference lists fill through one lateral one-row probe per reference; [viewer/newest_build.rs](./src/viewer/newest_build.rs) holds the matching newest-build columns.
- [viewer/publications.rs](./src/viewer/publications.rs) and [publication.sql](./src/viewer/publication.sql) — history pages and exact publication reads through one optional-ID statement that joins the admitted PR number to its `github_pull_requests` observation; an exact ID excludes expired rows.

### Related Docs

- [Persistence boundaries](../../docs/protocol/cloud/persistence-boundaries.md)
- [Cloud builds](../../docs/protocol/cloud/cloud-builds.md)
- [Platform model](../../docs/protocol/cloud/platform-model.md)
- [Authentication](../../docs/protocol/cloud/auth-sessions.md)
- [GitHub App](../../docs/protocol/cloud/github-app.md)
- [Changes check](../../docs/protocol/cloud/changes-check.md)
- [Retention](../../docs/protocol/cloud/retention.md)
- [Viewer read model](../../docs/protocol/cloud/viewer-read-model.md)
- [Billing workers](../../docs/protocol/cloud/billing-workers.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
