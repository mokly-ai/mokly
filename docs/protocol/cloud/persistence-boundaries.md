# Persistence Boundaries

Each table has one query owner and one behavior owner. The query owner holds
the SQL and the row mappings; the behavior owner decides what a row means.
The [architecture doc](../../architecture/cloud.md) describes the store, service and
interface crates and the direction of their dependencies.

Absence is a service decision at each lookup: an unknown magic link is an
invalid link, a missing session or user is unauthenticated, and an
inaccessible platform resource is not found. A policy rejection rolls back
the transaction and is not a store failure. An internal query failure keeps
its source chain in diagnostics and can be retried. Only the API maps
authentication, platform and store outcomes to HTTP.

The database keeps the persistence name `organization` for the workspace: the
`organizations` and `organization_slugs` tables and every `organization_id`
column hold workspaces, and only the API and the product say workspace.
Renaming the tables was rejected because merged migrations are immutable, so
it would take a new migration over every table that names the workspace for a
name no user reads.

## Table Ownership

| Table                       | Query owner  | Behavior owner                                 |
| --------------------------- | ------------ | ---------------------------------------------- |
| users                       | mkc-store-pg | mkc-auth, account service in mkc-api           |
| organizations               | mkc-store-pg | platform service in mkc-api                    |
| organization_slugs          | mkc-store-pg | platform service in mkc-api                    |
| memberships                 | mkc-store-pg | platform service in mkc-api                    |
| projects                    | mkc-store-pg | platform service in mkc-api                    |
| project_slugs               | mkc-store-pg | platform service in mkc-api                    |
| project_grants              | mkc-store-pg | platform service in mkc-api                    |
| project_tokens              | mkc-store-pg | platform service in mkc-api                    |
| magic_links                 | mkc-store-pg | mkc-auth                                       |
| sessions                    | mkc-store-pg | mkc-auth                                       |
| integrations                | mkc-store-pg | GitHub integration service in mkc-api          |
| auth_rate_limits            | mkc-store-pg | mkc-auth                                       |
| github_installations        | mkc-store-pg | GitHub integration service in mkc-api          |
| github_repositories         | mkc-store-pg | GitHub integration service in mkc-api          |
| github_project_repositories | mkc-store-pg | GitHub integration service in mkc-api          |
| github_user_identities      | mkc-store-pg | GitHub integration service in mkc-api          |
| github_oauth_flows          | mkc-store-pg | GitHub integration service in mkc-api          |
| github_webhook_deliveries   | mkc-store-pg | GitHub delivery worker in mkc-api              |
| github_pull_requests        | mkc-store-pg | GitHub delivery worker in mkc-api              |
| github_branches             | mkc-store-pg | GitHub delivery worker in mkc-api              |
| github_check_runs           | mkc-store-pg | shared, see below                              |
| billing_customers           | mkc-store-pg | billing service in mkc-billing                 |
| billing_checkout_sessions   | mkc-store-pg | billing service in mkc-api                     |
| billing_subscriptions       | mkc-store-pg | billing service in mkc-billing                 |
| billing_subscription_items  | mkc-store-pg | billing service in mkc-billing                 |
| billing_seat_commands       | mkc-store-pg | seat worker in mkc-billing                     |
| billing_deliveries          | mkc-store-pg | billing worker in mkc-billing                  |
| publications                | mkc-store-pg | mkc-publications                               |
| publication_files           | mkc-store-pg | mkc-publications                               |
| blobs                       | mkc-store-pg | mkc-publications                               |
| publication_events          | mkc-store-pg | mkc-publications                               |
| publication_branch_aliases  | mkc-store-pg | mkc-publications                               |
| catalogue_grants            | mkc-store-pg | mkc-publications                               |
| publication_screen_views    | mkc-store-pg | mkc-publications                               |
| builds                      | mkc-store-pg | build scheduler and worker in mkc-publications |
| build_upload_grants         | mkc-store-pg | build worker and ingest in mkc-publications    |
| build_log_chunks            | mkc-store-pg | build scheduler and worker in mkc-publications |
| build_checks                | mkc-store-pg | build scheduler and worker in mkc-publications |

