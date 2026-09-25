---
title: "Upload receiver"
description: "The request, responses, manifest, archive rules and limits for a service that accepts catalogue uploads."
section: "reference"
order: 2
---

## The request

`mokly publish` sends one `POST` to the exact endpoint it was given, without
adding a path:

```http
Authorization: Bearer TOKEN
Content-Type: application/gzip
Accept: application/json
Content-Length: <archive bytes>
```

The body is the export as one gzip-compressed POSIX tar archive: USTAR, with
PAX extended headers when a path needs them. It is not multipart form data and
carries no `Content-Encoding`. The command follows no redirect, retries nothing
and gives up after 120 seconds. A request can reach the service even when
`publish` reports a failure, and running `publish` again sends a new upload
with nothing to mark it as a repeat.

Issue tokens that match `[A-Za-z0-9._~+/-]+=*`, the bearer token grammar the
command accepts.

## Responses

Respond once validation is complete. Any `2xx` status accepts the upload, and
no response body is needed; `204 No Content` is a good choice. `publish` then
prints `Published Mokly catalogue.` and exits `0`.

| Status           | Use it when                                         | Category reported by `publish` |
| ---------------- | --------------------------------------------------- | ------------------------------ |
| `400` or `422`   | The archive or a manifest is invalid                | `upload-invalid-bundle`        |
| `401` or `403`   | The token or its access to the repository is denied | `upload-unauthorized`          |
| `413`            | The upload exceeds a limit                          | `upload-too-large`             |
| `426`            | The upload manifest's `schemaVersion` is unknown    | `upload-unsupported-version`   |
| Any other status | Anything else, including a redirect                 | `upload-failed`                |

A timeout or network failure is also `upload-failed`. The command reads only
the status: it never prints response bodies or headers, so a body such as
`{"error":{"code":"upload-invalid-bundle"}}` serves other clients only. Every
refusal makes `publish` exit `1` and leaves the complete export on disk.

## The upload manifest

The archive root holds `mokly-upload.json`, UTF-8 JSON with exactly these
fields and no others:

| Field            | Type           | Value                                                                   |
| ---------------- | -------------- | ----------------------------------------------------------------------- |
| `schemaVersion`  | number         | `1`                                                                     |
| `moklyVersion`   | string         | The exact SemVer version of Mokly that made the export, up to 255 bytes |
| `repository`     | object         | The repository the upload claims: `host`, `owner` and `name`            |
| `branch`         | string         | The branch published, 1 to 255 bytes with no control characters         |
| `headSha`        | string         | The checked-out commit: 40 or 64 lowercase hexadecimal characters       |
| `baseRef`        | string or null | The base ref compared against, 1 to 255 bytes                           |
| `baseSha`        | string or null | The branch-point commit compared against, in the same form as `headSha` |
| `pullRequest`    | number or null | The pull request number, a positive integer                             |
| `configPath`     | string         | The Mokly config file's path from the repository root                   |
| `exportedAt`     | string         | When the export finished, in UTC as `YYYY-MM-DDTHH:mm:ss.sssZ`          |
| `comparisonPath` | string or null | `__mokly/diffs/__generations/<64 hex characters>/review.json`           |

`baseRef`, `baseSha` and `comparisonPath` are all `null` when the catalogue is
published with `--no-changes`, and all set otherwise. When they are set,
`comparisonPath` names the one comparison in the archive, whose `baseRef` and
`baseCommit` equal the manifest's `baseRef` and `baseSha`. `baseSha` is the
branch point, not the current tip of `baseRef`.

`branch` is the pull request's head branch in a GitHub Actions pull request
run and the checked-out branch elsewhere; a detached checkout reports `HEAD`.
`pullRequest` is set only in a GitHub Actions pull request run. The export can
include uncommitted changes on top of `headSha`, and `exportedAt` comes from
the publishing machine's clock. The config file itself is not uploaded.

`repository.host` is a lowercase DNS name or IPv4 address without a port, up to
253 bytes. `owner` is one or more `/`-separated segments, such as a group and
its subgroup, and `name` is one segment; each of the two is up to 255 bytes.
Segments use ASCII letters, digits, `.`, `_` and `-`, and are never `.` or
`..`. The identity comes from the checkout's Git remote or from `--repository`,
so treat it as a claim to authorize rather than as proof.

## Archive contents

Archive paths are relative to the export root, with no enclosing directory. A
complete upload holds `mokly-upload.json`, the ownership marker
`.mokly-export-artifact`, `index.html`, `404.html` and the rest of the export
described on the Export files page. The marker lists every file in the archive
except itself, including `mokly-upload.json`; accept an upload only when the
archive holds exactly those files and the marker.

## Validating an upload

Authenticate the token before decompressing anything, then enforce the limits
below before reporting version or structural problems. Answer `400` or `422`
when:

- the gzip stream or tar archive is invalid or truncated, or has data after
  the archive's end;
- an entry is not a regular file or a directory, such as a symlink, hard link,
  device, FIFO or sparse file;
- a path is absolute, has an empty, `.` or `..` segment, contains a backslash,
  colon or control character, or is not valid UTF-8;
- two paths are equal after lowercasing with JavaScript's `toLowerCase()`, or
  one path is both a file and a directory;
- a JSON file has a duplicate key, the upload manifest has a missing or extra
  field, or a value has the wrong type or form;
- the ownership marker has an unknown `schemaVersion` or lists files other
  than those in the archive; or
- the comparison named by `comparisonPath` is missing or disagrees with the
  manifest, or an upload without one contains comparison files.

PAX headers may set only a path, a size and ordinary file metadata. Extract
into an empty private directory, and ignore stored owners, permissions and
timestamps. Before serving anything, check that the token may publish for the
manifest's repository. The upload carries the repository's own HTML and assets
unchanged, so serve each catalogue from an origin of its own.

## Limits

These are the ceilings of this upload version. `publish` checks them before
sending, and a receiver may set lower quotas and answer `413`. Sizes are
binary: 1 MiB is 1,048,576 bytes.

| Limit                                                  | Maximum     |
| ------------------------------------------------------ | ----------- |
| Compressed request body                                | 100 MiB     |
| Uncompressed tar stream, including headers and padding | 512 MiB     |
| One file                                               | 64 MiB      |
| Files, including the manifest and ownership marker     | 20,000      |
| Upload manifest                                        | 16 KiB      |
| Path                                                   | 1,024 bytes |
