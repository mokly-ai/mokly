# Catalogue Upload v1

## Delivery Status And Boundary

Implementation is tracked in [Publish Catalogue](../../plans/publish-catalogue.md).
This is the public contract for hosted and self-hosted receivers. Receivers need
only the published `@mokly/mokly` package and these documented file artifacts;
Mokly Cloud has no special protocol or access to package internals.
`mokly export` remains local-only. `mokly publish` exports, then uploads once.

Integrators read the reader-facing
[upload receiver guide](../guides/reference/upload-receiver.md). A change to a
header, status, manifest field, archive rule or limit here updates that guide
in the same change; root tests compare it with the implementation.

## CLI

```bash
npx mokly publish --endpoint https://catalogues.example.com/uploads --token TOKEN
npx mokly publish --out .context/site --config tools/mokly.config.ts --base main
npx mokly publish --no-changes --repository git.example.com/team/project
```

Install `@mokly/mokly` first, or use `npx --package @mokly/mokly mokly publish`.
Explicit `--endpoint` and `--token` override `MOKLY_ENDPOINT` and `MOKLY_TOKEN`.
Both are required; empty values fail before export. Endpoint is an absolute
HTTP(S) URL without userinfo or a fragment. HTTPS is recommended for remote
services; HTTP supports local receivers. Tokens use the bearer-token grammar
`[A-Za-z0-9._~+/-]+=*`. Tokens never appear in CLI output, including errors and
diagnostic stacks. Response bodies, response headers and transport exceptions
are not printed. No automatic redirects or retries occur.

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

## HTTP Exchange

POST to the exact endpoint, without appending a path. Send:

```http
Authorization: Bearer TOKEN
Content-Type: application/gzip
Accept: application/json
Content-Length: <compressed bytes>
```

The request body is one gzip-compressed POSIX tar archive (USTAR with PAX
extended headers when needed), not multipart and not an HTTP Content-Encoding.
All 2xx responses mean the complete upload was accepted. No response body is
required or interpreted; 204 is recommended. Receivers should finish validation
before returning success. After acceptance, plain mode prints
`Published Mokly catalogue.` and rich mode prints the timed success summary in
the [terminal output contract](./mokly-terminal-output.md); both exit 0. Upload
timeout is 120 seconds; cancellation and all
failures exit 1. Interrupted responses may have reached the service: retrying
is a new upload, with no exactly-once or idempotency guarantee.

| Rejection                                                       | HTTP status | CLI category                 |
| --------------------------------------------------------------- | ----------- | ---------------------------- |
| Unsupported `schemaVersion`                                     | 426         | `upload-unsupported-version` |
| Invalid manifest or archive                                     | 400 or 422  | `upload-invalid-bundle`      |
| Missing/invalid token or forbidden repository                   | 401 or 403  | `upload-unauthorized`        |
| Any upload limit exceeded                                       | 413         | `upload-too-large`           |
| Other non-2xx, redirect, timeout, cancellation, network failure | any other   | `upload-failed`              |

Errors print `[mokly/<category>] <fixed actionable message>` on stderr. A server
may return `{"error":{"code":"upload-invalid-bundle"}}` for other clients, but
the CLI uses status alone. Local bundle validation/limits use the same invalid
bundle/too-large categories. Argument, config, build, Git and export failures
retain their existing typed categories. No upload follows an export failure.
Unexpected local preparation failures use `upload-failed` with a fixed message
to check configuration and temporary storage; raw exceptions are not printed.
Receivers authenticate before expensive decompression. For authenticated
requests, enforce limits before reporting version or structural failures.

## Archive Layout And Manifest

Archive paths are relative to the export root, with no enclosing directory:

```text
mokly-upload.json
.mokly-export-artifact
index.html
404.html
view/...
id/...
static/...
__mokly/...
__mokly/diffs/__generations/<content-id>/review.json  # comparisons only
```

`mokly-upload.json` is UTF-8 JSON, with exactly these required fields:

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

- `moklyVersion` is the installed package's exact SemVer (at most 255 bytes), including prerelease
  or build metadata when present. `schemaVersion` versions this envelope,
  independently of catalogue manifest v5 and review v2/v3.
