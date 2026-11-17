# Publication Retention

Publication cleanup and blob collection are workers of the publication
service. The API binary runs them as a scheduled maintenance command; the
[architecture doc](../../architecture/cloud.md) places them. Each runs bounded cycles
through a worker interface with an injected clock and file store, and reads
only the database and the file store.

## Publication Policy

Keep every ready publication with its files and screen/view selections until
its project or workspace is deleted. Age, a newer publication, a branch
change, a closed or merged pull request and the GitHub integration state never
make a ready publication eligible for cleanup. Its URL and same-head
idempotency stay valid while its project exists. Decision: ready publications
have no age-based expiry. A 30-day expiry that kept only the default branch,
open pull requests and the latest publication on each branch was rejected, so
that every shared URL and history entry stays available and cleanup needs no
GitHub reads or credentials.

Cleanup uses server-created timestamps, never `exportedAt`. A failed
attempt's metadata becomes eligible for cleanup 30 days after the attempt was
created; its files are released immediately. Mark unfinished
uploading/validating attempts failed with `expired` once their server deadline
passes, releasing their references; a conditional ready transition cannot
resurrect them. Remove catalogue grants whose expiry has passed, whatever the
state of their publication. Build retention independently deletes a failed
attempt together with the build that names it, which can be earlier; see
[Cloud builds](./cloud-builds.md#retention-and-recovery).

Project and workspace deletion release the references and grants of their
publications.

### Attempt Deadline

Each attempt's deadline is sixty minutes after its plan was admitted. The plan
stores that exact server deadline on the attempt and returns it as
`expiresAt`; blob and completion requests use it, and recovery selects
unfinished attempts whose deadline is at or before its captured time. The
released CLI starts no blob or completion request at or after `expiresAt` and
spends its single re-plan on a 410 or a passed expiry. Re-planning does not
extend or reuse an abandoned attempt. It creates a new attempt that can reuse
any blobs the earlier attempt already made durable.

## Expired State

`expired` remains a terminal publication state with the rules below. No
scheduled job or maintenance command moves a ready publication to `expired`.

The transition to `expired` is atomic: it records the expiry time, removes the
path index, access grants and current screen/view selections, and appends an
event. Among the records that reference a publication, only the event history
and the publication's builds are retained; the path index, access grants and
screen/view selections are deleted. `builds` is retained and keeps naming the
expired row. Every record that references a publication has an explicit
retain-or-delete rule at this transition, and a new relationship needs a
decision. Preserve immutable publication metadata and Changes observations for
history and rerequests. Hosting requires `ready` before reading any blob;
expired URLs return 404. An expired head can be republished under a new
publication ID.

The build deletion query removes terminal builds with their failed upload
attempts and cascades grants, logs and check rows. Ready and expired
publications keep their rows with `build_id` set to null. Builds keep their
own thirty-day [retention](./cloud-builds.md#retention-and-recovery) in
`mkc-api prune`.

## Reference Accounting

Each publication-file row holds one reference to its project's blob,
including private ingest metadata and validating uploads, and a referenced
blob is never collected. A reference is reserved before any external put, so
a collector cannot select an object that an upload is about to use. Files
that share a hash use one object within a project but keep path-specific MIME
in their individual index rows; the same hash in another project has a
separate row, incarnation and object. Every reservation, explicit release and
parent cascade follows the
[canonical blob lock order](./persistence-publication-storage.md#canonical-blob-lock-order).

A ready transition requires every referenced blob to carry the durability
marker that [Blob durability](./publication-blob-durability.md) defines.
Collection ignores that marker: a zero-reference row is eligible on the same
grace and tombstone rules whether or not it is marked, and the orphan sweep
never uses the marker to infer that a matching row is safe to delete.

After 24 hours with zero references, collection marks a bounded batch of
project-owned blobs `deleting`, deletes each exact incarnation, then removes
only the still-deleting, zero-reference matching row. A new upload in that
project that meets a deleting hash receives a retryable unavailable outcome
before writing; another project's row is independent. A missing object counts
as deletion success. A failed delete leaves the tombstone retryable.
Duplicate collectors are safe: a new incarnation has a new object key, so a
delayed delete cannot remove its bytes.

An orphan sweep pages the file store and deletes objects older than 24 hours
whose exact key has no matching database row. It covers a process that
crashed after a put and a delayed abandoned writer that recreated an old key,
and it never collects an object that a live row matches. Objects that are too
recent, unknown to the storage key grammar, or cannot be dated are retained,
never guessed safe. Unrecognized names are skipped; malformed provider
timestamps fail the listing with preserved diagnostics. List and delete
operations are bounded and restartable.

Deleting a project releases that project's references, and the collector
removes its objects after the normal 24-hour grace; other projects' equal
hashes, counts and objects are untouched. Decision: a blob row has no foreign
key to its project, because a cascading delete of blob rows would drop the
index row before its object and leave the object to the orphan sweep instead
of the fenced collector.

## Maintenance Cycle

One maintenance command runs abandoned-attempt recovery, failed-attempt
pruning, expired-grant removal, blob collection and the orphan sweep until
each is exhausted, with a hard batch ceiling and stalled-cursor rejection. It
aggregates abandoned, pruned, deleted-blob and deleted-orphan counts for
structured operator diagnostics. A database or storage failure makes the
command exit nonzero; fenced deletion tombstones remain retryable, and a later
run continues the work. The command needs only the database and the file
store. It never reads GitHub and loads no GitHub, mail, OAuth client-secret,
webhook-secret or catalogue-signing credential.

Queries apply eligibility before the limit: uploading/validating deadlines at
or before now, and failed-attempt creation times at or before the supplied
thirty-day cutoff. Ready and expired rows are never candidates, so a large
successful history cannot fill a batch. Partial indexes cover each
lifecycle/time predicate. Collection selects only zero-reference rows whose
grace has elapsed or which already carry a deletion tombstone, using separate
partial indexes for those cases. Query-plan tests prove each cutoff is an
index condition rather than a worker filter. The worker rechecks lifecycle
and reference state inside each transaction, so an attempt that becomes ready
concurrently stays intact.

## Scheduling

Helm runs the maintenance command daily in UTC in stable production and main
preview, whether or not the GitHub integration is enabled. Overlap is
forbidden, a failed Job is not retried, and each run has a ten-minute
deadline. The job uses the API workload identity for Postgres and the
environment's bucket and mounts no secret.

PR previews schedule no publication maintenance. Their workload principals
have no bucket list permission, so they run neither collection nor the orphan
listing. Destroying a PR environment deletes its database, then deletes every
object under its `pr-N/` prefix; see
[PR retention](./pr-preview-environments.md#gcs-identity-and-retention).

GCS age rules never remove current objects. Once the command deletes an exact
unreferenced incarnation, the provider's seven-day soft-delete window and
noncurrent-version lifecycle still apply. Publication and build checks run in
API workers as [Changes check](./changes-check.md) defines. Authentication,
build and GitHub record pruning use separate scheduled commands; see
[Persistence](./persistence-boundaries.md).

## Verification

Tests cover old ready publications on every branch keeping their files, URLs
and same-head idempotency; a successful history larger than one batch; the
exact 30-day failed-attempt boundary; abandoned attempts; expired grants;
shared-file counts; cascading project deletion; concurrent reservation and
collection; deletion retry; delayed old-key deletion; orphan cleanup;
multi-batch exhaustion and stalled continuations. A persistence invariant
discovers every child relationship through `pg_constraint` foreign keys that
reference `publications`, whatever the referencing column's name. It
populates each child, checks that a maintenance run keeps every child of a
ready publication, then applies the expired transition directly and checks its
retain/delete rule. A new relationship requires a decision and fixture
coverage. A real local-store/Postgres smoke runs the complete cycle and proves
that ready publication bytes still serve while abandoned, failed and
deleted-parent references are reclaimed.
