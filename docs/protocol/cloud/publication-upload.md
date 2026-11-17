# Publication Upload

Mokly Cloud adopts the public [upload v3 contract](https://github.com/mokly-ai/mokly/blob/v0.19.0/docs/protocol/mokly-upload.md)
from the published `@mokly/mokly` package. The open repository
owns the wire format; this document defines the cloud receiver's choices where
it leaves room.
[Artifact compatibility](./mokly-artifact-compatibility.md) pins the
tested release and reproducible fixtures.

## Exchange

`mokly publish` runs a three-request exchange, defined in
[Publication upload exchange](./publication-upload-exchange.md). The plan
request carries one gzip tar holding only the envelope, the ownership marker
and the catalogue index `mokly-viewer/index.json`. The server
validates the whole declared catalogue from those artifacts, stores them,
reserves every declared file and answers with the hashes this project has not
stored. The CLI then sends each missing file as one raw or Plan-approved gzip
Blob request and completes the upload with an empty request, which publishes
it.

## Envelope And Versions

`mokly-upload.json` has exactly these ten required fields.
Nullable fields must still be present.

| Field           | Type / constraint                                            |
| --------------- | ------------------------------------------------------------ |
| `schemaVersion` | integer `3`                                                  |
| `moklyVersion`  | exact SemVer string, at most 255 UTF-8 bytes                 |
| `repository`    | exactly `host`, `owner`, `name`, all strings                 |
| `branch`        | nonempty string, at most 255 UTF-8 bytes, no controls        |
| `headSha`       | 40 or 64 lowercase hexadecimal characters                    |
| `baseRef`       | null or a nonempty, control-free string of at most 255 bytes |
| `baseSha`       | null or a full lowercase Git SHA as above                    |
| `pullRequest`   | null or integer in `1..=9007199254740991`                    |
| `configPath`    | safe repository-relative path; config bytes are not uploaded |
| `exportedAt`    | real UTC date/time, exactly `YYYY-MM-DDTHH:mm:ss.sssZ`       |

The envelope has no comparison path. With a comparison,
`baseSha` is the pinned merge base and `baseRef` is the effective base ref.
Without one, both are null. The catalogue index names the comparison
generation, as [upload validation](./publication-upload-validation.md#comparison-validation)
defines.

Repository hosts are lowercase DNS names/IPv4, without ports or userinfo,
at most 253 bytes. DNS labels are 1–63 ASCII letters/digits/hyphens with
alphanumeric endpoints. Owner (possibly slash-separated groups) and name
are at most 255 bytes each; segments use ASCII letters/digits/`.`/`_`/`-`
and cannot be `.` or `..`. Repository identity is an authorization
assertion, never proof of ownership.

The receiver accepts upload envelope 3, ownership marker 3 and catalogue
index 9 only. It accepts any syntactically valid producer
SemVer, including prerelease/build metadata: schema validation governs
acceptance independently of producer version. This is not a promise that
future schemas are supported. Every versioned artifact probes its version
before decoding its typed body. Unsupported envelope, marker or index versions
use HTTP 426. The artifact kind and the received version appear
in the internal error and logs, never in the client response. Envelopes 1 and
2, markers 1 and 2 and indexes 8 and earlier are all refused with that outcome.
[Artifact compatibility](./mokly-artifact-compatibility.md#version-boundary)
records why the receiver has no producer version floor.

## Validation And Limits

[Publication upload validation](./publication-upload-validation.md) defines the
plan archive's framing, quotas, ownership marker, hosting policy, index and
comparison checks. Authentication and workspace-plan
authorization precede decompression. The API rejects a declared compressed size above the limit
before reading and enforces the same limit on chunked or dishonest bodies.
Plan authorization runs again on every blob and completion request and before
the ready commit.

## Errors And HTTP Mapping

The upload reasons and their statuses are in the
[REST reason catalogue](./rest-api.md#reason-catalogue); the
[exchange failure mapping](./publication-upload-exchange.md#expiry-and-failure-mapping)
gives the released CLI's reaction to each status, and
[Publication ingest](./publication-ingest.md#http-boundary) the authorization
order. Cloud chooses 400 from the producer's permitted 400/422 alternatives.
Internal failures keep their source and caller in diagnostics. Never reflect
raw parser/transport diagnostics or credentials in a client response. Answer
a plan only after complete validation and the reservation transaction, and a
completion only after the ready transaction.

## Bundle, Storage And Idempotency

Plan validation yields the typed envelope and marker, the index fields that
the receiver reads and the artifacts' exact bytes. It performs
no filesystem extraction or writes, and it buffers only the accepted artifact
bodies, within the decompressed ceiling and the shared process upload-memory
budget. Callers bound concurrent requests.

Retain every declared regular file byte-for-byte in project-owned,
content-addressed storage. Equal bytes share one copy across that project's
publications, never across projects. Keep the envelope and marker as private
ingest metadata. Expose the index and every other declared file only on the
per-publication sandbox catalogue origin. The plan stores the
index bytes, and completion, check delivery and the screens list read that
stored index. Discard gzip/tar framing, directories, PAX
metadata, uid/gid, modes and times. No archive metadata grants filesystem
permissions.

The publication service uses `(authorized project id, headSha, configPath)` as
its unique idempotency key. The first upload to complete wins; a later upload
of that identity completes with the existing publication, even if bytes or
comparison base differ. Validate and authenticate each plan first. Failed
uploads reserve no key. This cloud policy adds no exactly-once promise to the
CLI, and the receiver cannot verify that the producer published from a clean
committed checkout; the CLI's own checkout checks are described in
[Publish smoke](../../ops/publish-smoke.md#clean-checkout-failures).
