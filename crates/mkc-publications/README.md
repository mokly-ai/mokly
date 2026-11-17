# mkc-publications

Publication ingest, catalogue access, cloud build scheduling and attempts,
Changes check delivery and content maintenance for Mokly Cloud. The crate is
the behavior owner of publications, publication files, blobs, events, branch
aliases, catalogue grants and builds; it depends on the store, file-store,
GitHub, build, sandbox and contract interfaces and on `mkc-domain`, never on
an adapter. Construct its services at a composition
root (`mkc-api` or `mkc-catalogue-server`) and consume them through their
trait objects.

## Responsibilities

Run the upload exchange (plan, blob and completion), publish immutable
catalogues, issue private access, deliver Changes checks and reclaim abandoned
or unreferenced content, schedule cloud builds and run durable build attempts.

## What This Crate Does

`Ingest` serves the three requests of the
[upload exchange](../../docs/protocol/cloud/publication-upload-exchange.md).
`authorize` checks the bearer before any body is read; a private project on
the Free plan is refused there, at reservation and again before the ready
commit. `preflight` validates the plan archive through `mkc-mokly-contract`,
reserves a reference for every path the ownership marker declares, stores the
envelope, marker and catalogue index, and returns a `Plan` with the attempt's
deadline and the ascending hashes this project still lacks. Project-token
uploads have sixty minutes; build-token uploads also respect their grant's
earlier expiry.

An authorized rejected envelope retains its head and base identity before the
attempt fails. Its failure check can then name the head. Metadata uses
`base_sha` to identify a comparison. The stored index owns its generation.

