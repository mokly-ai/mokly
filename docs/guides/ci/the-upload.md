---
title: "The upload"
description: "What publish sends, and what the receiving service is responsible for."
section: "ci"
order: 4
---

## Three requests

Publish talks to the endpoint you gave it in three steps and presents the
token as a bearer credential on every request. Every request goes to the
endpoint's own origin, the endpoint's path is never extended, and none follows
a redirect.

## The plan

Publish posts one small gzip-compressed tar archive to the exact endpoint. It
holds `mokly-upload.json`, the ownership marker that lists every exported file
with its SHA-256 digest and byte size, and the pinned comparison file when
comparisons are enabled. Nothing else is in it.

```http
Authorization: Bearer TOKEN
Content-Type: application/gzip
Accept: application/json
Content-Length: <bytes>
```

The service answers `200` with JSON: an upload id and its expiry time, the
sorted list of digests it does not yet hold, a blob URL containing the literal
placeholder `{sha256}`, and a completion URL. Both URLs must be on the
endpoint's own scheme, host and port; publish never sends the token elsewhere.

## The blobs

For each missing digest, publish sends the file's raw bytes to the blob URL
with the digest filled in, several files at a time.

```http
Authorization: Bearer TOKEN
Content-Type: application/octet-stream
Content-Length: <size from the marker>
```

Any `2xx` answer means the file is stored. `400` means the bytes did not match
the declared digest or size, and `404` means the digest was not part of the
plan.

## The completion

Publish posts to the completion URL with an empty body.

```http
Authorization: Bearer TOKEN
Accept: application/json
Content-Length: 0
```

`201` means a new publication is live, and `200` means the service already had
one for this revision and config path. When the JSON answer carries an absolute
`viewerUrl`, publish prints it after its success line. `409` means the service
still lacks files: publish plans once more, uploads what comes back, and
completes again; a second `409` fails.

## What the manifest says

`mokly-upload.json` names the Mokly version, the repository, the branch, the
head revision, the base ref and pinned base revision, the pull request number
when the job is running on one, the config path and the time the export
finished. Without comparisons, `baseRef`, `baseSha` and `comparisonPath` are
all `null`. Receivers must reject missing or extra manifest fields.

The source manifest the build writes is deliberately not part of the export:
it holds your source inventory and is not a public artifact.

## What the receiver must do

A service first authenticates the bearer credential. Only then does it
decompress the plan archive, enforcing size and file-count limits before
reporting version or structural failures. It validates the manifest's fields
and version, the marker's schema, digests, sizes and paths, and compares the
listed digests with what it already holds. Each stored blob must match its
declared digest and size. The service commits only once every listed digest is
present and answers `409` until then. Before exposing any catalogue, it checks
that the credential is allowed to publish for the repository the manifest
names.

Receivers accept only regular files. They reject symlinks, hard links,
devices, FIFOs, sparse files and other special entries in the plan archive,
and extract into an empty private directory so no path can escape it.

## Retries and timeouts

Each request times out after 120 seconds. A request that fails in transit, or
is answered `408`, `429`, `500`, `502`, `503` or `504`, is retried up to five
times with a growing, randomised delay of at most sixteen seconds, or the
delay a `Retry-After` header of up to sixty seconds asks for. Nothing is
retried after the plan's expiry time.

## When it is refused

| Result                                                                                          | Category                     |
| ----------------------------------------------------------------------------------------------- | ---------------------------- |
| The token or the repository was refused                                                         | `upload-unauthorized`        |
| The plan archive, manifest or marker was rejected, or a file's bytes did not match their digest | `upload-invalid-bundle`      |
| An upload limit was exceeded                                                                    | `upload-too-large`           |
| The manifest or marker declares an unknown version                                              | `upload-unsupported-version` |
| Anything else, including a timeout, an expired plan or a second `409`                           | `upload-failed`              |

A failed publish leaves the complete local export where it was written, so you
can look at exactly what would have been sent, and running it again resumes
from what the service already stored. The full contract is published under
Reference as the catalogue upload document.
