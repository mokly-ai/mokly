---
title: "The upload"
description: "What publish sends, and what the receiving service is responsible for."
section: "ci"
order: 4
---

## Keep the checkout clean

Publish requires a clean checkout before export and again before upload.
Git-ignored files, this run's output directory, and Mokly's own caches and
temporary files never count. Committed generated files count and must match the
build. Derived generated output must be ignored by Git.

A build step that changes tracked files or leaves files that Git does not ignore
stops the publish. Commit generated changes before the job runs. Add build
products to `.gitignore`. Use `npm ci` to install from the committed lockfile
without changing it.

## Three steps

Publish talks to the endpoint you gave it in three steps and presents the
token as a bearer credential on every request. Every request goes to the
endpoint's own origin, the endpoint's path is never extended, and none follows
a redirect.

## The plan

Publish posts one small gzip-compressed tar archive to the exact endpoint,
which is the service's plan route. It holds `mokly-upload.json`, the ownership
marker that lists every exported file with its SHA-256 digest and byte size,
and the pinned comparison file when comparisons are enabled. Nothing else is
in it.

```http
Authorization: Bearer TOKEN
Content-Type: application/gzip
Accept: application/json
Content-Length: <bytes>
```

The service answers `200` with JSON: an upload id and its expiry time, the
sorted list of digests it does not yet hold, a blob URL containing the literal
placeholder `{sha256}`, and a completion URL. Publish takes both URLs only from
this answer and never builds them from the endpoint. Both must be on the
endpoint's own scheme, host and port and use HTTP or HTTPS; `blob:` and other
schemes are refused before a request. Publish never sends the token elsewhere.

## The blobs

For each missing digest, publish sends the file's raw bytes to the blob URL
with the digest filled in, up to the CLI's `--upload-concurrency` limit at a
time.

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

`201` means this upload created the publication. Repeating Complete for that
upload returns its first status and body and never publishes again. `200` means
a different upload already completed this revision and config path, so the
service kept and returned the first publication; publish then prints
`Mokly catalogue already published for this commit.` instead of counts. Any
other `2xx` fails. When the JSON answer carries an accepted absolute
`viewerUrl`, publish prints it after success. `409` means the service still
lacks files and `410` means expiry: publish plans once more, uploads what comes
back, and completes again; a second `409` or `410` fails.

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
and version, the marker's schema, digests, sizes and paths, stores the two or
three archived artifacts once their bytes match their digests, and compares the
remaining digests with every verified Blob stored for that project, including
content received for an unfinished or expired upload. Each stored Blob must
match its declared digest and size. An integer declared size above 64 MiB or a
path above 1,024 UTF-8 bytes receives `413`; malformed values and path grammar
receive `400` or `422`. The service commits only when every listed digest is
present and answers `409` until then. It keeps the first publication completed
for a revision and config path. Before exposure, it checks that the credential
is allowed to publish for the repository named by the manifest.

Receivers accept only regular files. They reject symlinks, hard links,
devices, FIFOs, sparse files and other special entries in the plan archive,
and extract into an empty private directory so no path can escape it.

## Retries and timeouts

Each request times out after 120 seconds. A request that fails in transit, or
is answered `408`, `429`, `500`, `502`, `503` or `504`, is tried at most five
times. Random waits before attempts two through five are at most 1, 2, 4 and 8
seconds, or the delay a valid `Retry-After` of up to sixty seconds asks for.
Nothing is retried at or past Plan expiry; publish instead plans once more, as
after a `410`, and everything already stored stays held.

## Counts and cancellation

The uploaded count includes marker entries whose digest matches a file sent in
the Plan archive and every entry sharing a digest whose Blob PUT was attempted
in this command. Every other marker entry is unchanged. Progress applies the same rule
per round, begins with Plan files, and advances all entries sharing a completed
digest. It says `Uploading 0 of 1 file · <size>` for one file and uses `files`
otherwise; an empty `missing` set shows no progress label.

Cancellation prints
`[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.`
If Mokly could not put your previous export back, it prints the recovery error
with the folder to recover instead, even when you cancelled.
An exhausted transport failure instead tells the reader to check the endpoint
and connection, then retry.

## When it is refused

| Result                                                                          | Category                     |
| ------------------------------------------------------------------------------- | ---------------------------- |
| The token or the repository was refused                                         | `upload-unauthorized`        |
| The Plan archive, manifest or marker was malformed, or Blob bytes did not match | `upload-invalid-bundle`      |
| An upload limit or declared size/path byte limit was exceeded                   | `upload-too-large`           |
| The manifest or marker declares an unknown version                              | `upload-unsupported-version` |
| Anything else, including a timeout or a second `409` or `410`                   | `upload-failed`              |

A failed publish leaves the complete local export where it was written, so you
can look at exactly what would have been sent, and running it again resumes
from what the service already stored. The full contract is published under
Reference as the catalogue upload document.
