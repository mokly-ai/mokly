# Viewer Read Model

The six GET operations in [OpenAPI](../../api/openapi.json) supply the
cloud chrome in [Viewer](./viewer.md). They read retained database observations
and accepted publication artifacts; they never call GitHub during a request,
execute catalogue code, or issue an access grant.

## Visibility And Errors

Every operation uses exactly `getProject` access: active workspace members
of every role, direct project grantees of every role, and anyone for a public
project. Pending invitations convey no access. Missing projects and private
projects without effective access return `not-found`, including anonymous
requests; they never return `permission-denied`. A supplied invalid or expired
session retains the normal authentication error. Visibility is checked on
every request before publication or provider metadata is read. Authorized roles
receive the same PR context and newest-publication fields; no workspace
metadata permission is required by direct project grantees. A private denial
discloses neither field.

Malformed IDs, duplicate/unknown query keys, invalid filters, limits, cursors
and share selections return `validation-failed`. Store and file-store failures
return `internal-error`. All responses use `Cache-Control: no-store` and the
ordinary request-ID envelope.

## Pagination

Lists use the shared `Cursor` and `Limit` parameters and the
`{items, nextCursor}` envelope: default 50, minimum 1, maximum 100.
Authorization and filtering precede pagination. Viewer cursors are opaque;
clients must pass them back unchanged.

Each viewer cursor binds the operation, project, publication when applicable,
history filters, and last row's complete ordering key. Reject malformed,
cross-operation, cross-project and mismatched-filter cursors. A cursor does
not grant access or require the anchor row to still exist. Comparisons use the
keys below, never a positional offset. Branch and screen strings use bytewise
ordering. History timestamps are server admission times, not producer export
times; UUIDs break timestamp ties.

The collections are live, not snapshots across requests. Concurrent changes
to a branch default or PR state/update time can move a row across the cursor;
refresh from the first page to observe the current order. Inserts earlier than
the cursor do not displace later history rows.

## Branches — `listBranches`

Union the bound repository's observed, nondeleted branches with all non-null
branches in the project's publications, including failed and expired history.
Repository bindings survive installation disconnection; their retained branch
and PR observations remain readable. A project without a binding still lists
its publication branches. Deleted provider branches remain only if publication
history names them. Never join repositories by the user-authored repository
name or expose another project's publications from the same repository.

Use the bound repository's nonempty default branch; if none is known, use the
branch of the newest ready, unexpired publication by admission time, then ID.
The default is first if it occurs in the union, followed by name ascending;
that pair is the cursor key.

Each row retains `name`, nullable `latestPublicationId` and `updatedAt`.
`latestPublicationId` is the newest ready, unexpired publication for this
project and branch. `updatedAt` is the maximum provider observation time and
publication admission time for the branch. Neither field is fabricated for
provider-only or publication-only branches.

