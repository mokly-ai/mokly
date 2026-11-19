# mkc-store-interface

The typed transactional persistence contracts of Mokly Cloud. The services
(`mkc-auth`, `mkc-publications`, `mkc-billing` and the platform, GitHub and
viewer services in `mkc-api`) run their queries through the `Store` trait and
the query traits defined here, and `mkc-store-pg` implements them for
Postgres. Depend on it from a service or from a database implementation; a
service never depends on the Postgres crate.

## Responsibilities

Own the `Store` transaction boundary, the query traits, the persisted records
and the store error contract.

## What This Crate Does

`Store` runs a `Transaction` callback in one of three modes: `transaction`,
serializable and retried after a serialization or uniqueness conflict; `read`,
read-only at READ COMMITTED; and `autocommit`, one atomic statement without a
transaction envelope, rollback or retry. The callback receives `dyn Queries`,
the union of every query trait, and returns `Decision::Commit` or
`Decision::Rollback`; a rollback lets a service reject work without adding its
policy errors to the store contract. Because a callback may run again,
generate identifiers, credentials and ordinary event timestamps before it and
deliver email after the commit. Build ownership queries are the exception:
they read the live `BuildClock` guard after their locks, on each attempt.
`Callback` adapts a closure that always commits.

Queries return `Error::Internal` with the source chain kept, plus the one
handled write conflict `SlugTaken`; an absent row is `Ok(None)` and a list may
be empty. Services decide what absence means at each call site: `mkc-auth`
owns the authentication outcomes, `mkc-api` the authorization and lifecycle
outcomes and `mkc-publications` the ingest and retention outcomes.
Secret-bearing records have no serialization derives, and every query trait
has a unimock API for service unit tests.

The platform traits (`Users`, `Organizations`, `Members`, `Projects`,
`Grants`, `Tokens`) carry typed current slugs and resolve current or
historical slug claims, reporting whether the requested spelling is retired;
claim-existence reads support suggestions without exposing the owner, and the
platform still authorizes every resolved UUID. `Organizations::seat_counts`
counts distinct billable users by their strongest role. The authentication
traits (`MagicLinks`, `DesktopGrants`, `Sessions`, `RateLimits`) hold the one-use link and desktop grant digests,
the sessions and the admission windows; `Sessions::touch` is the activity
update that runs through `Store::autocommit`.

The GitHub traits own installation and repository bindings, one-use OAuth
flow hashes, stable user identities, current branch and pull request
observations, check identities and the durable webhook delivery queue with
its atomic claims, lease recovery and fenced completion. Check recording
preserves marked rerequests and rejects identity conflicts. Both Re-run
workers use one parent-first claim for at most 100 marks of one external-ID
prefix. It locks organizations, then projects, in UUID order before the check
rows. Busy parents and checks stay marked. Effects and mark clears commit in
the same transaction. Provider calls remain outside those transactions.
`github_installation::InstallationState` distinguishes a connected binding,
provider suspension and absence; a local disconnect is always absent.
`Integrations` reads the persisted provider account of a user or an
organization.

The publication traits (`Publications`, `Blobs`, `PublicationEvents`,
`PublicationScreens`) hold immutable publication metadata, project-scoped
blob rows with their durability marker, the path references that drive the
transactional reference counts, the check-delivery outbox with its retry
versions and dead letters, one-use catalogue grants and the validated
screen/view selections that sharing checks. `publication_changes` holds the
immutable Changes observation that `Publications::ready_publication` commits.
The accepted index supplies these counts. `PublicationMetadata.base_sha`
identifies a comparison. The stored index retains its comparison generation
root. The catalogue index itself uses the
fixed publication-file path `mokly-viewer/index.json`.
`fail_build_uploads` closes an ending attempt from its stored start time,
releases references and records failed events in the build transaction.
A build-linked `Publication` carries a unique `build_failure_event_id`,
reserved by its admission caller before the transaction. Cleanup uses this
UUID v7 rather than generating IDs in SQL.

Each delivery claims one due event immediately before provider work in a short
transaction. The claim reserves five minutes and advances the retry version.
Success and failure writes require that version. Failure keeps the existing
backoff and permanent budget rules without another version increment. A dead
process's claim becomes due again after five minutes; operator requeue also
fences stale outcomes.

`ViewerReads` defines the project-scoped branch union, pull request,
publication history and exact publication reads with typed compound cursor
keys; every viewer read requires caller authorization and returns `None` for
a missing, expired or foreign record.
`ViewerPullRequest.repositories` retains the bound, head and base GitHub IDs
in the domain's `PullRequestRepositories` value. The API uses its shared fork
rule. This fact is independent of build visibility, role and plan.

