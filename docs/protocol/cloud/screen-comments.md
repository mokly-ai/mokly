# Screen Comments

Comments are outside the initial scope (see
[Product direction](../../product-direction.md)): this contract is the draft for
the review phase, and its API routes answer 503.

Comments attach to a publication and an explicit catalogue view. The cloud
owns persistence and permissions; Mokly owns the screen. See
[Viewer](./viewer.md), [Approvals](./approvals.md), and
[API schemas](../../api/openapi.json).

## Anchor And Thread Model

A thread's original anchor has `publicationId`, `screenPath`, `viewport`
(`mobile`/`desktop`), `colorScheme` (`light`/`dark`) and optional `elementPath`.
`screenPath` is the anchor identity: a complete entry path with the grammar
and the length limits of the shared `EntryPath` schema in the
[API definitions](../../api/openapi.json), the same path `catalogueScreen`
carries. Share handlers validate device names and the reserved first segment;
comment handlers use those same server checks. Publication IDs and entry paths
come from validated metadata. The `listThreads` filter is `screenPath` and
references the same `EntryPath` schema as the anchor.

`elementPath` length is 1–1,024 characters. It is an opaque identifier from the
negotiated bridge, not a CSS selector, source path or HTML. Element anchors
are component instances of the published viewer, which exposes
`InstanceRef.screenPath` and picking.

Each thread has an ID, project/review identity, original anchor, author,
creation/update time, version, lifecycle (`open`/`resolved`), and comments.
A comment has ID, author display name, body, creation/update time and optional
GitHub link/sync state. Bodies are plain text, 1–5000 characters after trimming;
preserve line breaks, escape HTML, and linkify only safe HTTP(S) URLs. Replies
share the thread anchor. Show chronological replies, author and time; timestamps
use viewer locale with an absolute time accessible on request.

`outdated` is separate from resolved/open. Compare the original anchor to the
selected publication using validated per-view material evidence. An unchanged
screen/view carries its thread forward; a changed/removed screen, missing
viewport/theme, or unresolved element path marks it outdated. Unknown comparison
is `unverified`, never assumed unchanged. Source-file movement alone is not
visual change. Do not mutate the original anchor when carrying forward.
Outdated threads offer View original; a new comment on the current screen
creates a new thread. Replies and resolution remain available on an old thread
while its PR is open and the author still has access.

## Panel And Composer

Folio places comments below the catalogue stage. The panel names the selected
screen, viewport and theme; desktop can show the two thread summaries side by
side, while mobile stacks them. A full discussion opens as a document-width
page in the soft-sidebar shell, with replies, composer and approval following
in reading order. Open/Resolved filters use the registered Firna segmented
control and counts from thread status. A separate Outdated filter includes
outdated open and resolved threads without collapsing lifecycle. The canonical
viewer shows All, Open, Resolved and Outdated options with counts derived from
the same thread snapshots as its cards. All is initially selected; outdated
remains orthogonal to open/resolved. The thread card stretches to its
available container width (bounded by the owning layout) and has one status
pill with the badge's built-in decorative dot and no second status dot.

Selecting a thread sets `thread` in the URL and opens Comments. Composer has
a labelled multi-line field and “Post comment”; Reply is a separate action
inside an existing thread. Empty text disables submission. Pending writes
retain text and disable duplicate submission. Failed writes retain the draft
and offer Retry; success clears it only after the server confirms. Changing
selection with a draft asks Discard/Keep writing. Empty comments says “Start
the conversation” with “Add comment”. Loading uses skeletons; fetch failure
says “Comments couldn’t load” and Retry. Required fields announce errors
adjacent to the control and through their accessible associations.

## Permissions And Concurrency

Authenticated project reviewers, members and admins may post/reply. Authors may
edit/delete their own comments; project admins may moderate any comment with
an audit reason. Authors and project admins may resolve/reopen a thread. Other
reviewers can reply without impersonating the thread author. An approval grants
no extra editing permission. Public read access alone never grants write access.
Removing membership takes effect on the next request.

Thread edits/resolution require the latest integer `version`; stale writes
return HTTP 400 `version-conflict` with `{currentVersion}`. The UI reloads
before retrying and retains
draft text. Creation/replies use an `Idempotency-Key` UUID scoped to user and
operation; retries return the same stored result. Do not optimistically invent
server IDs or delivered-sync status. Requests name the publication explicitly;
the server rejects cross-project, absent and invalid anchors with typed errors.

Deleting a comment leaves a tombstone when replies or audit links depend on it.
Deleting the last unreplied comment may hide the thread from ordinary lists;
audit history remains. Closed/merged PR reviews are read-only. Standalone
publication threads have no GitHub sync and remain editable subject to access
and retention. Expired publications keep comment metadata only for authorized
audit access; their viewer cannot promise the original screen is still available.

## Two-Way GitHub Sync

Persist a cloud comment before queueing sync. The UI distinguishes Saved,
Syncing, Synced and Sync failed in secondary details, with a GitHub link when
known. A remote failure never removes a saved comment. Retry is idempotent and
operated by the worker; a user retry requests delivery of the same record.
The GitHub App writes the author's name, comment text and cloud thread link
under the bot identity; it never claims to be that user's review comment.

For PR-linked threads, use the entry's exported `sourcePath` only when that
file has a valid anchor on the PR diff. Resolve its actual GitHub path/side/line
from current PR data; never guess a line from the screen path. If no valid review
comment location exists, use a PR conversation comment containing the cloud
link. Replies stay on the mapped GitHub discussion when supported; otherwise
use a linked conversation comment. The open-source source path is attribution,
not permission to read arbitrary repository paths.

Each synced comment keeps its GitHub mapping with the delivery identity,
revision and origin, so signed webhook deliveries deduplicate by delivery ID
and remote revision and a bot echo event never creates a second comment. Only
mapped comments/replies sync back. Remote authors keep their GitHub identity
even when they have no cloud account. Imported remote comments do not confer
project access. Remote edits/deletions create audit events; updates are
ordered by provider revision/time with conflicts retained for diagnosis.

Cloud resolve/reopen and GitHub thread resolution sync when the provider
supports it; a fallback PR conversation has no resolution API, so cloud state
is authoritative and no success is fabricated. Provider “not found”, revoked
installation and rate-limit responses stay typed; transient failures retry with
provider deadlines, permanent failures offer administrator recovery. Approval
reviews use the separate contract rather than masquerading as thread comments.
