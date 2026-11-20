# Persistence Transactions, Migrations And Retention

This sub-contract of [Persistence boundaries](./persistence-boundaries.md)
defines atomic work, the migration lifecycle and the retention of
authentication and GitHub records. The parent defines table ownership, and
[publication storage](./persistence-publication-storage.md) the publication
transaction boundary, the lock orders and the object prefixes.

## Atomic Work

A write that must be atomic runs as one serializable transaction. The callback
holds queries and typed policy decisions only: it sends no mail, starts no
task and performs no external call, and it may run more than once.
Identifiers, secrets and ordinary event times are generated before the
callback, and mail is sent only after commit. A serialization or uniqueness conflict retries the
whole transaction, at most eight times, so the policy checks observe the
committed duplicate and return the documented domain error. A policy rollback
does not retry. Exhausted conflicts are internal failures and return 500
`internal-error` with the source chain in diagnostics.

Build lease ownership uses the shared injected clock guard instead of a
captured event time. Claims, renewal and upload-grant consumption read it
after all required locks, on every transaction attempt. Claims recheck their
candidate under the workspace and build locks. Renewal locks its build
before it checks expiry and derives the new expiry. Grant consumption locks
its project, build, grant and completion publications before it checks the
grant expiry, attempt deadline and lease expiry. Equality means expired.
Attempt starts take fresh time under the claim locks. IDs and secrets remain
stable across retries. See [Cloud builds](./cloud-builds.md#claims-leases-and-retries).

An effect that needs rows only the transaction can read, such as the
invitation email that names its workspace and inviter, is recorded as data
inside the callback and executed by the service after the transaction
returns: once per committed attempt and never for a rolled-back one.

Permission reads and writes share the transaction. This protects last-owner
checks, parent scoping, stale-version checks, invitation acceptance, link
consumption and session issue, rotation and rate-limit admission under
concurrency. Authentication reads are read-only. A stale session activity
touch is one independently atomic statement outside a transaction.

## Migration Lifecycle

There are no seed migrations. A merged migration and its lock entry are
immutable: a schema change is a new forward migration with a new lock entry,
and the `cloud-migrations` suite verifies the hashes and the history under
[Repository Rust workspace](./repository-rust-workspace.md). Concurrent API
starts apply pending migrations once, without a race.
Tests create data through services and query fixtures; no production seeds or
fake user-facing values exist.

## Authentication Retention

`mkc-api prune` needs only the database URL and retention configuration. It
captures one time, then deletes in one serializable query-only transaction:

- Magic links with `expires_at <= now - MKC_AUTH_LINK_RETENTION_SECONDS`
  (default 604800, seven days), including consumed-link digests.
- Desktop grants with the same expiry cutoff as magic links, including used
  grants, as [Desktop grants](./auth-sessions.md#desktop-grants) requires.
- Sessions whose absolute expiry or seven-day idle expiry is at or before
  `now - MKC_AUTH_SESSION_RETENTION_SECONDS` (default 86400, one day).
- Counters with `resets_at <= now - MKC_AUTH_RATE_RETENTION_SECONDS`
  (default 86400, one day), including email, GitHub, preview sign-in and
  desktop grant admission keys.
- In a second transaction, at most 1,000 finished cloud builds with
  `finished_at <= now - MKC_BUILD_RETENTION_SECONDS` (default 2592000, thirty
  days), oldest first, cascading their grants, log chunks and check outboxes,
  with the failed publication attempts that name them.

Each setting is an integer 0–31536000 seconds; zero removes records at their
expiry boundary. Invalid settings fail before touching the database. Active
credentials and windows are never deleted. A pruned credential receives the
same response as an unknown one. The command reports row counts, exits
nonzero on failure and is safe to retry. The Helm CronJob runs hourly with
overlap forbidden and a ten-minute deadline. No mail, GitHub or blob
credentials are loaded. See [maintenance](../../ops/maintenance.md).

`mkc-api prune-github` independently removes GitHub records in bounded batches:

- OAuth state/verifier hashes whose `expires_at` is at or before one day ago.
- Raw webhook deliveries received at or before 30 days ago only when their
  state is terminal (`done`, `ignored` or `failed`).

Pending and processing deliveries are never eligible, regardless of age. Each
window is configurable from zero through one year; invalid values fail before
database access. The command captures one time, commits each bounded batch,
reports both counts, exits nonzero on failure and is safe to retry. Its daily
Helm CronJob runs in every environment and needs only Postgres. It loads no
GitHub App, OAuth or webhook credential. Delivery records can contain user-authored
content and remain access-restricted until deletion. See
[maintenance](../../ops/maintenance.md).
