# Catalogue Upload Validation v1

This document supplements the
[Catalogue Upload Exchange](./mokly-upload-exchange.md) with rejection
categories, upload limits, receiver validation and public fixtures.

## Rejections

Statuses map by value alone. A receiver may return
`{"error":{"code":"upload-invalid-bundle"}}` for other clients, but Mokly
does not read a rejection body.

| Rejection                                                                                   | HTTP status            | CLI category                      |
| ------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------- |
| Present non-2 manifest or ownership `schemaVersion`                                         | 426                    | `upload-unsupported-version`      |
| Invalid archive, missing manifest or marker version, malformed value/path, or byte mismatch | 400 or 422             | `upload-invalid-bundle`           |
| Any exceeded limit, including declared file size or path byte length                        | 413                    | `upload-too-large`                |
| Missing/invalid token or forbidden repository                                               | 401 or 403             | `upload-unauthorized`             |
| Blob digest outside the Plan, or unknown upload id                                          | 404                    | `upload-failed`                   |
| Complete while a listed digest is missing                                                   | 409                    | one re-plan, then `upload-failed` |
| Expired upload, or locally reached `expiresAt`                                              | 410                    | one re-plan, then `upload-failed` |
| Retryable status after five attempts                                                        | 408, 429, 500, 502–504 | `upload-failed`                   |
| Complete `200` for an upload with `uncommittedChanges: true`                                | 200                    | `upload-failed`                   |
| Other non-2xx or 2xx, redirect, or invalid response                                         | any other              | `upload-failed`                   |
| Command cancellation classified under Accounting And Output                                 | local                  | cancellation `upload-failed`      |
| Any non-cancellation local error, including an export recovery failure                      | local                  | its existing category and message |

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
versioned document's other fields. A missing upload manifest or ownership
`schemaVersion` is invalid (400/422). Any present version other than the number
`2`, including string `"2"` and manifest schema 1, is unsupported (426),
regardless of the document's other fields. For manifest schema 2, require
exactly the [documented fields](./mokly-upload.md#upload-manifest), including
the boolean `uncommittedChanges`; a missing, extra or wrongly typed field is
malformed (400/422). For ownership schema 2, apply the ownership document's
shape, portability, collision, digest and size rules. After required primitive types, check declared limits
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
before storing it. Apply the [publication rule](./mokly-upload.md#publication-rule):
a dirty upload is stored as its own publication and never claims or joins its
`headSha` and `configPath`. Unless a clean upload's identity already has a clean
publication, Complete only when every marker digest is stored; otherwise
answer 409. Authorize the
repository and hosting policy before exposing a catalogue. Exported HTML and
assets remain consumer-authored content; the envelope is not a sanitization or
sandboxing boundary.

## Public Fixtures

Both fixture files ship under `docs/protocol/fixtures` in the npm package, and
the packed-consumer smoke checks them with an independent reader.

[The manifest fixture](./fixtures/upload-manifest-v2.json) has root fixture
`schemaVersion: 1` and `cases`. Each case has a unique `name`, `valid`, the
`document` to validate, and, when invalid, `rejection`: `"unsupported-version"`
(426) or `"invalid"` (400/422). Valid cases include clean and dirty manifests
with and without comparisons. Rejections cover schema 1, other and string
versions, a missing version, a missing or non-boolean `uncommittedChanges`, an
extra field and invalid comparison pairing.

[The plan fixture](./fixtures/upload-plan-v1.json) has root fixture
`schemaVersion: 2`, `endpoint`, marker digests and independent Plan/Complete
`cases`. Cases have unique `name`, `valid`, `step` (`plan` by default), optional
`status` (default 200), optional `contentType` (default `application/json`; null
means absent), and `document` or raw `body`. Complete cases add `outcome`
(`published`, `already-published`, `replan`, `retry`, or an error category),
normalized `viewerUrl` or null, and optional `uncommittedChanges` (default
`false`), the uploaded manifest's value. Invalid Plan cases are
`upload-failed`. It covers every Plan field, content-type, status, URL and
placeholder boundary and each Complete outcome for clean and dirty uploads.
