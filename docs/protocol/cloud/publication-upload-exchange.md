# Publication Upload Exchange

This is the plan, blob and completion exchange of
[Publication upload](./publication-upload.md). Mokly's
[upload exchange v1](../mokly-upload-exchange.md),
[upload validation v3](../mokly-upload-validation.md)
and
[export ownership v3](../mokly-export-ownership.md)
own the wire format and take precedence over this document, which records the
cloud receiver's choices where they leave room. The cloud adopts
this release's envelope, marker and index versions. The service
lifecycle is in [Publication ingest](./publication-ingest.md#delta-lifecycle).

## Plan Request

The plan request is `POST /v1/projects/{projectId}/publications` with the
publishing bearer and `Content-Type: application/gzip`. Its gzip tar holds
exactly `mokly-upload.json`, the root `.mokly-export-artifact` ownership
marker and the catalogue index `mokly-viewer/index.json`. The
CLI writes them in that order; the cloud requires the exact set and does not
depend on its order. Permitted PAX metadata does not add a namespace entry.
[Publication upload validation](./publication-upload-validation.md) defines
the archive limits, the schema 3 marker, the hosting policy and the index
checks, all applied to the declared catalogue.
Cloud builds use this same upload envelope 3, ownership marker 3 and index 9
contract with their attempt token.
[Build uploads](./publication-ingest.md#build-uploads) defines that token's
scope and deadline.

The server verifies the archived envelope and index bytes against their
declared digest and size before accepting the plan. It computes
and stores the marker itself. At plan time it stores the envelope, the marker
and the index through the ordinary content-addressed boundary, reserves every
declared file, and never includes those artifact hashes in `missing`.

## Plan Response

A successful plan is HTTP 200 with `Content-Type: application/json`,
`Cache-Control: no-store` and this shape:

```json
{
  "schemaVersion": 1,
  "upload": {
    "id": "<publication UUID>",
    "expiresAt": "2026-09-26T12:34:56.789Z"
  },
  "missing": ["<sha256>"],
  "blobUrl": "https://api.example/v1/projects/<projectId>/publication-uploads/<id>/blobs/{sha256}",
  "completeUrl": "https://api.example/v1/projects/<projectId>/publication-uploads/<id>/complete",
  "blobEncodings": ["gzip"]
}
```

`upload.id` is the attempt's publication ID, well within the released 255-byte
opaque-id limit. `expiresAt` is its UTC deadline with exactly three fractional
digits. `missing` contains unique hashes in ascending byte order, which for
lowercase hexadecimal equals the released JavaScript string order.

Both URLs start with the API's configured public origin, `MKC_API_ORIGIN`,
followed by the route path with each concrete segment percent-encoded once.
They carry no query or fragment. The literal `{sha256}` is the final path
segment of the blob URL. The CLI sends its bearer only to URLs whose scheme,
host and effective port equal its configured endpoint's, so publishers name
that same origin in `--endpoint`: `https://api.<domain>` for stable
environments, `https://<label>.preview.api.<domain>` for PR previews and the
configured local origin in development.

`missing` contains exactly the declared non-artifact hashes this project has
not stored durably, including hashes an earlier unfinished or expired attempt
made durable until collection removes them. Another project's stored copy of
the same bytes never satisfies it. When a ready publication already owns the
idempotency identity, the plan reserves nothing, uses an empty `missing` array
and records a replay attempt.

`blobEncodings` is optional. When it is present, it is exactly `["gzip"]`,
and the receiver can decode gzip for every Blob until this upload expires. When
it is absent, the CLI sends raw Blob bodies. The field does not change Plan v1.
A new Plan version was rejected because old CLIs ignore unknown fields and the
upstream contract keeps Plan v1.

## Blob Upload

`PUT /v1/projects/{projectId}/publication-uploads/{publicationId}/blobs/{sha256}`
uses the plan request's bearer rules and
`Content-Type: application/octet-stream`; a query string or another media type
is HTTP 400 with `upload-invalid-bundle`. A raw body has no `Content-Encoding`.
An encoded body has exactly `Content-Encoding: gzip`. Another content encoding
is HTTP 400 with `upload-invalid-bundle`. `Content-Length` is required and
always names the bytes sent on the wire. A raw value above 67,108,864 is HTTP
413 with `upload-too-large`. A gzip value greater than the reserved decoded
file size is HTTP 400 with `upload-invalid-bundle`. Zero-byte raw bodies are
valid.

After the bearer and these header checks, checks run in this order. An unknown
or foreign attempt is HTTP 404 with `not-found`. An owned attempt that is no
longer unfinished, or is past its deadline, is HTTP 410 with `upload-expired`.
A hash this attempt did not reserve, including a path segment that is not a
lowercase SHA-256 digest, is HTTP 404 with `upload-unknown-blob`. A
Raw `Content-Length` different from the reserved size is HTTP 400 with
`upload-blob-mismatch`, before any body byte is read. A reserved hash already
durable for the project answers 204; the server reads and discards either raw
or gzip bytes within the reception bound and stores nothing.

Each raw request holds its declared length from the process-wide [upload memory
budget](./publication-ingest.md#http-boundary) while buffering and verifying
the body. A gzip request holds both its encoded length and its reserved decoded
file size. Exhaustion is HTTP 503 with `upload-unavailable`; admission never
creates an unbounded wait. Body reception keeps the 120-second bound; a
timeout is HTTP 408 with `upload-timeout`. The server stores nothing until it
has read the complete body, decoded gzip when present, matched the decoded
size, computed SHA-256 itself and matched the reserved hash. Invalid gzip and
a decoded size mismatch are HTTP 400 with `upload-invalid-bundle`. A digest
mismatch is HTTP 400 with `upload-blob-mismatch`. A successful write answers
204 with no body.

Each storage write runs under the
[operation deadline](./publication-ingest.md#http-boundary) derived from the
attempt. A storage or durability-marker failure is HTTP 500 with
`upload-failed` and leaves the attempt and its reservations open, so the CLI's
retry can store the same hash.

## Completion

`POST /v1/projects/{projectId}/publication-uploads/{publicationId}/complete`
uses the same bearer rules and an empty body; a nonempty body is an invalid
bundle. After the bearer and attempt-ownership checks, completion resolves its
outcome in this order, so an identity that is already published completes
before stored digests are checked:

1. An attempt that itself became ready answers HTTP 201 with its receipt on
   every completion, including after retention expired it, so a retry after a
   lost response never turns into 200.
2. When another publication is ready for the attempt's identity (project, head
   SHA and config path), an unfinished attempt is closed as superseded and
   releases its references. A superseded attempt, including a ready replay
   recorded at plan time, answers HTTP 200 with that publication.
3. A superseded attempt whose identity has no ready publication any more, an
   attempt closed for any other reason and an unfinished attempt past its
   deadline answer HTTP 410 with `upload-expired`, and the CLI's single re-plan
   then publishes normally. No link to an earlier winner is stored.
4. While any reserved blob is not durable, completion answers HTTP 409 with
   `upload-incomplete`.
5. Otherwise the server publishes the attempt in one transaction that applies
   this order again. It answers HTTP 201, or HTTP 200 with the winner when a
   different upload committed the identity first. A completion that overlaps
   an earlier one for the same attempt answers 201 with the publication the
   earlier one made.

Both success statuses carry the receipt body with `Cache-Control: no-store`,
rendered from the publication's persisted state rather than a recorded copy.
Decision: the released protocol asks the receiver to record the first Complete
status and body; the cloud renders the receipt from persisted state instead,
because an attempt's own ready state, or its superseded state with the
publication ready for its identity, reproduces the same status on every retry.
Only a publication that stops being ready inside the attempt's hour changes
the answer, to 410, which the CLI resolves with its single re-plan.

An internal failure is HTTP 500 with `upload-failed` and leaves an unfinished
attempt open for the CLI's retry. A stored index that completion cannot load
is such a failure, never a 404.
[Publication ingest](./publication-ingest.md#completion) defines the exception
for an index that went missing. A bearer, repository or plan
refusal found by the ready transaction, or its deadline, closes the attempt.

## Expiry And Failure Mapping

Project-token attempts have a server-created sixty-minute deadline; build
attempts also respect their grant expiry. Retention uses it to
fail unfinished attempts and release their references. Unknown and foreign
attempt IDs are indistinguishable at HTTP 404. The
[REST reason catalogue](./rest-api.md#reason-catalogue) lists every upload
reason with its status and the condition that produces it; authentication,
repository authorization and plan authorization keep the mappings in
[Publication ingest](./publication-ingest.md#http-boundary).

The released CLI categorizes by status alone and reads no rejection body. It
retries 408, 429, 500, 502, 503 and 504 up to five attempts within the expiry,
re-plans once on a completion 409 or any 410, and fails on 404. On 426 it
stops without a retry and prints its own compatibility message, so the CLI
never shows the receiver's recovery text.
