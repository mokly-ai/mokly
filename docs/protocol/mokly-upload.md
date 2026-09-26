# Catalogue Upload v1

## Delivery Status And Boundary

The content-addressed exchange below is the approved contract tracked by
[Delta Publishing](../../plans/delta-publishing.md); the installed CLI sends
its earlier single-archive request until that plan's CLI milestones land.
Nothing is live, so the earlier exchange is replaced, not kept beside this one.
Receivers, hosted or self-hosted, need only the published `@mokly/mokly`
package and these documented artifacts; Mokly Cloud has no special protocol.
`mokly export` remains local-only. `mokly publish` exports, then runs one
plan → blobs → complete exchange so a receiver stores only the files it lacks.
The `mokly-upload.json` envelope keeps `schemaVersion: 1`; the ownership marker
is [schema 2](./mokly-export-ownership.md) and the plan response is its own v1.

## CLI

```bash
npx mokly publish --endpoint https://api.mokly.ai/v1/projects/<projectId>/publications --token TOKEN
npx mokly publish --out .context/site --config tools/mokly.config.ts --base main
npx mokly publish --no-changes --repository git.example.com/team/project
npx mokly publish --upload-concurrency 4
```

Install `@mokly/mokly` first, or use `npx --package @mokly/mokly mokly publish`.
Explicit `--endpoint` and `--token` override `MOKLY_ENDPOINT` and `MOKLY_TOKEN`.
Both are required; empty values fail before export. The endpoint is the
absolute HTTP(S) URL of the receiver's plan route, without userinfo or a
fragment and with its query string preserved; for Mokly Cloud it is
`https://api.mokly.ai/v1/projects/<projectId>/publications`. The CLI posts the
plan to it exactly and never appends a path; the blob and complete URLs come
only from the plan response and are never derived from the endpoint. HTTPS is
recommended for remote services; HTTP supports local receivers. Tokens use the bearer-token grammar
`[A-Za-z0-9._~+/-]+=*`. Tokens never appear in CLI output, including errors and
diagnostic stacks. Response bodies, response headers and transport exceptions
are not printed. Redirects are never followed; the only retries are the
documented schedule below. `--upload-concurrency <n>` bounds parallel blob
uploads to an integer from 1 to 32 (default 8); other values, or the option on
another command, fail as `cli-invalid`. The composite action forwards no
concurrency input.

Value options also accept `--name=value`. Use `--token=-TOKEN` for a credential
beginning with `-`, or set `MOKLY_TOKEN`. Split only at the first `=`, preserving
token padding and URL queries. Empty assigned values fail; boolean options such
as `--no-changes` reject assignments. A separate value beginning with `-` remains
ambiguous and fails as a missing value; use the assigned form instead.

`--out` defaults to `.context/mokly-publish` beside the config. Relative paths
resolve beside the loaded config; all [export confinement and ownership
rules](./mokly-export.md) apply. `--config` uses normal discovery. Comparisons
are included by default: `--base` overrides `review.base` (default `origin/main`).
`--no-changes` skips baseline lookup and comparison generation, including removed
entries and comparison assets/controls. It rejects an explicit `--base`.
Both modes build and validate the catalogue. Publish requires a Git checkout
with a commit even without comparisons, to identify the uploaded revision.
Derived catalogues rebuild the pinned baseline only when comparisons are enabled;
`--no-changes` requires neither that history nor a historical install/build.
Uncommitted authoring changes are permitted: `headSha` identifies checkout
context, not a claim that every exported byte exists at that commit.

`--repository <host>/<owner>/<name>` overrides remote detection. Otherwise use
`origin`, or the sole remote if `origin` is absent; multiple other remotes are
ambiguous and fail. HTTPS, SSH URLs and scp-style Git remotes are supported.
Local paths are not repository identities. Remove one trailing `.git` suffix.
Host is lowercase DNS/IPv4 without a port. Owner may contain slash-separated
groups (for example GitLab subgroups); repository name is one segment. Segments
contain only ASCII letters, digits, `.`, `_`, `-`, and cannot be `.` or `..`.
Credentials in remote URLs are discarded and never printed.

