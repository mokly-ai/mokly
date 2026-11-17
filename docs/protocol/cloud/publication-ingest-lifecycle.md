# Publication Upload Lifecycle

This sub-contract of [Publication ingest](./publication-ingest.md) defines
preflight, blob upload, completion and build-token uploads. Ingest owns the
shared HTTP authorization, attempt states and atomic visibility rules.

## Delta Lifecycle

### Preflight

The plan request authenticates before reading, validates the artifact-only
archive and authorizes its envelope under the
[HTTP boundary](./publication-ingest.md#http-boundary). It creates an `uploading`
attempt, advances it to `validating`, and assigns a server-created deadline
sixty minutes after admission. It verifies the archived envelope and index
against the marker's declared sizes and digests. Comparison,
reserved-root and hosting-policy checks use all marker paths even though their
bytes are not in this archive.

The plan reserves a reference for every declared path and for the private
marker before any object is written, then stores the envelope, the marker and
the index itself. Those artifact hashes are never candidates for
`missing`. A plan-time storage failure closes the attempt through the
ordinary failed-attempt cleanup, and the CLI's retry plans a new attempt.

For each remaining distinct hash, `missing` contains exactly the hashes this
project has not stored durably; a copy owned by any other project never
satisfies the lookup.

Authentication and artifact validation precede the ready-idempotency lookup.
When a ready winner already exists, preflight records the attempt as a
superseded replay, reserves and stores no blobs and sends an empty missing set.
Concurrent non-replay attempts still let the first ready commit win.

### Blob Upload

A blob request first authenticates and scopes the attempt to the project. An
unknown or foreign attempt stays HTTP 404. An owned attempt must still be
`validating` before its deadline, and the hash must be reserved by it with the
request's declared length. A reserved hash already durable for the project is
an idempotent 204 that drains the raw or gzip body within the reception bound
and stores nothing. Otherwise the service admits the raw `Content-Length`, or
both encoded and decoded sizes for gzip, against the process byte budget. It
reads raw bytes or decodes one gzip body into bounded storage, stops after the
declared decoded size plus one byte, and rejects invalid gzip or a decoded size
mismatch before calling storage. It computes SHA-256 itself and compares the
decoded bytes with the reservation. No partial or mismatched body is stored.
Zero-byte raw reservations are valid. A storage or marker failure leaves the
attempt and its reservations open, so a retried PUT can store the same hash.

### Completion

Completion accepts no catalogue bytes and resolves in the order the exchange
defines. An attempt that became ready, including one retention has since
expired, answers 201 with its own receipt. Otherwise the service looks up the
publication ready for the attempt's identity (project, head SHA and config
path) at that moment. When one exists, a `validating` attempt is failed as
superseded and releases its references, and every superseded attempt,
including a replay recorded at plan time, answers 200 with that publication.
When none is ready, a superseded attempt, any other failed attempt and a
validating attempt past its deadline answer 410 with `upload-expired`. No
link to an original winner is stored: preflight and completion are separate
requests that may reach different processes, and a stored link would still
need this fallback once that winner expired.

A validating attempt then checks for pending publication blobs. If any remain,
the outcome is HTTP 409 with `upload-incomplete`. Otherwise the ready
transaction reauthorizes, resolves the attempt again in the same order, then
persists observations and returns the receipt with HTTP 201. A completion
that overlaps an earlier one for the same attempt finds the attempt ready
there and answers 201 with it, writing nothing; a different upload that
committed the identity first answers 200 with that winner. A deadline found
by that transaction answers 410 `upload-expired`. Authorization and deadline
outcomes close the attempt; an internal or unavailable failure leaves it
validating, so the CLI's retry can complete it before the deadline.

Completion loads the stored index of every attempt that it may publish.
A stored index that completion cannot load, because its file
reference or its stored bytes are gone, is an internal failure only when the
ready transaction still decides to publish. When another request
closed the attempt after the index was first read, which releases the index's
file reference, the ready transaction answers for the closed state instead.
An index whose reference query or storage read fails, or that
cannot be decoded, is an internal failure straight away.

Retention fails unfinished attempts at the same sixty-minute deadline and
releases their references; blobs already made durable remain available to
later reservations until ordinary reference accounting and collection make
them eligible.

