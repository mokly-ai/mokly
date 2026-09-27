# Catalogue Upload Exchange v1

## Delivery Status And Boundary

The installed `mokly publish` implements this Plan → Blobs → Complete exchange.
The [CLI and manifest contract](./mokly-upload.md) owns repository metadata; the
[ownership contract](./mokly-export-ownership.md) owns the content address
list. This document owns all exchange and receiver behavior.

## Upload Exchange

Every request carries `Authorization: Bearer TOKEN`, times out after 120
seconds including the response-body read, uses manual redirect handling, and
follows no redirect. Plan, Blob and Complete URLs must be absolute `http:` or
`https:` URLs without userinfo. Their scheme, hostname and effective port must
equal the configured endpoint's, so the bearer credential is never sent to a
different origin or protocol.

### Plan

POST to the exact configured endpoint, preserving its path and query string
without appending anything:

```http
Authorization: Bearer TOKEN
Content-Type: application/gzip
Accept: application/json
Content-Length: <bytes>
```

The body is one gzip-compressed POSIX tar archive, USTAR with PAX extended
headers when needed. It contains only regular root-relative files, with no
enclosing directory, in fixed order: `mokly-upload.json`,
`.mokly-export-artifact`, then the non-null `comparisonPath` review file.

The two or three files are byte-identical to the finalized export. No other
entry is permitted. Success is `200` with `Content-Type: application/json`,
optionally with media-type parameters, and this response shape. These example
URLs are Mokly Cloud's; receiver paths are otherwise opaque to the CLI:

```json
{
  "schemaVersion": 1,
  "upload": {
    "id": "<opaque string>",
    "expiresAt": "2026-09-26T12:15:00.000Z"
  },
  "missing": ["<sha256>", "<sha256>"],
  "blobUrl": "https://api.mokly.ai/v1/projects/<projectId>/publication-uploads/<id>/blobs/{sha256}",
  "completeUrl": "https://api.mokly.ai/v1/projects/<projectId>/publication-uploads/<id>/complete"
}
```

- `schemaVersion` is the number `1`. `upload.id` is a nonempty opaque string
  of at most 255 UTF-8 bytes. `upload.expiresAt` uses the upload manifest's
  exact timestamp format.
- `missing` is strictly ascending in JavaScript string order and unique. Each
  item is exactly 64 lowercase hexadecimal characters and equals a `sha256`
  in the ownership marker. It may be empty.
- `blobUrl` contains the literal `{sha256}` exactly once and before any `?` or
  `#`. The CLI counts and substitutes that literal in the raw string before
  URL parsing because WHATWG parsing percent-encodes braces. Encoded
  `%7Bsha256%7D` is not a placeholder. After substitution, the digest must be
  in the URL pathname.
- `blobUrl` and `completeUrl` obey the request-boundary URL rule above.
  `blob:`, `data:`, `file:` and every other scheme are invalid even if URL
  parsing exposes the endpoint's origin.
- Unknown fields are ignored. A missing or invalid field, another 2xx status,
  a body over 16 MiB, invalid JSON, or a non-JSON content type is
  `upload-failed`.

At Plan time the receiver verifies and stores the manifest and optional review
after matching their marker digests and sizes. It never lists those digests in
`missing`. If a publication already exists for this `headSha` and `configPath`,
it answers `missing: []`; Complete then resolves the keep-first result below.

[The plan fixture](./fixtures/upload-plan-v1.json) has root fixture
`schemaVersion: 1`, `endpoint`, marker digests and independent Plan/Complete
`cases`. Cases have unique `name`, `valid`, `step` (`plan` by default), optional
`status` (default 200), optional `contentType` (default `application/json`; null
means absent), and `document` or raw `body`. Complete cases add `outcome`
(`published`, `already-published`, `replan`, `retry`, or an error category) and
normalized `viewerUrl` or null; invalid Plan cases are `upload-failed`. It
covers every field, content-type, status, URL and placeholder boundary here.

### Blobs

For each distinct digest in `missing`, in parallel up to the configured
concurrency limit:

```http
PUT <blobUrl with {sha256} replaced>
Authorization: Bearer TOKEN
Content-Type: application/octet-stream
Content-Length: <size from the marker>
```

The body is the exact file bytes for that digest. Marker entries sharing a
digest require one PUT. Any 2xx means stored; receivers return 204 with no
body. `400` means the bytes did not match the declared digest or size. `404`
means the digest is outside this Plan or the upload id is unknown. `410` means
the upload expired and consumes the command's single re-plan. The first failed
Blob cancels in-flight requests and starts no new ones.