`blob_target` resolves one blob request's reservation before its body is read,
and `store_blob` stores bytes only when the server-computed digest and length
match it. `complete` resolves ready, superseded and expired attempts before
checking durability, then loads the stored catalogue index before it commits
ready after reauthorizing; the ready commit
atomically retains the Changes totals or an explicit no-comparison observation
plus the validated screen and view selections for sharing. A missing index
reference or object fails only if the ready transaction still chooses to
publish. A failed read or invalid index fails immediately.
The first upload of
`(project, head SHA, config path)` to complete wins and later completions of
that identity return it. Blob reservations are per project: equal bytes in
another project get their own copy.
Build completion locks its project, build through its grant, grant and
completion publications before authorization and any publication write.
This includes the ready winner that a replay can attach. Consumption reuses
those locks through commit, under the
[persistence lock order](../../docs/protocol/cloud/persistence-boundaries.md#build-and-publication-lock-order).
[Publication ingest](../../docs/protocol/cloud/publication-ingest.md) and
[blob durability](../../docs/protocol/cloud/publication-blob-durability.md) hold the
requirements.

`BlobWriter` is the durability boundary. `ParallelBlobWriter` stores pending
blobs with a bounded worker count, bounds each put by the attempt deadline,
confirms durability markers in short transactions and reports the written
counts and bytes for the plan and blob trace events.

`screens::current` projects the current screen identities, titles and view
pairs from the accepted index screen records for both admission and API
screen listing. It orders screens by current path and views by desktop before
mobile, then light before dark.
Entry paths use the shared `mkc-domain` `EntryPath` grammar. Current-only
screen listing and screen-specific sharing are unavailable (HTTP 503);
publication-level sharing works.

`CatalogueAccess` issues one-use grants and rechecks current membership for
short-lived signed cookies. Invalid cookies fall back to anonymous visibility
policy and request cookie deletion, including on a private denial.

`ChecksWorker` delivers the durable event outbox through `dyn CheckRuns`,
keeping informational success/neutral semantics and a stable check identity
across retries. `GitHubCheckRuns` implements that boundary over `dyn Checks` and the store.
It resolves the project binding, connected installation and canonical repository.
It updates a recorded run, or lists the head before creating, then records every
created or recovered run. Unbound projects and disconnected or uninstalled Apps
acknowledge without a provider call. Suspension retries. `PublicationCheckRerequests`
uses the same parent-first claim as `BuildCheckRerequests`. The query locks
organizations and projects in UUID order before at most 100 marked checks.
It skips busy parents and checks. Fresh events and mark clears commit in one
transaction. None of these transactions enclose GitHub
requests. Every configured API replica runs publication and build delivery and rerequest
batches every five seconds.
`run_batch(Some(project_id))` restricts the outbox to one
project before its batch limit; `run_batch(None)` delivers across projects.
Check links use the organization's and project's current slugs at delivery
time, and retired claims keep earlier links resolving after a rename. Included
index Changes records count once, including pure moves. Check links keep the
index order across current kinds, then removed records. Summaries cap escaped
output
at 60,000 bytes and displayed titles at 160 characters without rejecting
producer content. Internal and superseded attempts never post a red check.

Each delivery claims one due event immediately before provider work in a short
transaction. The claim reserves five minutes and advances the retry version.
Success and failure writes require that version. Failure keeps the existing
backoff and permanent budget rules without another version increment. A dead
process's claim becomes due again after five minutes; operator requeue also
fences stale outcomes.

Transient delivery failures retry with backoff capped at one hour; five
permanent failures dead-letter an event, and later events continue.
`CheckRecovery` requeues an undelivered dead letter without a pre-existing
provider check and exposes the combined publication/build dead-letter count
for the deployment alert. `BuildMaintenance` requeues build dead letters. See
[Changes check](../../docs/protocol/cloud/changes-check.md) and the
[operator procedure](../../docs/ops/check-recovery.md).

`RetentionWorker` fails abandoned attempts after their deadline, prunes
failed-attempt metadata 30 days after creation and removes expired catalogue
grants. Ready publications are never candidates: each keeps its files, screen
selections, URL and same-head idempotency until project or workspace deletion,
whatever its age or branch state. The worker rechecks state before each write,
so an upload that completes concurrently stays intact. It reads no GitHub
state. Historical expired publications keep their read behavior.
Published builds remain linked to expired publications; the build query layer
prunes their rows separately after its own retention window. The build
upload grant authorizes only its live attempt. Ready completion consumes it
and attaches the winner in the ready transaction; its own 201 receipt can
repeat after the build ends. `GarbageCollector` uses
per-project reference counts, a 24-hour grace and incarnation fences, and its
claim recheck and orphan sweep use exact `BlobKey` lookups. Both workers expose
bounded batches and continuation cursors. `Maintenance` runs both until each is
exhausted, rejects stalled cursors and reports abandoned, pruned, blob and
orphan counts. It needs only the store and the file store. See
[Retention](../../docs/protocol/cloud/retention.md) and
[maintenance](../../docs/ops/maintenance.md).

`BuildEligibility` shares deployment, repository, installation and plan checks
with API project capabilities. Its `configured` method has no default; every
implementation states whether builds are configured. `Plan::allows_publication`
owns the plan rule used by upload authorization and build scheduling.
`BuildScheduler` is a query-only callback in webhook durable-effect and REST
scheduling transactions. `BuildHeadRecorder` saves each pre-read observation
through the guarded query and returns the stored reference for every trigger.
The scheduler rechecks repository access, plan, automatic settings, fork
identity and ready/active head duplicates before scheduling with supersession.
`BuildWorker` claims and starts or recovers one build in the same transaction.
It keeps a process slot, mints an uncached Contents-read credential, runs
`dyn BuildRunner`, persists redacted output and renews ownership every thirty
seconds. Claims, renewal and grant consumption pass a live `BuildClock`
guard to the queries. They read it after all ownership locks on each
transaction attempt. Start times, lease expiry and deadlines use a fresh
reading under the claim locks. Renewal extends from its fresh reading and
refuses a lease at or after its stored expiry. Lost ownership drops the runner future. An attempt start under
the organization lock is the only way to make a lease live. The store enforces
two live
attempts per organization and one MiB of retained output. Infrastructure
failures retry four times; a committed publication always wins over failure.
Publish failures follow the [lifecycle mapping](../../docs/protocol/cloud/cloud-builds.md#claims-leases-and-retries),
including the Mokly 0.18.0 failure codes.
The worker matches typed `MoklyCliCode` values from `mkc-build-interface`.
`git-uncommitted` fails with `uncommitted-changes`. `upload-failed` retries as
an infrastructure failure. Unknown codes fail with `exit`.
The unsupported-version check names the 0.18.0 minimum.
A test binds every mapped code and result to
the public CLI's `cli-errors.json` fixture. The scheduler and REST request
path use the domain fork rule that reference reads also use. The output-limit
check says “The build printed too much output; print less to publish.”
Build uploads reserve a cleanup event UUID v7 before admission. Cancellation,
supersession, finalization and recovery use that ID in their shared cleanup query.
Upload cleanup follows the [attempt-ending rule](../../docs/protocol/cloud/publication-ingest.md#ending-build-attempts).
`BuildChecksWorker` claims each outbox row immediately before delivery. It
shares immutable index 9 publication rendering, including pure moves and
current screen-path links, through `CheckRenderer`; publication
events with a build link skip provider delivery. `BuildCheckRerequests`
schedules only eligible failed, timed-out or cancelled current heads.
`BuildReconciler` removes orphaned managed sandboxes every five minutes.
`BuildMaintenance` prunes at most 1,000 terminal builds per call.

## Quick Start

Compose the ingest service at a composition root from the store, the file
store and the `mkc-mokly-contract` receiver, then hand `Arc<dyn Ingest>` to
the HTTP boundary:

```rust
use std::sync::Arc;

use mkc_auth::runtime::SystemRuntime;
use mkc_file_store_interface::store::FileStore;
use mkc_mokly_contract::bundle::UploadValidator;
use mkc_publications::blob_writer::ParallelBlobWriter;
use mkc_publications::ingest::{Ingest, PublicationIngest};
use mkc_publications::policy::DatabaseAccessPolicy;
use mkc_publications::transaction::{StoreTransactions, Transactions};
use mkc_store_interface::store::Store;

fn ingest(
    store: Arc<dyn Store>,
    files: Arc<dyn FileStore>,
    validator: Arc<dyn UploadValidator>,
) -> Arc<dyn Ingest> {
    let transactions: Arc<dyn Transactions> = Arc::new(StoreTransactions { store });
    let runtime = Arc::new(SystemRuntime);
    Arc::new(PublicationIngest {
        transactions: transactions.clone(),
        runtime: runtime.clone(),
        policy: Arc::new(DatabaseAccessPolicy),
        validator,
        writer: Arc::new(ParallelBlobWriter {
            files: files.clone(),
            transactions,
            runtime,
            worker_count: 8,
        }),
        files,
    })
}
```

## Development

```sh
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  cargo test -p mkc-publications
cargo clippy -p mkc-publications --all-targets -- -D warnings
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  cargo test -p mkc-publications --test maintenance -- --nocapture
```

Unit tests mock transactions, policy, clocks, file storage and provider calls
with unimock. The `maintenance` integration test needs Postgres and uses an
isolated schema and a temporary blob directory per run. Lifecycle and check
tests construct publications through real ingest or retention transitions;
never manufacture a terminal publication with an identity that ingest could
not have retained. The running-server publish smoke lives in
`mkc-catalogue-server`; see [Publish smoke](../../docs/ops/publish-smoke.md).

Build unit tests mock store, entropy, credentials, runner and lease timers.
The Postgres suite runs two worker instances, concurrent schedulers, bounded
logs and the queued/running/published check sequence. It drives every runner
and grant outcome, claim refusal, lease recovery, retry delay and exhaustion
through real store transitions, checking exit codes, steps, log completion and
outbox bumps. Check summary tests include budgets too small for an output
block. The fake runner uploads the released fixture through the real
exchange with its minted grant. Rejected uploads retain publish exit codes.
The completion lock suite overlaps the full ready transaction, including
nonempty screen selections, events and grant consumption, with cancellation,
supersession, finalization, infrastructure requeue and expired-lease recovery
in both orders. Database gates and observed lock waits select each order.
The build fixture helper adapts the shared released export and removes its
comparison files for current-only tests. The shared test adapter under `mkc-api/tests/github` keeps envelope 3 and
index 9 in each Plan. It updates identity and marker digests for build and
preview-seed exchanges.

### Key Code

- [ingest.rs](./src/ingest.rs) — `Ingest`, the trait the HTTP boundary calls (`authorize`, `preflight`, `blob_target`, `store_blob` and `complete`), `PublicationIngest`, its composition-root implementation, and `ATTEMPT_MINUTES`, the sixty-minute attempt lifetime.
- [preflight.rs](./src/preflight.rs) — the plan request: admits the attempt, validates the archive, reserves every declared file, stores the artifacts and emits the `publication upload planned` trace event.
- [blob_upload.rs](./src/blob_upload.rs) — the blob request: resolves the reservation before the body is read and stores only a body whose digest and length match it.
- [completion.rs](./src/completion.rs) — the completion request: resolves the attempt in the released order, checks pending blobs, reloads the stored catalogue index and runs the ready transaction.
- [completion_outcome.rs](./src/completion_outcome.rs) — `Outcome` and `decide`, the one decision the fast check and the ready transaction both take from the attempt's own row, so a repeated completion never treats its own upload as another winner.
- [reservation/reserve.rs](./src/reservation/reserve.rs) — the reservation transaction: authorizes the envelope, finds the ready winner of a replay, and reserves blob rows and paths in canonical hash-then-path order.
- [reservation/finish.rs](./src/reservation/finish.rs) — the ready transaction: rereads the attempt, requires every referenced blob to be durable, and commits the state, Changes totals, screen selections, branch alias and ready event together.
- [lifecycle.rs](./src/lifecycle.rs) — `close_unfinished`, which fails an unfinished attempt and releases its files only when its own conditional update closed it.
- [blob_writer.rs](./src/blob_writer.rs) — `BlobWriter` and `ParallelBlobWriter`, the bounded parallel puts with per-put operation deadlines and batched durability-marker transactions.
- [transaction.rs](./src/transaction.rs) — `Transactions` and `StoreTransactions`, which run query callbacks through the store and turn a policy rejection into a rollback without a store error.
- [policy.rs](./src/policy.rs) — `AccessPolicy` and `DatabaseAccessPolicy`, the bearer, project, visibility and plan checks evaluated inside each transaction.
- [upload_authorization.rs](./src/upload_authorization.rs) and [build_upload.rs](./src/build_upload.rs) — `Credential`, which selects a project token (`mkc_`) or a build grant (`mkb_`) by its prefix and keeps only its digest, `UploadPolicy`, the per-transaction authorization both share, and `BuildAuthorization`, the live build-grant check, upload scoping and atomic ready consumption.
- [envelope.rs](./src/envelope.rs) — canonical repository identity and config-path authorization across Git hosts, and the retention of a rejected plan's identity.
- [error.rs](./src/error.rs) — `Error`, the typed outcomes the API maps to HTTP, and `DurabilityFailure`, the internal invariant failures.
- [screens.rs](./src/screens.rs) — `screens::current`, the projection of current screens and view pairs from index screen records.
- [locations.rs](./src/locations.rs) — `Locations`, the canonical catalogue and viewer URLs, and `branch_alias`, the DNS-safe branch identity.
- [access.rs](./src/access.rs) — `CatalogueAccess`, one-use grants and signed-cookie authorization.
- [check_worker.rs](./src/check_worker.rs) and [check_summary.rs](./src/check_summary.rs) — `ChecksWorker`, the durable GitHub check delivery, and the Changes counting and summary text.
- [check_delivery.rs](./src/check_delivery.rs) — `CheckRenderer`, the immutable publication result rendering that publication and build checks share, and the delivery step that keeps provider retry classifications.
- [check_provider.rs](./src/check_provider.rs) — `GitHubCheckRuns`, the `CheckRuns` adapter over the GitHub App `Checks` client that authorizes delivery through the project's installation and recovers a create whose response was lost.
- [check_rerequests.rs](./src/check_rerequests.rs) — `CheckRerequests` and `PublicationCheckRerequests`, the atomic consumption of verified rerequest marks into fresh due check events.
- [check_recovery.rs](./src/check_recovery.rs) — `CheckRecovery`, the dead-letter requeue and count.
- [build_scheduler.rs](./src/build_scheduler.rs) and [build_worker/service.rs](./src/build_worker/service.rs) — `BuildScheduler`, the query-only scheduling callback that rechecks eligibility and supersedes older builds, and `BuildWorker`, which claims, runs, renews and finalizes one durable build attempt.
- [build_check_worker.rs](./src/build_check_worker.rs), [build_reconciliation.rs](./src/build_reconciliation.rs) and [build_maintenance.rs](./src/build_maintenance.rs) — `BuildChecksWorker`, the build check outbox delivery; `BuildReconciler`, the cleanup of orphaned managed sandboxes; and `BuildMaintenance`, the terminal-build pruning and build check dead-letter requeue.
- [retention.rs](./src/retention.rs) and [garbage_collection.rs](./src/garbage_collection.rs) — `RetentionWorker` and `GarbageCollector`: the abandoned-attempt recovery, failed-attempt pruning and expired-grant removal, each candidate rechecked in its own transaction, and the fenced blob collection that claims a tombstone, deletes the exact incarnation outside the transaction, removes the row, then sweeps aged objects with no matching `BlobKey` row.
- [maintenance.rs](./src/maintenance.rs) — `PublicationMaintenance` and `Maintenance`: the complete cycle that exhausts both workers, rejects stalled cursors and returns the `MaintenanceReport` counts.

### Related Docs

- [Cloud builds](../../docs/protocol/cloud/cloud-builds.md) and [runner](../../docs/protocol/cloud/cloud-build-runner.md)
- [Publication ingest](../../docs/protocol/cloud/publication-ingest.md), [blob durability](../../docs/protocol/cloud/publication-blob-durability.md) and the [upload exchange](../../docs/protocol/cloud/publication-upload-exchange.md)
- [Catalogue hosting](../../docs/protocol/cloud/catalogue-hosting.md)
- [Changes check](../../docs/protocol/cloud/changes-check.md)
- [Retention](../../docs/protocol/cloud/retention.md)
- [Publish smoke](../../docs/ops/publish-smoke.md) — the fixture and published-CLI integration runbook.
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