## Build Uploads

Build upload transactions follow the
[build and publication lock order](./persistence-boundaries.md#build-and-publication-lock-order),
including the completion transaction before its first publication write.

A
[cloud build](./cloud-builds.md) attempt runs the same exchange with
`Authorization: Bearer mkb_<64 lowercase hex digits>` on its plan, blob and
completion requests. The token's SHA-256 digest names one
`build_upload_grants` row. Before any body byte is read on every request, at
reservation and again in the ready transaction, the grant must be unexpired
and unconsumed, and its build must belong to the path's project and be
`running` on the grant's attempt with a live lease. Otherwise the request is
`upload-unauthorized`; a grant for another project is `upload-forbidden`. The
one exception is a retried completion of the attempt a consumed grant made
ready, which answers 201 again as the exchange promises, including after
its build finishes or the publication is expired. A consumed replay
grant cannot repeat a 200 or complete the winner directly. The workspace's
plan gates a build upload exactly as it gates a project token's. Build tokens
and project tokens share the routes, limits, admission and authorization rules
of [publication ingest](./publication-ingest.md#http-boundary). A build upload's deadline is the earlier of sixty minutes after
admission and the grant's expiry. A grant can access only uploads that name
its build and were admitted during its attempt, from its mint time to its
expiry. Other attempt IDs, including another build in the same project, are
`not-found`. These checks read Postgres on each request and transaction;
replicas share no authorization cache or upload ledger.

Build uploads require the same 0.19.0 artifacts as project uploads: upload
envelope 3, ownership marker 3 and catalogue index 9. A build
token adds authorization and identity rules; it does not select another
format.

A build plan's envelope must also carry the build's `headSha` and `branch`, and
a `pullRequest` that is null or equal to the build's; a mismatch is
`upload-forbidden` and, like a repository mismatch, retains no identity. The
attempt row records `build_id`, and its persisted pull request number is the
build's, whatever the envelope carried. A rejected build attempt with an authorized envelope keeps the
build's head identity on its row; history and reference summaries leave it
out, because the build stands for it, and it delivers no check of its own: the
build's check outbox reports the failure.

A completion that answers 201 or 200 for a build attempt, including the
completion of a plan replay, also consumes the grant and sets the running
build's `publication_id` in its transaction; the build's worker then records
the build `published`. Each request the API answers for a grant records an
outcome, so the worker can tell a consumer's failure from Mokly's; a request
the client abandoned before the answer records nothing. A transport error
while receiving a body also records nothing; a timeout still records
`unavailable`. Successful plan and blob answers leave the outcome unchanged. Outcomes rank
`accepted` first, then `rejected` and `plan-required`, then `unavailable`; a
later outcome replaces the recorded one only when it ranks at least as high,
so a refusal survives a retried 503 or an aborted sibling blob request.

| Grant outcome   | Answers that record it                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accepted`      | A completion that answered 201 or 200                                                                                                                         |
| `rejected`      | `upload-invalid-bundle`, `upload-unsupported-version`, `upload-too-large`, `upload-blob-mismatch`, `upload-unknown-blob`, `not-found` or a forbidden envelope |
| `plan-required` | `upload-plan-required`                                                                                                                                        |
| `unavailable`   | Admission, byte budget, timeout, `upload-incomplete`, `upload-expired` or internal failure                                                                    |
| None            | A plan that answered 200 or a blob that answered 204                                                                                                          |

### Ending Build Attempts

Every way a build attempt ends closes its unfinished uploads in the same
transaction as the build transition. This includes normal finalization,
infrastructure requeue, expired-lease recovery, cancellation and supersession.
Use the attempt's stored start time to select its uploads. Conditionally move
each still `uploading` or `validating` attempt to `failed` with `expired`,
release its file references and append its failed event. Leave ready
publications and already closed attempts unchanged. No unfinished upload or
its references outlive the build attempt. Each ending transaction follows the
[build and publication lock order](./persistence-boundaries.md#build-and-publication-lock-order).

Each upload closed by an ending transition has exactly one failure event.
Its event time equals the build transition time. Cleanup covers every
unfinished upload of that attempt, including concurrent admissions.