The billing traits persist one customer, one current Checkout session and one
subscription per organization, the confirmed seat items and leased seat
commands, and the Stripe delivery queue; typed state values reject corrupt
persisted rows. The maintenance queries take explicit cutoffs and return
counts without owning the retention policy.

Those cutoffs cover magic links, sessions, rate-limit counters, GitHub OAuth
flows, terminal webhook deliveries, publication candidates, expired catalogue
grants and collectible blobs. Publication candidates are unfinished attempts
past their deadline and failed attempts past the age cutoff; ready and expired
publications are never candidates. `PublicationEvents::dead_letter_count`
counts only undelivered dead letters; operator recovery reuses that same store
boundary without touching a provider.
Build queries persist scheduling, reference supersession, attempt leases,
upload grants, bounded logs, mixed history and the check outbox. Query errors
remain `Internal`; services decide eligibility, retry delays and runner
outcomes. `BuildFailure` contains the failure causes of the 0.18.0 runner.
Unrecognized CLI codes use `Exit`.
`Builds::claim_build` locks an organization and one due or expired
candidate. Start, reject or recover it before the same transaction commits.
`Builds::claim_build`, `Builds::renew_build` and grant consumption take the
same `dyn BuildClock` guard. They sample it after their ownership locks and
after each transaction retry. A claim rechecks its locked candidate. Renewal
extends from that reading only while the stored expiry is strictly later.
Attempt starts take fresh times under the claim locks. An expired owner cannot
restore a lease after another start fills the organization's capacity.
Every attempt write uses its lease; log writes use its operation ID and a
permanent sequence counter. State changes bump checks without ending an active
delivery claim. `BuildReads::build_history` pages both kinds in one statement;
its caller supplies member access. Ready and expired publications keep history
when terminal build pruning clears their nullable build link.
`Builds::build_by_id` is a trusted outbox read; HTTP callers use the scoped
`build` operation. PR observations retain nullable head/base repository IDs
for query-only fork eligibility. Ingest resolves grants by digest and consumes
them with their ready publication in one transaction. Completion calls
`BuildUploadGrants::lock_build_grant` before authorization or publication writes.
The query locks the project, build, grant and completion publications in the
[persistence order](../../docs/protocol/cloud/persistence-publication-storage.md#build-and-publication-lock-order).
Consumption keeps those locks through the ready commit. Outcome writes preserve
the documented ranking across concurrent requests.

## Quick Start

```rust
use mkc_domain::ids::UserId;
use mkc_store_interface::error::Result;
use mkc_store_interface::store::{Callback, Store};
use mkc_store_interface::user::User;

/// Read one user in a read-only transaction; an absent row is `None`, not an error.
fn load_user(store: &dyn Store, id: UserId) -> Result<Option<User>> {
    let mut user = None;
    store.read(&mut Callback(&mut |queries| {
        user = queries.user(id)?;
        Ok(())
    }))?;
    Ok(user)
}

/// Write in a serializable transaction; the store retries the callback after a conflict.
fn rename_user(store: &dyn Store, user: &User) -> Result<()> {
    store.transaction(&mut Callback(&mut |queries| queries.save_user(user)))
}
```

## Development

```sh
cargo test -p mkc-store-interface
cargo clippy -p mkc-store-interface --all-targets -- -D warnings
```

An insert with a domain uniqueness constraint pre-checks that constraint
inside the callback, so a retry after a uniqueness race observes the winner
and returns the typed policy outcome instead of a store error. A callback
that needs `Decision::Rollback` implements `Transaction` directly; `Callback`
always commits. Add a query to the trait of the table it reads, and keep the
trait query-only: policy, hashing, clocks and provider calls stay in the
service.

### Key Code

- [desktop_grant.rs](./src/desktop_grant.rs) — `DesktopGrant` and `DesktopGrants`, the create, locking read, conditional consumption and pruning boundary for desktop sign-in; the auth service checks the challenge while the row stays locked.

- [store.rs](./src/store.rs) — `Store`, the three execution modes: `transaction` (serializable, retried up to eight attempts), `read` (READ COMMITTED, read-only) and `autocommit` (one statement, no retry); `Queries`, the union of every query trait a callback receives; `Decision::Rollback`, the policy rejection that commits nothing without a store error.
- [error.rs](./src/error.rs) — `Error::Internal`, which keeps the source chain of a database, pool or decoding failure, and `SlugTaken`, the one handled write conflict.
- [user.rs](./src/user.rs), [magic_link.rs](./src/magic_link.rs) and [rate_limit.rs](./src/rate_limit.rs) — `Users`, `MagicLinks` and `RateLimits`, the account, one-use link and admission-window records that `mkc-auth` owns.
- [session.rs](./src/session.rs) — the `Sessions` queries, including `touch`, the conditional activity update that runs through `Store::autocommit`.
- [organization.rs](./src/organization.rs) — `Organizations` with `OrganizationLookup`, the slug-resolved read that reports a retired spelling, and `seat_counts`, the per-kind count of distinct billable users that the billing read and the seat worker share.
- [project.rs](./src/project.rs), [member.rs](./src/member.rs), [grant.rs](./src/grant.rs) and [token.rs](./src/token.rs) — `Projects` with `ProjectLookup`, `Members`, `Grants` and `Tokens`, the project, membership, direct-grant and publishing-token records that the platform service in `mkc-api` owns.
- [integration.rs](./src/integration.rs) and [github_installation.rs](./src/github_installation.rs) — `Integrations`, the persisted provider account of a user or organization, and `GitHubInstallations` with `InstallationState`.
- [github_repository.rs](./src/github_repository.rs), [github_refs.rs](./src/github_refs.rs), [github_check.rs](./src/github_check.rs), [github_identity.rs](./src/github_identity.rs) and [github_delivery.rs](./src/github_delivery.rs) — `GitHubRepositories`, `GitHubRefs`, `GitHubChecks`, `GitHubIdentities` and `GitHubDeliveries`: the repository bindings, branch and pull request observations, check identities, OAuth flows and the leased webhook delivery queue; [github_state.rs](./src/github_state.rs) holds their finite persisted states.
- [blob.rs](./src/blob.rs) — `Blob`, `PublicationFile` and the `Blobs` queries: the project-scoped `blob` lookup, the exact `blob_by_key` lookup by hash and incarnation, the idempotent incarnation-fenced `mark_blob_stored` confirmation and the `pending_publication_blobs` read of non-durable hashes.
- [publication.rs](./src/publication.rs) — `Publications`, the lifecycle queries including `ready_publication`, `delete_failed_publication`, the bounded `publication_candidates` read of unfinished and failed attempts, and `expire_publication`, the historical `ready` to `expired` transition that no scheduled cleanup calls; `Publication` and `PublicationState`; and `PublicationFailure`, whose `delivers_failure_check` names the failure kinds that post a failing Changes check.
- [github_retention.rs](./src/github_retention.rs) — `GitHubRetention`, the bounded deletes of expired OAuth flows and terminal webhook deliveries, each taking an explicit cutoff and limit and returning its delete count.
- [publication_event.rs](./src/publication_event.rs) and [publication_changes.rs](./src/publication_changes.rs) — `PublicationEvents`, the check-delivery outbox with `dead_letter_count` and the one-use `CatalogueGrant` queries, and `Changes`, the immutable counts or no-comparison observation.
- [publication_screens.rs](./src/publication_screens.rs) — `PublicationScreens`, `ScreenView`, whose `screen_path` is a validated `EntryPath`, and `Selection`, whose `screen_path` is a raw string the caller validates first: the stored share selections and the exact membership check.
- [viewer.rs](./src/viewer.rs) — `ViewerReads` and its `ViewerBranch`, `ViewerPullRequest`, `ViewerPublication`, `PublicationSummary` and `PublicationPullRequest` rows, with the `BranchKey`, `PullRequestKey` and `PublicationKey` cursor keys and `HistoryFilter`.
- [build.rs](./src/build.rs), [build_log.rs](./src/build_log.rs) and [build_check.rs](./src/build_check.rs) — `Builds`, `BuildLogs` and `BuildChecks`: the build scheduling, lease and outcome queries, the bounded log chunks and the versioned build check outbox; [build_history.rs](./src/build_history.rs) and [build_grant.rs](./src/build_grant.rs) hold `BuildReads` and `BuildUploadGrants`.
- [billing_subscription.rs](./src/billing_subscription.rs) — `BillingSubscriptions`, `BillingSubscription` and `BillingSubscriptionItem`, the subscription and seat-item rows with their separate lifecycle and payment clocks.
- [billing_delivery.rs](./src/billing_delivery.rs) — `BillingDeliveries` and `BillingDelivery`, the Stripe webhook queue with its leases and retry state.
- [billing_customer.rs](./src/billing_customer.rs), [billing_checkout.rs](./src/billing_checkout.rs), [billing_seat_command.rs](./src/billing_seat_command.rs) and [billing_state.rs](./src/billing_state.rs) — `BillingCustomers`, `BillingCheckoutSessions`, `BillingSeatCommands` and the finite subscription and failure states.

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
