# Catalogue Upload v3

Status: In progress under the [detail content ids plan](../../plans/detail-content-ids.md).

## Boundary

Receivers, hosted or self-hosted, need only the published `@mokly/mokly`
package and its protocol documents and fixtures; Mokly Cloud has no private
protocol. `mokly build` is local-only. `mokly publish` builds into its own
private directory outside the repository, then runs the exchange so a receiver
stores only content it lacks. The `mokly-upload.json` envelope, the
[ownership marker](./mokly-export-ownership.md), and the Plan response each
carry their own version of the [format inventory](./mokly-format-versions.md).
Earlier receivers reject this format with 426 under the
[namespace compatibility contract](./mokly-viewer-namespace.md#compatibility-failure).
A receiver reads Changes only from the catalogue index that the Plan archive
carries, under the
[Changes count](./mokly-catalogue-changes.md#changes-count), so a summary such
as a pull request check agrees with the viewer's Changes list.

## CLI

```bash
npx mokly publish --endpoint https://api.mokly.ai/v1/projects/<projectId>/publications --token TOKEN
npx mokly publish --config tools/mokly.config.json --base main
npx mokly publish --no-changes --repository git.example.com/team/project
npx mokly publish --upload-concurrency 4
```

Install `@mokly/mokly` first, or use `npx --package @mokly/mokly mokly publish`.
Explicit `--endpoint` and `--token` override `MOKLY_ENDPOINT` and `MOKLY_TOKEN`.
Both are required; empty values fail before the build. An endpoint URL must
not contain a fragment. The endpoint identifies the
receiver's Plan route and must satisfy the exchange request URL boundary. For
Mokly Cloud it is
`https://api.mokly.ai/v1/projects/<projectId>/publications`. HTTPS is
recommended for remote services. The
[exchange contract](./mokly-upload-exchange.md#upload-exchange) defines the
accepted URL, exact Plan target and receiver-supplied Blob and Complete URLs.

Tokens use the bearer-token grammar `[A-Za-z0-9._~+/-]+=*`. Tokens never
appear in CLI output, including errors and diagnostic stacks. Response bodies,
response headers and transport exception text are not printed. The exchange
contract owns redirect, retry, timeout, expiry, accounting and cancellation
behavior. `--upload-concurrency <n>` bounds parallel Blob requests to an
integer from 1 through 32 (default 8); another value, or the option on another
command, fails as `cli-invalid`. The composite action forwards no concurrency
input.

Value options also accept `--name=value`. Use `--token=-TOKEN` for a credential
beginning with `-`, or set `MOKLY_TOKEN`. Split only at the first `=`, preserving
token padding and URL queries. Empty assigned values fail; boolean options such
as `--no-changes` reject assignments. A separate value beginning with `-`
is ambiguous and fails as a missing value; use the assigned form instead.

`publish` has no `--out` option: it builds into an output directory inside
its own private directory outside the repository. The `Mokly publish build` line of the
[terminal errors contract](./mokly-terminal-errors.md) names that output, under the
[static build contract](./mokly-export.md) and its ownership rules. `--config`
uses normal discovery. Comparisons are included by default: `--base` overrides
`review.base` (default `origin/main`). `--no-changes` skips base lookup and
comparison generation, including removed entries and comparison assets and
controls. It rejects an explicit `--base`. Both modes build and validate the
catalogue. Build warnings fail the command before output installation or upload
only with `--strict`. Without it, warnings print and publication continues.
Strict mode is opt-in so recoverable authoring warnings do not block publication.

After a successful publication or an already-published response, delete exactly
the private directory created by this publication, including its site and
reservation directory. Do not follow symbolic links. A failed or cancelled upload retains the whole private directory.
If removal fails, warn with the private directory path and keep publication
successful. The receiver has already accepted it. Removing only the snapshot
would leave the reservation directory behind.

Publish requires a Git checkout with a commit even without comparisons, to
identify the uploaded revision. With comparisons enabled, the base side renders
from the pinned merge base's sources under the
[comparison contract](./mokly-comparison.md#sides). `--no-changes` requires no
base history. Publish requires a clean
checkout. `headSha` names the commit whose clean checkout produced the catalogue.
Dependencies and other ignored build products come from the local environment.
The CLI enforces this rule; a receiver cannot verify it. A receiver keeps the
first publication it completes for a `headSha` and `configPath`.

Publish checks HEAD and repository status before the build, then checks both again
before Plan. Either status check fails before any receiver request. Modified, staged, deleted, renamed, type-changed,
unmerged, untracked non-ignored paths and submodule changes anywhere in the
repository count, regardless of user Git settings. Git-ignored files and
Mokly-owned caches and temporary paths never count. Uncommitted changes fail
with `git-uncommitted` under the
[terminal error contract](./mokly-terminal-errors.md).

## Repository And Revision Identity

`--repository <host>/<owner>/<name>` overrides remote detection. Otherwise use
`origin`, or the sole remote if `origin` is absent; multiple other remotes are
ambiguous and fail. HTTPS, SSH URLs and scp-style Git remotes are supported.
Local paths are not repository identities. Remove one trailing `.git` suffix.
Host is lowercase DNS or IPv4 without a port. Owner may contain slash-separated
groups, such as GitLab subgroups; repository name is one segment. Segments
contain only ASCII letters, digits, `.`, `_`, and `-`, and cannot be `.` or
`..`. Credentials in remote URLs are discarded and never printed.

Branch is `GITHUB_HEAD_REF` in GitHub Actions pull-request runs, otherwise
`GITHUB_REF_NAME` for branch runs (`GITHUB_REF_TYPE=branch`), otherwise Git's
symbolic branch. Detached checkouts fall back to `HEAD`; `headSha` is always
the actual checked-out commit, never a substituted pull-request SHA.
`pullRequest` is the positive number in
`GITHUB_REF=refs/pull/<number>/merge` or `/head`, otherwise null. Read Actions
context only when `GITHUB_ACTIONS=true`. For pull-request-head semantics, check
out the head explicitly as in the action guide.

## Upload Manifest

`mokly-upload.json` is UTF-8 JSON at the output root with exactly these fields:

```ts
interface MoklyUploadV3 {
  schemaVersion: 3;
  moklyVersion: string;
  repository: { host: string; owner: string; name: string };
  branch: string;
  headSha: string;
  baseRef: string | null;
  baseSha: string | null;
  pullRequest: number | null;
  configPath: string;
  exportedAt: string;
}
```

Readers reject missing/extra upload-manifest fields and duplicate JSON keys.

- `moklyVersion` is the installed package's exact SemVer, including prerelease
  or build metadata, at most 255 UTF-8 bytes. `schemaVersion` versions this
  envelope independently of the catalogue index v8.
- `repository` obeys the identity grammar above; it is an assertion to authorize,
  not proof of repository ownership. `host` is at most 253 bytes; owner and name
  are each at most 255 bytes.
- `branch` is nonempty, at most 255 UTF-8 bytes, with no Unicode category Cc
  character.
- `headSha` and non-null `baseSha` are full lowercase hexadecimal Git object
  ids, exactly 40 or 64 characters. Resolve HEAD before the build and reject a
  changed HEAD before Plan.
- With a ready comparison generation, `baseRef` is the effective ref. It is
  nonempty, at most 255 UTF-8 bytes, and has no category Cc character. `baseSha` is the pinned merge
  base, never the current tip of `baseRef`. `baseSha` equals the index's
  `baseCommit`, and `baseRef` equals the index's `base`, the effective ref of
  the pinned comparison. With disabled or unavailable Changes, `baseRef` and
  `baseSha` are both null and no comparison generation is present.
- `pullRequest` is null or a positive JavaScript-safe integer.
- `configPath` is the slash-separated path from the Git repository root to the
  resolved config and follows the ownership marker's portable-path grammar.
  The config is not included. Metadata uses the Git root even when a
  current-only catalogue is scoped to a subdirectory.
- `exportedAt` is UTC ISO 8601, exactly `YYYY-MM-DDTHH:mm:ss.sssZ`, recorded
  while finalizing the build. It is client-reported time, not authorization.

The manifest is written before ownership finalization. Publish declares it as
publication metadata, so it is excluded from the deployment identity while
remaining an owned file whose exact bytes are hashed in the ownership marker.
Changing only publication metadata therefore changes the marker without
changing `deploymentId`, the index, the deployment file, or any detail. The Plan
archive and every Blob request use the same finalized byte snapshot as the
installed output, never a later walk of mutable output.

## Output

The [exchange accounting and output contract](./mokly-upload-exchange.md#accounting-and-output)
defines uploaded and unchanged counts, per-round progress, viewer URL
handling, and cancellation classification. The
[terminal compatibility contract](./mokly-terminal-errors.md) owns the exact
summary, cancellation, and transport-failure lines, and the
[terminal output contract](./mokly-terminal-output.md#one-shot-commands) owns
plain and rich rendering. Failed publication leaves the complete built
directory in place; it is not rolled back.

## GitHub Action

The public composite action lives at `.github/actions/publish` in this repo;
see its [usage guide](../../.github/actions/publish/README.md). Consumers pin
the action revision and supply an exact released `@mokly/mokly` version that
supports publish. It installs that package in runner temporary storage and
executes its CLI directly, independent of the consumer's local CLI version.
Endpoint, token, config and base are forwarded through environment values and
quoted arguments. Consumer dependencies and Git history must already be
installed. The action exposes no upload-concurrency input.
