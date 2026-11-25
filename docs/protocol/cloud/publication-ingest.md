# Publication Ingest

The API accepts the published [upload contract](./publication-upload.md); it
never extracts archives, executes catalogue code or imports Mokly internals.
[Hosting](./catalogue-hosting.md) owns delivery. The wire shapes are in
[Publication upload exchange](./publication-upload-exchange.md); this document
owns authorization, state, storage and the [delta lifecycle](#delta-lifecycle).
The [architecture doc](../../architecture/cloud.md) describes the publishing flow and
the components that consume a ready publication.

## HTTP Boundary

`POST /v1/projects/{projectId}/publications` (plan),
`PUT /v1/projects/{projectId}/publication-uploads/{publicationId}/blobs/{sha256}`
(blob) and
`POST /v1/projects/{projectId}/publication-uploads/{publicationId}/complete`
(completion) all require exactly one
`Authorization: Bearer mkc_<64 lowercase hex digits>` header, or a cloud
build's `mkb_` token under [Build uploads](#build-uploads). The project must
exist, the digest must belong to its active token, and the validated envelope
must name the project's canonical repository identity and exact config path.
Ingest compares the envelope's canonical identity with the stored identity,
ASCII case-insensitive. The canonical form uses `<owner>/<name>` for
`github.com` and `<host>/<owner>/<name>` for other hosts. Other Git hosts can
publish under the same authorization rule. [Platform model](./platform-model.md#projects-and-visibility)
defines the identity grammar and storage form. Session cookies cannot authorize these
operations. Bearer requests need no Origin or CSRF token. Authorization runs
before any body byte is read on every request, at reservation and again at the
ready commit, including token revocation and project deletion. Token last-use
time changes only on a ready commit or a plan replay.

A plan answers 200 with the plan document; blob requests answer 204;
completion answers 201 for the attempt that became ready or 200 for an attempt
superseded by another ready publication, with `id`, `projectId`, the actual
persisted `state`, nullable `buildId`, `catalogueUrl` and `viewerUrl`. Both URLs identify the
immutable publication. Responses are `no-store`. The 16 KiB limit of JSON API
requests does not apply to upload bodies.

The plan body is bounded by the
[validation limits](./publication-upload-validation.md#plan-archive-and-limits).
A declared Content-Length above the compressed limit is rejected before
reading. At most two plans are admitted per API process; admission exhaustion
is 503, never an unbounded wait. Plan and blob body reception is bounded to
120 seconds. Attempts expire sixty minutes after admission and cannot commit
afterward. Immediately before every object write, the service derives one
operation deadline as the smaller of 60 seconds and the positive time left
before the attempt deadline, and every provider interaction of that write
shares it. An exhausted attempt makes no storage call, so a request never
outlives the attempt deadline by more than one operation's budget. A
truncated body is never accepted: a disconnect, a transport error or a limit
never reads as a clean end of body.

`MKC_UPLOAD_MEMORY_BYTES` is one weighted byte budget shared by every plan and
blob request in the API process. It defaults to 536870912; zero, empty,
fractional, negative or overflowing values prevent startup. A plan entry is
charged for its declared size before its body is read. A raw Blob is charged
for its declared `Content-Length`. A gzip Blob is charged for both its encoded
`Content-Length` and its reserved decoded file size before body reads. Each
reservation is refused at once with 503 `upload-unavailable` when the bytes do
not fit. Exhaustion never waits. The two-plan admission bound applies in
addition.

The encoded reservation remains held while a gzip body is received and decoded.
The decoded reservation remains held while the verified bytes are stored. The
encoded reservation is released before storage begins. Both reservations are
released on a transport error, timeout, invalid gzip, decoded-size mismatch,
digest mismatch or storage failure. A durable-Blob drain takes no reservation.

The [REST reason catalogue](./rest-api.md#reason-catalogue) is the home of
every upload reason, its status and the condition that produces it; the
[exchange mapping](./publication-upload-exchange.md#expiry-and-failure-mapping)
describes how the released CLI reacts to each status. Plan authorization runs
before the body is read and again in the reservation and ready transactions,
which read the workspace's current plan as
[Billing plan gates](./billing-plan-gates.md) defines.

Error bodies use the `rpc-error` envelope, with client failures logged at
warn. The 426, 408 and 410 responses carry the same envelope as every other
error. No parser, bearer, storage credential or SQL diagnostic appears in that
body.

## State And Atomic Visibility

| State      | Permitted next states | Servable                      |
| ---------- | --------------------- | ----------------------------- |
| uploading  | validating, failed    | No                            |
| validating | ready, failed         | No                            |
| ready      | expired               | Yes, subject to access policy |
| failed     | none                  | No                            |
| expired    | none                  | No                            |

`expired_at` is present exactly when state is `expired`. Expired rows retain
history but no longer reserve the ready idempotency key. Republishing an
expired head validates a new attempt and yields a new ready ID and URL.

An authenticated plan creates a publication with a server-generated ID in
`uploading` before decoding. Before retaining the identity of a rejected
plan, ingest rechecks the active token and applies the same repository and
config-path authorization as a successful upload. Authorized metadata is
written once on `uploading -> validating`; a rejected plan then transitions
to `failed` and emits a deliverable failure event. Unknown or malformed
envelopes, and failures before an envelope is read, have no head identity and
produce no check. A repository or config mismatch is forbidden and never
records that identity. The project, branch, head and base identity, PR
number, config path, exported time and the comparison generation that the
stored index names are immutable thereafter. Client time never orders
history or aliases.

The marker gives the SHA-256, byte length and path of every declared file.
When ingest accepts a plan, it indexes every declared path with its own MIME
type. That type comes from the extension of the path under the
[Mokly content type rule](../mokly-content-types.md), and it does not change. Blob identity is
`(authorized project, hash)`: publications in one project reuse its durable
copy, while another project receives a separate copy of equal bytes. A
declared size that differs from the project's existing copy of the same hash
is an invalid bundle. The envelope and marker are private indexed metadata. A
plan-time file-store failure changes the attempt to `failed` and releases its
file references, leaving zero-reference blobs eligible for collection; when
that cleanup fails, the original rejection is still returned and retention
releases the references at the deadline. An expired or failed attempt cannot
return to validating or ready. Every state change appends an event in the
same transaction. Each failure records one of a fixed set of failure codes.

A publication becomes ready only when every blob it references is durable,
the token still authorizes it, its deadline has not passed and no other
publication is ready for its identity. One transaction makes the complete
file index visible as `ready` and stores the immutable Changes observation.
With a comparison, that observation holds the totals of the stored catalogue
index under the [Changes count](./publication-review.md#changes-count).
Without a comparison, including an index whose Changes are
`unavailable`, it is the explicit no-comparison observation.
The same transaction stores the current screen and view selections that
[Screens and observations](./publication-review.md#screens-and-observations)
defines, points the branch alias at the publication and appends the ready
event; a reader sees all of it or none of it. A referenced blob that is not
durable at that point is an internal ingest failure. Ready and expired rows
must have an observation; unfinished and failed rows have none. Counts and selections
cannot be rewritten. No partial catalogue is served. Ready metadata and bytes
cannot be replaced. A ready publication keeps its file references until its
project or workspace is deleted. The `ready -> expired` transition removes
them while retaining the publication record with an expiry timestamp, and no
scheduled cleanup performs it; see [Retention](./retention.md).

## Blob Durability And Parallel Writes

[Publication blob durability](./publication-blob-durability.md) defines the
project-owned durability marker, the bounds of the parallel writer,
conditional storage writes and the plan and blob trace events.

## Idempotency And Concurrent Uploads

The key is `(authorized project, head SHA, config path)`, and at most one
ready publication exists for a key. Every plan authenticates and validates
its entire declared catalogue before checking the key. The first ready commit
wins, even if another valid upload has different bytes, branch or comparison
base. Failed and expired attempts reserve no key. Superseded attempts release
their file references, record a superseded failure and complete with the
winner. They never change its alias, comparison or check.

A plan of an identity that is already ready performs no reservation or storage
work and records a superseded replay. When another upload wins during the
ready transaction, that transaction closes the loser, releases its references
and returns the winner it observed.

## Delta Lifecycle

[Publication upload lifecycle](./publication-ingest-lifecycle.md#delta-lifecycle)
defines preflight, blob upload, completion and deadline cleanup.

### Preflight

[Preflight](./publication-ingest-lifecycle.md#preflight) defines plan admission
and reservation.

### Blob Upload

[Blob upload](./publication-ingest-lifecycle.md#blob-upload) defines authorized
blob transfer and retries.

### Completion

[Completion](./publication-ingest-lifecycle.md#completion) defines replay,
ready commits and deadline outcomes.

## Build Uploads

[Build uploads](./publication-ingest-lifecycle.md#build-uploads) defines
build-token authorization and grant outcomes.

### Ending Build Attempts

[Ending build attempts](./publication-ingest-lifecycle.md#ending-build-attempts)
defines upload cleanup and event identity when a build attempt ends.
