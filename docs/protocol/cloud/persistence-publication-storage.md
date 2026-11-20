# Persistence: Publication Storage

This continues [Persistence boundaries](./persistence-boundaries.md) for the
publication and blob rows: their transaction boundary, the lock orders that
keep concurrent transactions free of deadlocks, and the object prefixes.

## Transaction Boundary

[Publication ingest](./publication-ingest.md) and [retention](./retention.md)
use the same transaction boundary for immutable publications, blob
references, events, branch aliases and one-use catalogue grants. A file
reference is reserved before any external write, and a publication becomes
ready only after every referenced blob is durable. An explicit release of a
ready publication's file references is refused with an internal error, so a
published catalogue keeps its references until a project or workspace
deletion cascades to it. [Catalogue hosting](./catalogue-hosting.md) reads
only an authorized ready index.

Blob identity is per project: a blob is keyed by project and hash, so equal
bytes in two projects have separate rows, incarnations, durability markers
and objects, and a publication can never reference another project's stored
copy. Deleting a project releases every reference through its publications
and files; the unreferenced project-owned rows then wait for ordinary
grace-period collection. A blob lookup is scoped to one project, and the same
hash in another project never satisfies it. A maintenance lookup by hash and
incarnation is exact and never substitutes another incarnation with the same
hash. A durability confirmation targets the exact non-deleting incarnation:
it is idempotent for a confirmed row and reports false for an absent,
reincarnated or deleting row.
[Blob durability](./publication-blob-durability.md) defines the marker.

### Build And Publication Lock Order

A transaction that locks more than one of these levels takes them in this
order: workspace, project, build with its upload grant, publications, then
blobs in the [canonical blob order](#canonical-blob-lock-order). It may skip a
level. It never locks an earlier level after a later one. It takes all locks
needed at a level before advancing, including locks that triggers or cascades
will need.

This order covers build upload completion, cancellation, scheduling with
supersession, normal finalization, infrastructure requeue, expired-lease
recovery, build retention, and project or workspace deletion. A build
upload completion locks its build through its upload grant before its first
publication write. It first key-share-locks the project that its branch alias
can reference, then locks the build, grant and publications. Publication locks
include the upload and any ready identity winner that consumption can attach.
Grant consumption repeats only locks that completion already holds.

Supersession locks every affected build's unfinished publications before the
first blob lock. Retention first selects at most 1,000 candidates without row
locks, locks their projects in UUID order, then locks and rechecks those
candidates. This serializes retention and parent deletion before build locks,
including builds whose `superseded_by` link the deletion clears.
Retention locks grants and all linked publications, including ready and
expired rows whose build link the cascade clears. Parent deletion
locks the parent, its projects, builds, grants and publications before blobs.

Build and publication Re-run marks share one parent-first claim query. It
first reads at most 100 marked check IDs for the owner's external-ID prefix,
ordered by check UUID, without row locks. It key-share-locks the candidate
workspaces in UUID order. It then update-locks all candidate projects in
UUID order. Both parent steps skip locked rows; only projects whose
workspace lock it holds can advance. It finally update-locks the selected
check rows in UUID order with `SKIP LOCKED` and rechecks the prefix, mark and
parent membership. Deleted or busy parents and busy checks yield no claim.
New marks outside the candidate batch wait for the next batch.

All parent locks precede every check lock. A build Re-run can then repeat its
project lock while scheduling. Both workers keep the parent and check locks
through their effect write and mark clear in one transaction. Two replicas
skip busy parent batches and cannot consume the same mark. These rules also
apply when a transaction retries. They prevent a cycle with project and
workspace deletion without adding deadlock retries.

Postgres tests overlap the full upload completion path, including the ready
write, with cancellation, supersession, finalization, infrastructure requeue
and lease recovery. Each pair runs with completion first and with the other
transaction first. Each overlap commits one outcome without a deadlock.

### Canonical Blob Lock Order

Concurrent reservation, release, collection and deletion transactions must
not deadlock on blob rows. Decision: every transaction that locks, inserts,
updates or deletes more than one blob row takes the rows in ascending project,
then hash order, with the hash compared bytewise, so the service and the
database agree whatever the database's default collation. The rule covers
rows reached indirectly through reference triggers and parent cascades: a
parent deletion locks every referenced blob in that order before it cascades.
Deletion takes the higher-level locks before those blob pre-locks, under the
[build and publication order](#build-and-publication-lock-order). Inserts
follow the same order as locks, because the insert of a new hash can itself
wait on a concurrent inserter. A per-path lock order was rejected because two
paths that lock the same rows in different orders can deadlock. Garbage
collection is outside the rule: each claim and each record finalization
targets one blob incarnation in its own short transaction.

## Object Prefixes

`MKC_GCS_PREFIX` beside `MKC_GCS_BUCKET` names an optional physical
namespace. Unset or empty means no prefix; otherwise the value is 1–63
lowercase ASCII letters, digits and hyphens, with no slash, whitespace,
trimming or case normalization, and an invalid value fails startup with a
configuration error. The logical object key stays
`sha256/<hash>/<incarnation>` and does not embed project identity; each
project's row has its own incarnation, and the unique hash and incarnation
pair makes reverse lookups exact. The physical name is
`<prefix>/sha256/<hash>/<incarnation>` for every operation, and with no
prefix every request is byte-for-byte unchanged. Listing filters beneath
`<prefix>/sha256/`, strips exactly `<prefix>/`, keeps the provider's
pagination tokens and timestamps, and ignores names outside that boundary:
`pr-1/` never accepts `pr-10/`.

A prefix changes neither public URLs, hashes, incarnation fencing nor database
references. The API and the catalogue server share one prefix; stable buckets
leave it unset. PR bucket IAM restricts object operations to `pr-N/` and
grants no bucket-level listing; PR collection and listing are unscheduled,
and trusted deploy cleanup lists with its bucket-only admin grant. See
[PR GCS ownership](./pr-preview-environments.md#gcs-identity-and-retention).

## Related Docs

- [Persistence boundaries](./persistence-boundaries.md)
- [Publication ingest](./publication-ingest.md)
- [Retention](./retention.md)
- [Blob durability](./publication-blob-durability.md)
- [Cloud builds](./cloud-builds.md)