Branch is `GITHUB_HEAD_REF` in GitHub Actions PR runs, otherwise
`GITHUB_REF_NAME` for branch runs (`GITHUB_REF_TYPE=branch`), otherwise Git's
symbolic branch. Detached checkouts fall back to `HEAD`; `headSha` is always
the actual checked-out commit, never a substituted PR SHA. `pullRequest` is
the positive number in Actions `GITHUB_REF=refs/pull/<number>/merge` or `/head`,
otherwise null. Read Actions context only when `GITHUB_ACTIONS=true`.
For PR-head semantics, check out the head explicitly as in the action guide.

## Upload Exchange

Every request carries `Authorization: Bearer TOKEN`, times out after 120
seconds, follows no redirect and goes only to the endpoint's origin: the CLI
never sends the bearer to another scheme, host or port.

### Plan

POST to the exact endpoint, without appending a path, with:

```http
Authorization: Bearer TOKEN
Content-Type: application/gzip
Accept: application/json
Content-Length: <bytes>
```

The body is one gzip-compressed POSIX tar archive (USTAR with PAX extended
headers when needed, regular files only, paths relative to the export root with
no enclosing directory) containing exactly the artifact files, byte-identical to
the export: `mokly-upload.json`, `.mokly-export-artifact`, and the review file at
the envelope's `comparisonPath` when it is not null. No other entries; receivers
reject any other archive as an invalid bundle.

Success is `200` with `Content-Type: application/json` (media-type parameters
are permitted) and this body. The URL paths are the receiver's own and opaque
to the CLI; these are Mokly Cloud's:

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

- `schemaVersion` must be the number `1`. `upload.id` is an opaque nonempty
  string of at most 255 bytes. `upload.expiresAt` uses the envelope's
  `exportedAt` format.
- `missing` is sorted ascending, unique, may be empty, and every item is 64
  lowercase hex characters equal to a `sha256` in the marker.
- `blobUrl` is an absolute URL whose path contains the literal characters
  `{sha256}` exactly once, unencoded. The CLI checks and substitutes the
  placeholder on the raw string before parsing the result, so an encoded
  `%7Bsha256%7D` is not a placeholder. `completeUrl` is an absolute URL. Both
  must have the endpoint's scheme, host and port, and both are taken only from
  this response.
- Unknown fields are ignored. A missing or invalid field, another 2xx status,
  a body over 16 MiB, invalid JSON or a non-JSON content type is
  `upload-failed`.

[The plan fixture](./fixtures/upload-plan-v1.json) ships in the package for
independent receivers and the CLI validator. Its root has `schemaVersion: 1`
(fixture format), the `endpoint` the cases were planned against, `marker` (the
digests that marker lists) and `cases`, each with a unique `name`, `valid`, an
optional `status` (default 200) and `contentType` (default `application/json`;
`null` means absent), and either `document`, a JSON value serialized as the
body, or `body`, raw text. Every invalid case is `upload-failed`.

### Blobs

For each digest in `missing`, in parallel up to the concurrency limit:

```http
PUT <blobUrl with {sha256} replaced>
Authorization: Bearer TOKEN
Content-Type: application/octet-stream
Content-Length: <size from the marker>
```

The body is the raw bytes of the file with that digest; files sharing a digest
are uploaded once. Any 2xx means stored (receivers return 204 with no body).
`400` means the bytes did not match the declared digest or size:
`upload-invalid-bundle`. `404` means the digest is not part of this plan:
`upload-failed`. The first failed blob cancels the remaining uploads.

### Complete

After every blob succeeded:

```http
POST <completeUrl>
Authorization: Bearer TOKEN
Accept: application/json
Content-Length: 0
```

`201` means a new publication is live. `200` means the receiver already had a
publication for this `headSha` and `configPath` and returned it. The body is
`{ "id", "projectId", "state", "catalogueUrl", "viewerUrl" }`. When
`viewerUrl` is an absolute http(s) URL string in a JSON body of at most 16 MiB,
the CLI prints it on its own line after the success line; otherwise it prints
the success line alone, and an unreadable body does not fail the command. `409`
means the receiver still misses blobs: run Plan once more, upload the returned
set, complete again; a second `409` is `upload-failed`.

### Retries And Expiry