- `repository` obeys the identity grammar above; it is an assertion to authorize,
  not proof of repository ownership. `host` is at most 253 bytes; owner and name
  are each at most 255 bytes.
- `branch` is nonempty, at most 255 UTF-8 bytes, with no control characters.
- `headSha` and non-null `baseSha` are full lowercase hexadecimal Git object
  ids, exactly 40 or 64 characters. Resolve HEAD before export and reject a
  changed HEAD before upload.
- With comparisons, `baseRef` is the effective ref (nonempty, at most 255 UTF-8
  bytes, no control characters), and `baseSha` is the pinned **merge base**,
  never the current tip of `baseRef`. They must equal `baseRef` and `baseCommit`
  inside the packaged review result. Without comparisons, `baseRef`, `baseSha`
  and `comparisonPath` are all null and no diff generation is present.
- `pullRequest` is null or a positive JavaScript-safe integer.
- `configPath` is the slash-separated path from the Git repository root to the
  resolved config, with the safe relative-path grammar below. The config itself
  is not included. Comparison exports retain the existing requirement that
  configured `repoRoot` identifies the Git root; metadata uses the Git root even
  when a current-only catalogue is scoped to a subdirectory.
- `exportedAt` is UTC ISO 8601, exactly `YYYY-MM-DDTHH:mm:ss.sssZ`, recorded while
  finalizing the export. It is client-reported time, not an authorization input.
- `comparisonPath` is null or
  `__mokly/diffs/__generations/<64 lowercase hex characters>/review.json`.
  It identifies the single pinned review file; never search for a newest file.

The manifest is written into the staged export before ownership and deployment
identity are finalized. It is an owned file in `--out`, so subsequent publish or
export can safely replace it. The tarball uses the same finalized byte snapshot
as the installed export, never a later recursive walk of a mutable output.
It is kept in memory for the request, not written into `--out`. Failed uploads
leave the complete local export available; they do not roll it back.

## Validation And Limits

These are v1 ceilings, enforced by the CLI and receivers; receivers may impose
lower quotas and return 413. Units are binary (1 MiB = 1,048,576 bytes).

| Limit                                                    | Maximum           |
| -------------------------------------------------------- | ----------------- |
| Compressed request body                                  | 100 MiB           |
| Decompressed tar stream, including headers/padding       | 512 MiB           |
| One regular file                                         | 64 MiB            |
| Regular files (including manifests and ownership marker) | 20,000            |
| Upload manifest                                          | 16 KiB            |
| Relative path                                            | 1,024 UTF-8 bytes |

Reject invalid gzip/tar, truncated entries, trailing non-padding tar data,
duplicate JSON keys, missing/extra upload-manifest fields, wrong types, unsupported
versions and invalid field values. Receivers reject duplicate or case-folded
colliding file paths, file/directory conflicts, absolute paths, empty segments,
`.`/`..` segments, backslashes, colons and control characters. Paths must be
valid UTF-8; Unicode is allowed. Collision keys use locale-independent Unicode
lowercasing without normalization, as defined by the [ownership contract](./mokly-export-ownership.md).
PAX metadata may specify only the effective
path/size and ordinary file metadata; it cannot authorize links or escapes.
Only regular files and optional directories are accepted. Reject symlinks,
hard links, devices, FIFOs, sparse files and other special entries. Extraction
must remain confined even when a destination already contains symlinks; use an
empty private staging directory and never trust tar metadata as filesystem
authority. Do not honor stored user/group ids, executable bits or timestamps.

Require exactly one root upload manifest and an export ownership marker matching
the [public v1 schema and fixtures](./mokly-export-ownership.md),
`index.html` and `404.html`. The marker's owned
inventory must match archive regular files other than the marker itself.
The source `mokly-manifest.json` is intentionally absent: it contains source
inventory and is not a public export artifact. The catalogue is the static site
defined by the [export](./mokly-export.md) and [delivery](./mokly-export-delivery.md)
contracts. Validate a referenced review against the documented
[comparison formats](./README.md#supported-formats). Comparison metadata must
agree with this manifest; current-only uploads contain no comparison files.
Receivers must check their repository authorization and hosting policy before
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