Both branch and PR rows also carry required nullable `newestPublication` with
`id`, nullable `buildId`, lifecycle `state`, `publishedAt` (server admission
time) and nullable `headSha`. It is the newest attempt by admission time, then
ID, across all states, including failed and expired history, except unfinished
and failed build uploads and [replay attempts](./cloud-build-api.md#listhistory).
It is null when the reference has no included
publication; provider observation time/SHA never substitute for publication
data. `latestPublicationId` is the newest retained ready navigation target, even
when the newest attempt failed.

## Pull Requests — `listPullRequests`

List the bound repository's observed pull requests; no binding means an empty
list. Sort open first, then newest provider observation, then highest number.
Rows retain number, title, author, branch, state (`merged` takes precedence
over `closed`), canonical GitHub URL and nullable latest publication ID. Build
the URL from the bound repository's canonical full name and positive PR number.
The latest publication matches this project and the stored upload PR number,
not merely the branch or SHA.

`author` is nullable: an observation stored without an author login returns
`author: null` until provider reconciliation refreshes it. The schema permits
null because inventing an author or dropping historical PR rows would
misrepresent stored data.

Each row has required boolean `fork`, independent of the reader's role,
project plan and build availability. It is true exactly when either the stored
head or base repository ID differs from the
project's bound repository ID; a missing head or base repository also makes it true.
This is the `fork-pull-request` predicate, regardless of other refusal causes
such as a closed pull request.

One typed domain rule computes this fact for the API and supplies fork
eligibility to the scheduler and request path, so the three cannot disagree.
`mkc-domain::pull_request::PullRequestRepositories::is_fork` owns this rule.
The list uses retained observations in its
existing SQL read. Postgres and API tests cover same-repository heads, foreign
head or base repositories, a missing head repository, all reader roles and
projects that cannot build.

## History And Publication Context

`listPublications` accepts optional `branch` (nonempty, no controls) and
`pullRequest` (positive integer); both together mean intersection. Branch and
share screen query values are limited to 2048 UTF-8 bytes. Order newest
admission first, UUID breaking ties, and include all states, including failed
and expired rows. Metadata-free admission failures appear only in unfiltered
history. Every history read omits unfinished and failed uploads whose
`build_id` is set, because the build represents them. Exact reads still return
owned failed attempts. Publication reads and reference summaries include
nullable `buildId`, the stored build association or null when none remains.
Project-token uploads start with null; build retention also clears the link.
Producer timestamps never influence ordering.

`getPublication` scopes its ID to the authorized project. Expired, deleted and
foreign-project publications return `not-found`. Failed attempts remain
readable as details, without a catalogue. No catalogue URL is returned unless
the row is ready and unexpired. Ready URLs use only the configured sandbox
catalogue origin; publication content never uses the app/API origin.

Both history and exact publication reads include required nullable `pullRequest`
with `number`, `title`, nullable `author` login and canonical GitHub `url`.
The context is the pull request whose number the upload envelope admitted,
read through the project's stable repository binding; it is never inferred
from a branch or a current head. Reads never contact GitHub: the GitHub worker
retains title and author from provider reconciliation. Renames and newer heads
do not change the admitted PR identity. Details reflect the last stored
provider observation, not a frozen upload-time snapshot. A missing admitted PR
number, repository binding or observed PR gives null; an observation without
an author keeps `author: null`. Expired history retains the same context,
while exact expired reads remain not-found. Supplying an exact ID also requires
an unexpired row; an absent ID retains expired history under the other filters.

`Publication` carries required nullable `failureCode`, the persisted failure
classification whose values the
[OpenAPI document](../../api/openapi.json) lists; it is a data
classification, not an HTTP reason. `branch` and `headSha` are nullable
because failed uploads can lack an authorized envelope. The Changes state
distinguishes `no-comparison` from unavailable attempts.
`headSha` accepts the upload contract's 40- or 64-character lowercase hex
object IDs. `publishedAt` is the server's admission time in every lifecycle
state. `reviewId` is null and `canComment` is false until cloud review/comments
ship.

Admission computes Changes from the catalogue index in the Plan archive with
the same counting rule as [Changes check](./changes-check.md): the Changes
count of the packaged `mokly-catalogue-changes.md`, including paired moves.
It atomically stores added/changed/removed counts with
the ready transition; current-only uploads store the explicit `no-comparison`
state with null counts. Unfinished/failed attempts without an accepted
observation are `unavailable` with null counts. Observations are immutable and
retained after expiry. The viewer hides the screen list and screen-specific
share controls for `no-comparison`; publication-level sharing remains
available and omits any package-owned selected screen before calling
`getShareLink`.

## Cloud Builds

The [build API](./cloud-build-api.md#project-and-rows) adds build data to these
reads, and only readers with member access receive any of it. `listBranches`
also unions the branches of the project's builds in every state, and a
branch's `updatedAt` also considers their creation times. Branch and pull
request rows carry required nullable `newestBuild`. For every reader,
`newestPublication` and history skip a build's own unfinished or failed
attempts, because the build stands for them.
The viewer's history panel reads `listHistory`, which interleaves
publications with builds under the `listPublications` filters but, like
`newestPublication`, skips [replay attempts](./cloud-build-api.md#listhistory).
Build publications use the same index projection of screens and current-path
sharing identity as CI uploads.

## Screens — `listScreens`

Return `Screen { path, title, views }`, ordered by current path ascending.
Screen cursors use publication ID and path. A screen counts once.
Views use desktop before mobile, then light before dark. Removed screens,
component variants and use-case steps do not become current screens. Require
a ready unexpired publication; other states return `not-found`.

Shareable identities have a maximum of 2048 UTF-8 bytes.
They must meet the entry-path grammar in [Viewer address state](./viewer-address-state.md).
Apply the bound to the current identity before pagination. An entry path also
names its derived snapshots, so the 1,024-byte artifact path limit bounds it
first and can reject a comparison. Longer API identities are omitted from
projection; admission and Changes counts are unaffected. Admission, listing
and share input use the same predicate.

The marker contains paths, digests and sizes, not typed screen metadata.
The catalogue index supplies the package's screen metadata as
[Viewer catalogue](./viewer-catalogue.md) defines. The API
screen list and share validation project comparison-backed publications only.
Current-only `listScreens` and screen-specific Share return 503
`operation-unavailable`. Publication-level Share remains available. Do not
call unavailable metadata an empty catalogue or erase package selection.

The projection reads the catalogue index stored with the publication: each
current screen record with its path, title and views. Screen
variants use their own screen paths. Removed screens, component variants and
flow steps are excluded.
Admission stores the current path for sharing. Admission and listing use one
projection and one bound.

## Share — `getShareLink`

Return the configured app origin plus
`/:workspaceSlug/:projectSlug/publications/:publicationId`, with optional query
keys in the order `catalogueScreen`, `viewport`, `scheme`, encoded once. Access is
`public` for a public project and `members` otherwise; no grant, membership,
cookie or token is created. Require a ready, unexpired publication.

Only these three optional keys are accepted. `screen` is rejected. `thread` is always rejected with
`validation-failed` until comments ship, as are `view`, `panel`, unknown keys,
duplicates and empty values. Screen paths must exist in the comparison-backed
publication's current screen views, meet the entry-path grammar and satisfy
the same 2048-byte bound as listing.

OpenAPI declares `maxLength: 2048`. Entry paths are ASCII, so valid paths
have equal character and UTF-8 byte lengths. The server checks grammar and
bytes even when clients bypass OpenAPI.
Admission stores the accepted screen/view selections; sharing validates an
exact identity and pair against them. Expiry removes these selections while
retaining the Changes observation. Only `listScreens` reads the stored
catalogue index. Viewport is `desktop` or `mobile`; scheme is
`light` or `dark`.
When a screen is selected, supplied values must match at least one of its
views (both values together must match the same view). Without a screen,
validate the enums only. Omitted keys stay omitted; do not materialize account
preferences as hardcoded URL defaults. Screen-specific sharing depends on the
same comparison-only API projection as `listScreens`.

## Artifact Reads

The [architecture doc](../../architecture/cloud.md) places the store, service and API
components that serve these operations. Only `listScreens` reads stored
publication content: the catalogue index. Reauthorize and
recheck publication retention after a successful or failed read of it, so
that revocation or expiry during IO cannot produce a successful stale
response.