### Complete

After every requested Blob succeeds, POST the receiver-provided completion URL
with no body:

```http
Authorization: Bearer TOKEN
Accept: application/json
Content-Length: 0
```

Complete is idempotent per upload id. The first successful Complete for an
upload records both its status and exact response body. Repeating Complete for
that upload returns the same status and body and never creates another
publication. A lost `201` response can therefore be retried without changing
the publication or turning it into `200`.

`201` means this upload created the first publication for its `headSha` and
`configPath`. `200` means a different upload already completed that identity;
the receiver keeps and returns that first publication unchanged. For
overlapping uploads, the one that completes first receives `201`; the other
receives `200`. The receiver resolves this before checking stored digests, so
an upload of an already published identity completes with `200` even when it
sent no blobs. Any other 2xx is `upload-failed`.

Success does not depend on its optional
`{ "id", "projectId", "state", "catalogueUrl", "viewerUrl" }` body. Use
`viewerUrl` only from a JSON object no larger than 16 MiB when it parses as an
absolute HTTP(S) URL; print normalized `href`, never raw input. An unusable body
does not fail or retry. Omit a URL containing the token or its URI encoding.

`409` means the receiver still lacks a listed digest and `410` means the upload
expired. Either begins one fresh Plan for the whole command. A second `409`,
`410`, or local expiry is `upload-failed`. `404` means an unknown or foreign
upload id and fails without re-planning.

### Retries And Expiry

Plan, Blob and Complete requests are tried at most five times. Retry only 408,
429, 500, 502, 503 and 504, plus transport failures such as fetch rejection,
attempt timeout, or an interrupted response before its result is known. Before
attempts 2, 3, 4 and 5, wait a uniformly random duration from zero through 1,
2, 4 and 8 seconds respectively. An integer `Retry-After` from 0 through 60
seconds, digits only, replaces that wait; every other value is ignored.

Blob and Complete attempts and waits may not reach or pass `upload.expiresAt`.
Do not start an attempt at or after expiry, and do not begin a wait that would
end at or after it. Local expiry consumes the same one re-plan as 409 and 410.
Receivers choose an expiry long enough for a complete upload; Mokly Cloud
allows sixty minutes. Command cancellation stops attempts and waits immediately
with the cancellation output below. Exhausted retries use the transport-failure
output below.

## Accounting And Output

Accounting is by digest but reports marker entries. For the entire command,
form the union of SHA-256 digests of every Plan-archive file and every digest
sent through at least one Blob PUT attempt in any round. `<uploaded>` is the number of marker
entries whose digest is in that union; entries sharing one digest each count.
`<unchanged>` is every remaining marker entry. The ownership marker itself is
not a marker entry and is in neither count. A first publish to an empty
receiver therefore reports `0 unchanged`, and a lost PUT response followed by
a re-plan still counts that digest as uploaded.

Rich progress is per Plan round. Hash each Plan-archive file and combine those
digests with that round's `missing` set. `<total>` is the number of marker
entries whose digest is in that combined set. `<n>` begins at the number whose
digest belongs to any Plan-archive file, then advances by every marker
entry sharing a digest when that digest's PUT completes. `<size>` is the sum
of byte sizes once per distinct combined digest, including all Plan-archive
files; the marker's own byte length participates even though it is not an
entry. A re-plan restarts at that round's initial `<n>`, `<total>` and `<size>`.
A round with empty `missing` shows no progress label. In one round, its final
`<n>` equals the summary's `<uploaded>`.

The progress label uses binary units, whole bytes below 1 KiB and one decimal
place from KiB upward. Its exact singular and plural forms are:

```text
Uploading 0 of 1 file · <size>
Uploading 0 of 2 files · <size>
```

A `201` completion prints exactly one counted summary, followed by the viewer
URL on its own line when accepted:

```text
Published Mokly catalogue. 1 file uploaded, <unchanged> unchanged.
Published Mokly catalogue. 2 files uploaded, <unchanged> unchanged.
```

Zero and every value other than one use `files`. `unchanged` is not followed
by a noun and does not pluralize. A `200` completion replaces the counted line
with `Mokly catalogue already published for this commit.` and may print the
kept publication's viewer URL. Rich mode uses the same wording after its
success glyph and before its duration.

Cancellation keeps category `upload-failed`. Plain mode prints exactly:

```text
[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.
```

Rich mode uses headline `Publication was cancelled.`, no detail line, and hint
`Run mokly publish again when you are ready.` It never shows a connection hint
for cancellation.

