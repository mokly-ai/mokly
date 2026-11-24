# Cloud Build API

Status: Build notices, the reads on each notice and the 30-second poll while a live socket is open are not built yet. The [app live client and build notices milestone](../../../plans/live-channel-foundation.md#milestone-6-app-live-client-and-build-notices) builds them.

The REST surface of [cloud builds](./cloud-builds.md). It follows
[REST transport](./rest-transport.md) for bodies, cursors, CSRF, cache headers
and error envelopes, and [Viewer read model](./viewer-read-model.md) for
reference reads. The build operations, project fields, build summaries and
four reasons below appear in the [generated OpenAPI document](../../api/openapi.json)
and the [REST catalogue](./rest-api.md#reason-catalogue). Publication reads,
reference publication summaries and upload receipts include nullable `buildId`.

## Access

**Member access** means an active workspace membership of any role or a
direct project grant of any role; public visibility alone never grants it.
Build rows, build reads and logs require member access, because a build log
can describe a private repository whose catalogue is public. Without it,
`getBuild` and `listBuildLog` answer `not-found`, history omits build entries
and reference rows carry `newestBuild: null`. Requesting and cancelling
require an effective project role of `admin` or `member`, a session and CSRF;
a reviewer receives `permission-denied`. Changing Automatic builds requires
project administration, like every project setting.

## Operations

| Operation      | Method and path                                         | Success          |
| -------------- | ------------------------------------------------------- | ---------------- |
| `listHistory`  | `GET /v1/projects/{projectId}/history`                  | 200 history page |
| `getBuild`     | `GET /v1/projects/{projectId}/builds/{buildId}`         | 200 `Build`      |
| `listBuildLog` | `GET /v1/projects/{projectId}/builds/{buildId}/log`     | 200 log window   |
| `requestBuild` | `POST /v1/projects/{projectId}/builds`                  | 201 `Build`      |
| `cancelBuild`  | `POST /v1/projects/{projectId}/builds/{buildId}/cancel` | 200 `Build`      |

`getProject` and its slug lookup, `updateProject`, `listBranches`,
`listPullRequests` and the publication reads gain the fields under
[Project and rows](#project-and-rows).
A build ID from another project is `not-found`.

## Build Shapes

`Build`: `id`, `projectId`, `state` (the seven lifecycle states), `trigger`
(`push`, `pull-request`, `setup`, `request`, `rerun`), `branch`, `headSha`,
nullable `pullRequest` (the publication read model's `{number, title, author,
url}` context), nullable `baseRef`, nullable `step` (the running step, or
the step a failure stopped in), `createdAt`, nullable `startedAt` and
`finishedAt`, `attempt`, nullable `failure`, nullable `publicationId`,
nullable `supersededBy` and `canCancel`. `failure` is `{step, cause,
exitCode}` with nullable `step` (`checkout`, `install`, `publish`), the
lifecycle's failure `cause`, and nullable `exitCode`. `canCancel` is true
while `cancelBuild` would cancel the build and the caller may cancel it.

The [lifecycle's typed causes](./cloud-builds.md#build-record) add
`uncommitted-changes` to `failure.cause`, OpenAPI and the generated client.
No `stale-generated-output` cause exists, because the CLI has no
stale-output failure.

`BuildSummary` on reference rows is `{id, state, createdAt, headSha}`.

## listHistory

Publications and builds of one reference, newest first, for the viewer's
history panel. It accepts `branch`, `pullRequest`, `cursor` and `limit` with
the `listPublications` rules; both filters together mean intersection.
Items are `{kind: "publication", publication}` or `{kind: "build", build}`.
Publication entries are every publication the filters match except an
unfinished or failed attempt with a build association, because its build stands
for it; this rule holds for every reader, members or not.
`listHistory` omits replay attempts for every reader. A replay attempt is a
failed upload with `failureCode` `superseded` when another publication has
already published its [identity](./publication-ingest.md#idempotency-and-concurrent-uploads).
Other failures, such as an invalid bundle, stay in history.
The CLI reports a replay as already published, so history and
`newestPublication` omit it instead of adding a neutral entry. Replay attempts
remain stored to preserve the upload exchange.
Build entries are the matching builds in `queued`, `running`, `failed`
or `timed-out` without a publication association; a build whose upload committed is
represented by its publication, and a superseded or cancelled build is not
history. Entries order by
`(time DESC, id DESC)`, where time is a publication's admission time or a
build's `createdAt`. Pagination uses one consistent view of both kinds. The opaque cursor
binds the operation, project, filters and last key.

## Project And Rows

`Project` gains `automaticBuilds`, `buildsAvailable` (the lifecycle's
can-build predicate) and `canRequestBuilds` (available, `publishingAllowed`
and a caller who may request). `UpdateProject` gains optional
`automaticBuilds`: present sets the setting and absent keeps it, so clients
that predate the field keep working; turning it on for a project that cannot
build is refused with `builds-unavailable`. `Publication` gains nullable
`buildId`.

`Branch` and `PullRequest` rows gain required nullable `newestBuild`, the
reference's newest build by `(createdAt DESC, id DESC)` in any state.
Each list uses one consistent view of its reference rows and summaries. Their `newestPublication` skips unfinished and
failed attempts with a build association and [replay attempts](#listhistory)
for every reader, as history does, so a build's rejected upload never outranks
the build itself. The branch union
also includes branch names from the project's builds, and a branch's
`updatedAt` also considers their creation times.

`PullRequest` has required, non-null boolean `fork` for every authorized
reader, including public-only readers. Its meaning and shared eligibility
rule belong to [Pull requests](./viewer-read-model.md#pull-requests--listpullrequests). OpenAPI describes that same predicate,
including a head repository GitHub no longer reports; the generated client
and application fixtures use the typed boolean.

## getBuild

Returns the `Build` with its stored pull request context. Responses are
`no-store`; the application reads it with the log while the build is active,
as [Live notices](#live-notices) says.

## listBuildLog

The worker appends chunks as the
[runner](./cloud-build-sandbox.md#output) cuts them, each append conditional on
the attempt's `attempt_operation_id`.
`build_log_chunks` rows are `(build_id, sequence)` with `attempt`, nullable
`step`, `stream`, 1–65,536 `bytes` and `created_at`. Sequences rise
across attempts from an atomic `builds.log_sequence` counter, which never
resets and is advanced while the build row is locked; starting an attempt deletes earlier
attempts' chunks. Retention per build is one MiB: the first 256 KiB of the
attempt stay (an append crossing that boundary splits into two chunks),
`log_head_sequence` marks their last chunk, and beyond it the
oldest later chunks are deleted as new ones arrive, adding their bytes to
`log_elided_bytes`, so the retained tail always ends with the newest output.

`after` (a sequence, default 0) returns chunks with larger sequences in
order, up to `limit` chunks (1–100, default 100) or 256 KiB of text, and
always at least one when any exist. The text limit counts normalized UTF-8
bytes, including replacement characters, and continuation starts after the
last returned chunk. The response is
`{chunks, nextAfter, complete, elision}`. Each chunk is
`{sequence, attempt, step, stream, text}`, where `text` decodes the stored
bytes as UTF-8 with replacement, removes terminal escape sequences and control
characters other than tab and newline, and turns `\r\n` and a lone `\r` into
`\n`. `nextAfter` is the last returned sequence, or `after` when none were.
`complete` is true once the build is terminal with `log_complete` set and
nothing follows `nextAfter`; until then a reader keeps reading. `elision` is
`{afterSequence, bytes}` while output after the head was dropped, and null
otherwise. Invalid `after` or `limit` values are
`validation-failed`.

## Live Notices

Builds send two [notice kinds](./live-channel.md#notices) to the live sockets
of their project. The `id` of both kinds is the build ID.

| Kind        | Sent on                                                                                 | `sequence`               |
| ----------- | --------------------------------------------------------------------------------------- | ------------------------ |
| `build`     | An insert into `builds`, and an update that changes a field of [`Build`](#build-shapes) | The row's `log_sequence` |
| `build-log` | An insert into `build_log_chunks`                                                       | The chunk's `sequence`   |

A lease renewal changes no field of `Build`, so it sends no `build` notice.
The log counters that a log append updates, such as `log_sequence` and
`log_bytes`, are not fields of `Build` either. So a log append sends only its
`build-log` notices, which cover it. Only members hold a live socket, so build
notices reach only the readers that the build reads admit.

A reader keeps reading a build and its log until the log is `complete`, as
[listBuildLog](#listbuildlog) says. While it does, it reads `getBuild` and the
log window after its last sequence on each notice of that build. It also polls
both reads: every 3 seconds while it has no open live socket, and every 30
seconds while it has one, as a safety net.

## requestBuild

The body is exactly one of `{branch}` (nonempty, at most 255 UTF-8 bytes, no
controls) or `{pullRequest}` (positive integer). The API first applies the
local checks of the table below, then reads the reference from GitHub through
the installation: the branch tip, or the pull
request with its state and head and base repository IDs. An unknown branch or
pull request is `not-found`; a closed pull request is refused with
`build-ineligible` and `{cause: "closed-pull-request"}`, and a pull request
whose head or base repository is not the project's repository, including a
missing head or base repository, with `{cause: "fork-pull-request"}`. Provider rate
limits and outages keep their existing `rate-limited` and `unavailable`
responses. The provider read and scheduling transaction follow the
[stored-head trigger rule](./cloud-builds.md#triggers), including the head used
by both duplicate refusals below. Duplicate and pull-request eligibility
refusals commit the guarded observation before returning the refusal; they
create no build. The transaction rechecks these lifecycle rules:

| Situation                                          | Response                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Builds not configured, or the project cannot build | 400 `builds-unavailable`                                                                        |
| The project's `publishingAllowed` is false         | 400 `plan-required`, as [Billing plan gates](./billing-plan-gates.md#plan-gated-writes) defines |
| A ready publication exists for the head            | 409 `build-already-published` with `{publicationId}`                                            |
| An active build exists for the head                | 409 `build-already-active` with `{buildId}`                                                     |
| Otherwise                                          | 201 with the new `queued` build                                                                 |

A new request supersedes its reference's active builds on another head. A
branch request on the default branch is current-only; any other branch
compares against the default branch; a pull request compares against its
base branch.

## cancelBuild

Moves a `queued` or `running` build to `cancelled` and returns it; a terminal
build is returned unchanged, so repeating the call is harmless. It takes no
body.

## Reasons

| Reason                    | Code                  | HTTP | When                                                      | Data                                                    |
| ------------------------- | --------------------- | ---- | --------------------------------------------------------- | ------------------------------------------------------- |
| `builds-unavailable`      | `failed-precondition` | 400  | Builds are not configured or the project cannot build     | —                                                       |
| `build-ineligible`        | `failed-precondition` | 400  | The requested pull request is closed or comes from a fork | `{cause: "closed-pull-request" \| "fork-pull-request"}` |
| `build-already-active`    | `already-exists`      | 409  | An active build exists for the requested head             | `{buildId: UUID}`                                       |
| `build-already-published` | `already-exists`      | 409  | A ready publication exists for the requested head         | `{publicationId: UUID}`                                 |

`requestBuild` also lists the existing `plan-required` reason, with the data
that [Billing plan gates](./billing-plan-gates.md#plan-gated-writes) defines.
Each operation's `x-reasons` also lists
the shared transport,
authentication, `validation-failed`, `not-found`, `permission-denied`,
`csrf-rejected` (writes), `rate-limited`, `unavailable` and `internal-error`
outcomes that apply to it.

## Verification

API integration tests cover every operation for owner, admin, member and
reviewer roles, direct grants, public-only readers and anonymous callers;
every refusal, including `plan-required` for a private project of a free
workspace; history ordering, filters and cursors across both kinds; log
windows across attempts, elision and text normalization; and cancellation
races. A smoke starts the API with a fake runner, requests a branch build,
polls its log and reads its published history entry.
