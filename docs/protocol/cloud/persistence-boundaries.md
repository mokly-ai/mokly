# Persistence Boundaries

Each table has one query owner and one behavior owner. The query owner holds
the SQL and the row mappings; the behavior owner decides what a row means.
The [architecture doc](../../architecture/cloud.md) describes the store, service and
interface crates and the direction of their dependencies.
[Transactions, migrations and retention](./persistence-transactions.md)
defines atomic work, the migration lifecycle and the retention of
authentication and GitHub records.

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
| desktop_grants              | mkc-store-pg | mkc-auth                                       |
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
hashes of link, desktop grant, session and token credentials are stored. The
CSRF token is stored for exact session binding. No email body or raw magic
link is persisted.

Project and workspace deletion succeed with published builds, whether the
linked publications are ready or expired. Deletion removes the builds and
publications with their parent. Postgres regression tests cover both parent
types and both publication states.

## Publication Storage

[Publication storage](./persistence-publication-storage.md) defines the
transaction boundary of publications and blobs, the build and publication lock
order, the canonical blob lock order and the object prefixes.