An exhausted retry or transport failure uses this exact plain line:

```text
[mokly/upload-failed] The catalogue upload did not complete. Check the endpoint and connection, then retry.
```

Rich mode uses headline `The catalogue upload did not complete.`, no detail
line, and the distinct hint `Check the endpoint and connection, then retry.`
Raw response bodies, headers, URLs, credentials and transport exception text
never enter either mode.

## Rejections

Statuses map by value alone. A receiver may return
`{"error":{"code":"upload-invalid-bundle"}}` for other clients, but Mokly
does not read a rejection body.

| Rejection                                                                       | HTTP status            | CLI category                      |
| ------------------------------------------------------------------------------- | ---------------------- | --------------------------------- |
| Unsupported envelope or present non-2 ownership `schemaVersion`                 | 426                    | `upload-unsupported-version`      |
| Invalid archive, missing marker version, malformed value/path, or byte mismatch | 400 or 422             | `upload-invalid-bundle`           |
| Any exceeded limit, including declared file size or path byte length            | 413                    | `upload-too-large`                |
| Missing/invalid token or forbidden repository                                   | 401 or 403             | `upload-unauthorized`             |
| Blob digest outside the Plan, or unknown upload id                              | 404                    | `upload-failed`                   |
| Complete while a listed digest is missing                                       | 409                    | one re-plan, then `upload-failed` |
| Expired upload, or locally reached `expiresAt`                                  | 410                    | one re-plan, then `upload-failed` |
| Retryable status after five attempts                                            | 408, 429, 500, 502–504 | `upload-failed`                   |
| Other non-2xx or 2xx, redirect, invalid response, or cancellation               | any other              | `upload-failed`                   |

Local validation uses the same categories. Other local typed failures remain
unchanged, and no request follows export failure. Unexpected preparation is
`upload-failed` with fixed product copy. Failed publication leaves the complete
local export in place.

## Export Files And Limits

The marker and verified blobs reconstruct every public artifact, including the
manifest, shells, static assets and enabled comparisons. Source
`mokly-manifest.json` stays private. CLI and receiver enforce these binary-unit
v1 ceilings; receivers may impose lower quotas and return 413.

| Limit                                                    | Maximum           |
| -------------------------------------------------------- | ----------------- |
| Plan request body, compressed                            | 100 MiB           |
| Plan archive decompressed, including headers and padding | 512 MiB           |
| One regular file, Blob or ownership marker               | 64 MiB            |
| Regular files, including manifest and marker             | 20,000            |
| Upload manifest                                          | 16 KiB            |
| Relative path                                            | 1,024 UTF-8 bytes |
| Plan or Complete response body read by the CLI           | 16 MiB            |

## Receiver Validation

Authenticate before decompression. Enforce compressed, decompressed, entry
count and individual-entry limits before reporting version or structural
failures. Reject invalid gzip or tar, truncation, trailing non-padding data,
duplicate entries, unexpected Plan files, duplicate JSON keys and special
filesystem entries: symlinks, hard links, devices, FIFOs and sparse files are
all invalid. PAX metadata may specify only effective path and size plus ordinary
file metadata; it cannot authorize links or escapes. Extract into an empty
private staging directory and never trust stored ids, modes, timestamps or
paths as filesystem authority.

After bounded extraction and JSON decoding, version validation precedes the
versioned document's other fields. A missing ownership `schemaVersion` is
invalid (400/422). Any present ownership version other than the number `2`,
including string `"2"`, is unsupported (426), regardless of its `files` value.
For schema 2, apply the ownership document's shape, portability, collision,
digest and size rules. After required primitive types, check declared limits
before remaining entry grammar: an integer size over 64 MiB or a string path
over 1,024 UTF-8 bytes is too large (413). A negative, fractional or nonnumeric
size and every other path-grammar violation is malformed (400/422).

Require entries for `index.html`, `404.html` and `mokly-upload.json`. Archived
manifest/review bytes match their entries; review path and base metadata match
the manifest and [comparison format](./README.md#supported-formats).
Current-only uploads contain no comparison files.

Answer `missing` from every verified blob stored for the same project,
including a blob received for an unfinished or expired earlier upload. Never
expose another project's content membership. Verify every Blob digest and size
before storing it. Unless the identity is already published, Complete only
when every marker digest is stored; otherwise answer 409. Authorize the repository and hosting policy before exposing a
catalogue. Exported HTML and assets remain consumer-authored content; the
envelope is not a sanitization or sandboxing boundary.