Blob PUTs and Complete are idempotent, so retrying is safe. Plan, blob and
complete requests retry on 408, 429, 500, 502, 503 and 504 and on transport
failures (connection errors, timeouts, interrupted responses): at most five
attempts per request. The wait before attempt _k_ (2 to 5) is a uniformly
random duration between zero and min(16 s, 1 s × 2^(k−2)), full jitter. An
integer `Retry-After` header from 0 to 60 seconds replaces that wait; other
values are ignored. Never start an attempt, or a wait that would end, after
`upload.expiresAt`; reaching it is `upload-failed`. Cancellation stops
immediately with `upload-failed`.

### Rejections

Statuses map to CLI categories by value alone; a server may return
`{"error":{"code":"upload-invalid-bundle"}}` for other clients.

| Rejection                                                          | HTTP status            | CLI category                      |
| ------------------------------------------------------------------ | ---------------------- | --------------------------------- |
| Unsupported envelope or ownership marker `schemaVersion`           | 426                    | `upload-unsupported-version`      |
| Invalid plan archive, envelope or marker; blob bytes mismatch      | 400 or 422             | `upload-invalid-bundle`           |
| Missing/invalid token or forbidden repository                      | 401 or 403             | `upload-unauthorized`             |
| Any upload limit exceeded, on plan or on a blob                    | 413                    | `upload-too-large`                |
| Blob digest not part of the plan                                   | 404                    | `upload-failed`                   |
| Complete while blobs are missing                                   | 409                    | one re-plan, then `upload-failed` |
| Retryable status after five attempts, or `expiresAt` reached       | 408, 429, 500, 502–504 | `upload-failed`                   |
| Other non-2xx, redirect, invalid response, cancellation, transport | any other              | `upload-failed`                   |

Errors print `[mokly/<category>] <fixed actionable message>` on stderr and exit

1. Local bundle validation/limits use the same invalid bundle/too-large
   categories. Argument, config, build, Git and export failures retain their
   existing typed categories. No request follows an export failure. Unexpected
   local preparation failures use `upload-failed` with a fixed message to check
   configuration and temporary storage; raw exceptions are not printed. Failed
   uploads leave the complete local export available; they do not roll it back.

### Output

While blobs upload, rich mode shows `Uploading <n> of <total> files · <size>`:
`<n>` completed uploads, `<total>` the files whose digest is in `missing`, and
`<size>` their total byte size. Plain mode prints exactly one final line,
`Published Mokly catalogue. <uploaded> files uploaded, <unchanged> unchanged.`,
counting marker entries whose digest was uploaded during this command
(including a re-plan) against the remaining entries; the viewer URL line
follows when present. Both modes exit 0 and follow the
[terminal output contract](./mokly-terminal-output.md).

## Upload Manifest

`mokly-upload.json` is UTF-8 JSON at the export root, with exactly these
required fields:

```ts
interface MoklyUploadV1 {
  schemaVersion: 1;
  moklyVersion: string;
  repository: { host: string; owner: string; name: string };
  branch: string;
  headSha: string;
  baseRef: string | null;
  baseSha: string | null;
  pullRequest: number | null;
  configPath: string;
  exportedAt: string;
  comparisonPath: string | null;
}
```

- `moklyVersion` is the installed package's exact SemVer (at most 255 bytes),
  including prerelease or build metadata. `schemaVersion` versions this
  envelope, independently of catalogue manifest v5 and review v2/v3.
- `repository` obeys the identity grammar above; it is an assertion to
  authorize, not proof of ownership. `host` is at most 253 bytes; owner and
  name are each at most 255 bytes.
- `branch` is nonempty, at most 255 UTF-8 bytes, with no control characters.
- `headSha` and non-null `baseSha` are full lowercase hexadecimal Git object
  ids, exactly 40 or 64 characters. Resolve HEAD before export and reject a
  changed HEAD before the plan request.
- With comparisons, `baseRef` is the effective ref (nonempty, at most 255 UTF-8
  bytes, no control characters) and `baseSha` is the pinned **merge base**,
  never the current tip of `baseRef`; they equal `baseRef` and `baseCommit`
  inside the packaged review result. Without comparisons, `baseRef`, `baseSha`
  and `comparisonPath` are all null and no diff generation is present.