The generated Diesel schema in `mkc-db` is the column reference for every
table; its [README](../../../crates/mkc-db/README.md) names it.

Cloud build tables use the same query owner and follow [Cloud builds](./cloud-builds.md). The build scheduler and
worker in `mkc-publications` own `builds`, `build_log_chunks` and
`build_checks`; ingest records a build's publication and consumes its
`build_upload_grants` row, which the worker mints. `projects.automatic_builds`
belongs to the platform service. Ingest owns `publications.build_id` and
`build_failure_event_id`; it reserves the cleanup UUID v7 before admission.
Attempt endings reuse that stored ID for the failed event. The
scheduler, worker and check outbox run in every configured API replica.
Ingest checks the stored grant and build on each request and transaction;
consumption sets the build's publication in the ready transaction. Build claim transactions lock
a workspace before counting its live leases and locking one candidate.
The caller must start, reject or recover it in that transaction. Log appends lock
the build and allocate sequences from a counter that retries never reset.
Build check bumps preserve the independent five-minute delivery claim;
claimed attempts fence success and failure, including after a state bump.

PR observations retain nullable head and base repository IDs, so query-only
scheduling and re-run can apply the fork rule without a provider request.
`github_check_runs` is shared: GitHub handlers mark rerequest intent, and the
publication and build check workers in `mkc-publications` own the output of
their rows and clear that intent.
Check identity recording upserts by external ID without clearing rerequest
intent. Publication rerequest consumption locks a bounded owner-prefix batch
and inserts the fresh event in the same transaction that clears its mark.
Due publication-event reads grant no ownership. Immediately before delivery,
a conditional per-row claim advances the retry version and reserves five
minutes through `next_attempt_at`. It returns the current permanent budget.
Success and failure queries require that claimed version; failure does not
advance it again. Requeue advances it to reject both kinds of stale outcome.
Provider requests never run inside these transactions.

OAuth state, verifier and session values are stored as hashes; provider
tokens are never stored. The GitHub delivery row is the durable queue;
[GitHub App](./github-app.md) defines claims, retry deadlines and
reconciliation.

Billing rows live as long as their workspace. Billing delivery rows have no
age-based retention and need their own retention decision.
`organizations.plan` holds one of the catalogue's plan values and is written
only by the billing webhook worker; see [Billing](./billing.md).

Deleting a workspace or a project cascades to its subordinate records,
including every current and retired slug claim. Slug claims follow
[Platform model](./platform-model.md#slugs); their constraints serialize
concurrent create, rename and suggestion races, and service policy maps a
losing write to the typed slug outcome. A user email, a workspace member
email, a project repository and config identity, and a project and user grant
pair are each unique. A consumed magic link keeps its digest and its
consumption time, so a replay is told apart from an unknown credential. Only
hashes of link, session and token credentials are stored. The CSRF token is
stored for exact session binding. No email body or raw magic link is
persisted.

Project and workspace deletion succeed with published builds, whether the
linked publications are ready or expired. Deletion removes the builds and
publications with their parent. Postgres regression tests cover both parent
types and both publication states.

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
- Sessions whose absolute expiry or seven-day idle expiry is at or before
  `now - MKC_AUTH_SESSION_RETENTION_SECONDS` (default 86400, one day).
- Counters with `resets_at <= now - MKC_AUTH_RATE_RETENTION_SECONDS`
  (default 86400, one day), including email, GitHub and preview sign-in
  admission keys.
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

## Publication Storage

[Publication storage](./persistence-publication-storage.md) defines the
transaction boundary of publications and blobs, the build and publication lock
order, the canonical blob lock order and the object prefixes.
