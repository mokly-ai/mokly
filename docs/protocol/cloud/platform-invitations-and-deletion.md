# Platform Model: Invitations And Deletion

This continues [Platform model](./platform-model.md) for workspace
invitations and for the deletion of projects, workspaces, sessions and tokens.

## Invitations

Invites expire after seven days and appear as `invited` members until accepted
or revoked. An email links to
`/workspaces/{workspaceId}/invitations/{memberId}/accept`; it names the
workspace, the inviter's display name and the seven-day validity, and is
sent by hosted template only after the inviting transaction commits. Its copy
and document are the [Email](./email.md) contract. The app keeps this route
through sign-in, calls the invitation endpoint as the authenticated invited
address, then opens that workspace's current slug route. A signed-in reader
with another address can switch accounts; an expired or revoked link shows a
recovery state. Knowing the invitation's ID is insufficient. Acceptance changes
the same member record to `active` and increments its version. Reinviting an
active or unexpired invited address returns `already-member`; an expired
invitation may be replaced. Role edits and revocations require its version.

## Deletion

Project deletion requires its current name and version and atomically removes
its grants and credentials. Workspace deletion requires an owner, name and
version, detaches all GitHub installations bound to it, and cascades its
projects and memberships. Detachment preserves repository references from
projects in other workspaces that previously disconnected from the same
installation. Deleted reads return 404;
there is no restore or soft-delete state. Sessions end on sign-out, expiry or
rotation. Token revocation is idempotent and keeps the token's metadata. Token
secrets are returned only by creation, never stored or returned by any read API.

Related: [Platform model](./platform-model.md), [Email](./email.md),
[Persistence](./persistence-boundaries.md).