- `pullRequest` is null or a positive JavaScript-safe integer.
- `configPath` is the slash-separated path from the Git repository root to the
  resolved config, with the marker's safe relative-path grammar. The config is
  not included. Metadata uses the Git root even when a current-only catalogue
  is scoped to a subdirectory; comparison exports still require configured
  `repoRoot` to identify the Git root.
- `exportedAt` is UTC ISO 8601, exactly `YYYY-MM-DDTHH:mm:ss.sssZ`, recorded
  while finalizing the export. It is client-reported time, not an
  authorization input.
- `comparisonPath` is null or
  `__mokly/diffs/__generations/<64 lowercase hex characters>/review.json`,
  the single pinned review file; never search for a newest file.

The manifest is written into the staged export before deployment identity
finalization. It participates in that identity; after the catalogue and shells
are stamped, the ownership marker lists and hashes the manifest together with
every other finalized non-marker file. It is an owned file in `--out`, so
subsequent publish or export can safely replace it. The plan archive and every
blob use the same finalized byte snapshot as the installed export, never a
later walk of a mutable output.

## Export Files And Limits

The receiver reconstructs the catalogue from the marker's inventory and the
blobs it stores: `mokly-upload.json`, `index.html`, `404.html`, `view/...`,
`id/...`, `static/...`, `__mokly/...` and, with comparisons,
`__mokly/diffs/__generations/<content-id>/review.json` beside its snapshots.
The source `mokly-manifest.json` is intentionally absent: it holds source
inventory and is not a public artifact. These are v1 ceilings, enforced by the
CLI and receivers; receivers may impose lower quotas and return 413. Units are
binary (1 MiB = 1,048,576 bytes).

| Limit                                                   | Maximum           |
| ------------------------------------------------------- | ----------------- |
| Plan request body, compressed                           | 100 MiB           |
| Plan archive decompressed, including headers/padding    | 512 MiB           |
| One regular file, blob or marker                        | 64 MiB            |
| Regular files (including manifest and ownership marker) | 20,000            |
| Upload manifest                                         | 16 KiB            |
| Relative path                                           | 1,024 UTF-8 bytes |
| Plan or complete response body read by the CLI          | 16 MiB            |

Receivers authenticate before decompression and enforce limits before reporting
version or structural failures. Reject invalid gzip/tar, truncated entries,
trailing non-padding tar data, entries other than the three artifact files,
duplicate JSON keys, missing/extra upload-manifest fields, wrong types, unsupported
versions and invalid field values. Reject duplicate or case-folded colliding
paths, file/directory conflicts, absolute paths, empty segments, `.`/`..`
segments, backslashes, colons and control characters; paths must be valid
UTF-8 and Unicode is allowed. Collision keys use the
[ownership contract](./mokly-export-ownership.md)'s locale-independent
lowercasing. PAX metadata may specify only the effective path/size and ordinary
file metadata; it cannot authorize links or escapes. Accept only regular files:
reject symlinks, hard links, devices, FIFOs, sparse files and other special
entries, extract into an empty private staging area, never trust tar metadata
as filesystem authority, and ignore stored ids, executable bits and timestamps.

Require the root upload manifest, a schema 2 ownership marker, and inventory
entries for `index.html`, `404.html` and `mokly-upload.json`. The archived
manifest and review file must match their marker digests and sizes, and the
review file must sit at `comparisonPath`. Answer `missing` from the store of
verified blobs; verify each received blob's digest and length against its entry
before storing it; commit only when every listed digest is present, and refuse
completion with 409 otherwise. Validate a referenced review against the
documented [comparison formats](./README.md#supported-formats); comparison
metadata must agree with the manifest, and current-only uploads contain no
comparison files. Check repository authorization and hosting policy before
exposing any catalogue. File contents remain consumer-authored HTML/assets;
the envelope is not a sanitization or sandboxing guarantee.

## GitHub Action

The public composite action lives at `.github/actions/publish` in this repo;
see its [usage guide](../../.github/actions/publish/README.md). Consumers pin the
action revision and supply an exact released `version` of `@mokly/mokly` that
supports publish. It installs that package in runner temporary storage and
executes its CLI directly, independent of the consumer's local CLI version.
Endpoint/token/config/base are forwarded through environment values and quoted
arguments. Consumer dependencies and Git history must already be installed.
