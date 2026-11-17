# Platform Model

The platform is the account and workspace boundary of the
[REST API](./rest-api.md). [GitHub App](./github-app.md) defines installation
authorization within this workspace and project model.

## Entities

All entity identifiers are server-generated UUID v7 values and are opaque to
clients. Timestamps are UTC RFC 3339. Mutable resources carry an integer
`version` starting at 1; successful edits increment it.

| Entity         | Identity and lifetime                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| User           | Unique normalized email, display name and creation time; created after verification except for the configured capability-gated preview account |
| Workspace      | UUID, name, current slug, personal kind and plan (`free` or `team`); creation atomically adds its creator as owner                             |
| Workspace slug | Workspace and globally unique current or retired slug claim                                                                                    |
| Membership     | Workspace and normalized email; optional user until accepted; role, version and invitation expiry                                              |
| Project        | UUID, workspace, repository identity, repository-relative config path, optional repository link, name, current slug, visibility, version       |
| Project slug   | Workspace, project and current or retired slug claim unique within that workspace                                                              |
| Project grant  | Project and existing user, role, version; additive to workspace membership                                                                     |
| Project token  | Project, name, public prefix, hash, creation/last-use time, revocation time                                                                    |
| Build          | Project, reference, head SHA and lifecycle state of one [cloud build](./cloud-builds.md)                                                       |
| Magic link     | Email, secret hash, return destination, expiry; consumed atomically once                                                                       |
| Session        | User, credential hash, CSRF token, absolute/idle deadlines                                                                                     |

The configured [preview account](./auth-sessions.md#preview-sign-in) is the
one user created without email verification, and only where its capability
allows it.

A personal workspace is independent of GitHub, may have multiple members,
and is explicitly created during onboarding. Account verification does not
create a hidden workspace. Workspaces start on `free`, except for the
configured preview account's initial plan in [Billing](./billing.md#plan-catalogue). The stored `plan`
is on every workspace read. [Billing plan gates](./billing-plan-gates.md#plan-gated-writes)
defines the plan-gated writes.
The billing webhook worker is the only writer of the plan.
[Billing plan gates](./billing-plan-gates.md#plan-gated-writes) also defines
what deleting a workspace does to a live subscription.
A workspace connects zero or more GitHub App installations after
account administration proof. One installation belongs to at most one
workspace. A GitHub installation represents a personal account or a GitHub
organization account. GitHub sign-in still writes the user-kind integration;
installation linking no longer writes or reads the organization-kind
`integrations` row. Without a user integration, `githubConnected` is false.
Deleting the subject deletes its integration.

The workspace is the billing and member unit and holds projects directly.
One workspace per GitHub account was rejected because it bills the same people
once per account. A team above the workspace was rejected because it adds an
entity with no billing or member meaning.

Workspace `githubInstallationState` summarizes its bound installations:

- `connected`: at least one installation is connected and active.
- `suspended`: none is connected and active, but at least one is connected and inactive.
- `absent`: neither condition holds.

The Workspace read carries `id`, `name`, `slug`, `role`, `plan`,
`githubInstallationState` and `version`. Account names and manage URLs come from
[installation reads](./github-app.md#installation-and-authorization).
Workspace reads follow the workspace-read role matrix. A project-only guest
cannot read them. Account `githubConnected` describes the separate user
integration, not installation availability.

Email is trimmed and ASCII case-folded, with one `@`, a nonempty local part,
and a dotted domain; length at most 254 bytes. Commas, whitespace, controls,
and angle brackets are rejected to prevent multiple mail recipients. Display
names are trimmed, 1–80 Unicode characters, with no control characters.
New users start with their verified email as the display name and may edit it.
The configured preview account instead starts with its configured email as the
display name when the capability permits creation without verification. The
API offers no account email change; one would need a separate verified-address
flow.

## Slugs

Slugs are address lookup keys, never identity, ownership or authorization.
Workspace and project UUIDs are the only API identity. A slug lookup
resolves a current or retired claim to that UUID, then applies the same access
decision as the UUID read. Unknown and inaccessible private subjects both
return `not-found`. A public project lookup may be anonymous without exposing
its workspace's private DTO.

Both slug kinds use lowercase ASCII letters, digits and single interior
hyphens: `^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9]))*$`. Workspace slugs are 1–39
characters and project slugs 1–100. The API neither trims nor lowercases a
submitted slug and rejects any value that parses as a UUID. Slugs are required
by every create and full update command.

Every current and retired workspace slug claim is globally unique; a
project slug claim is unique within its workspace. A rename keeps the old
claim as retired, and a subject may take back its own retired slug. Another
subject can never acquire a current or retired claim. Deleting a subject
releases all of its claims.

Workspace slugs also reject three reserved sources: the marketing site's
declared routes and built root names, the app's static root routes and asset
names, and a forward-looking policy set including infrastructure, account and
brand terms. A new reserved word after launch requires an audit migration for
collisions before validation changes. Project slugs have no reserved words
because workspace actions use the `-` sentinel.

Authenticated suggestion reads produce editable candidates without moving
validation rules into the app. Slugification applies Unicode NFKD and lowercase, keeps
ASCII letters and digits, changes each other run to one hyphen, trims hyphens,
truncates to the applicable maximum and trims again. An empty result uses
`workspace` or `project`. A workspace suggestion derives from the
caller-supplied source name. Onboarding supplies the entered personal
workspace name because creation precedes installation; a later installation
binds that workspace and preserves its chosen slug. The same generic read
accepts a real GitHub login as the source name when a caller already has one,
but never infers a slug from an installation. It tries the derived base, then
`-2`, `-3` and so on, shortening the base to fit. Reserved, UUID-shaped,
current and retired claims are skipped.

A project suggestion starts with the repository name. If that base is already
claimed or UUID-shaped, it next tries `<repository>-<config-stem>`, where the
stem is the config filename without its final `.json`, slugified
with `config` as the empty fallback; it then adds numeric suffixes.
Suggestions never reserve a
slug, reveal the conflicting subject or replace create-time uniqueness checks.
The `slug-taken` and workspace-only `slug-reserved` refusals return the next
safe candidate so a race has a useful recovery.

## Roles

| Action                                           | Owner | Admin | Member | Reviewer |
| ------------------------------------------------ | ----- | ----- | ------ | -------- |
| Read workspace and its projects                  | Yes   | Yes   | Yes    | Yes      |
| Create project                                   | Yes   | Yes   | Yes    | No       |
| Rename workspace, invite/manage non-owners       | Yes   | Yes   | No     | No       |
| Promote/demote/remove an owner; delete workspace | Yes   | No    | No     | No       |
| Administer every workspace project               | Yes   | Yes   | No     | No       |
| Request a build                                  | Yes   | Yes   | Yes    | No       |
| Cancel a build                                   | Yes   | Yes   | Yes    | No       |
| Change Automatic builds                          | Yes   | Yes   | No     | No       |
| Read billing status, seats and renewal facts     | Yes   | Yes   | No     | No       |
| Start Checkout, open the Customer Portal         | Yes   | No    | No     | No       |

The last active owner cannot be removed or demoted, including concurrent
requests. Owner invitations are rejected: ownership is transferred/promoted
only after acceptance. Admins cannot edit owners or grant the owner role.
Pending invitations never count as owners. Self-removal requires the same
administrative permission as removal of another member.

The project creator receives a direct admin grant. Project grants allow
`admin`, `member`, `reviewer`; owners inherit `admin`. Effective access is the
strongest inherited or direct role. Removing or lowering a direct grant never
reduces inherited access. A project-only guest can read only its granted
projects and cannot read workspace metadata or its member directory.
Inherited grant rows have `id: null` and omit `version`; only direct grants
have editable grant IDs and versions. Grant-list cursors carry an internal
source identifier for stable pagination without presenting it as a grant ID.
Only effective project admins manage grants, tokens, settings and deletion.
Only workspace owners/admins read the email-bearing member directory.

Every project response carries `publishingAllowed`. It is always true for a
public project and, for a private project, is derived from the owning
workspace's current plan. This is a project capability, not a workspace
read: anonymous public readers cannot infer the plan, and direct grantees can
decide whether the current project accepts publications without receiving the
plan, billing facts or any workspace role. Billing actions are restricted
to workspace owners.

## Projects And Visibility

A project has an optional repository link. A linked project uses an installed
GitHub repository. A project without a repository link publishes with the
Mokly CLI, by hand or from CI, through its project token. It has no builds,
GitHub check or pull request details. Its `buildsAvailable` is false and its
publication `pullRequest` context is null. Mokly hosts publications, compares
versions and keeps history for either project.

A project has one workspace/repository/config-path identity. Config paths
are required API inputs: repository-relative paths to a JSON configuration
file, which end in `.json`. Project creation and the project
slug suggestion refuse any other path, including a `.ts` path, with
`validation-failed`. Accepting TypeScript paths as well was
rejected, because the supported Mokly releases read only a JSON configuration.
The app supplies `mokly.config.json` as its default; the API applies no
default. Reject empty path
segments, dot segments, `..`, absolute paths, backslashes and controls.
Names and config paths cannot change repository ownership or grant access.

Project creation accepts exactly one of `repositoryId` and `repository`.
`repositoryId` resolves an active repository in an active, connected
installation bound to the requested workspace. Creation checks that access
atomically and retains a link with the stable provider identity. Installation
removal preserves project history.

`repository` accepts the pinned Mokly CLI's repository identity grammar:

- The full form is `<host>/<owner>/<name>`.
- A two-segment `<owner>/<name>` uses `github.com` as its host.
- The host is lowercase DNS or IPv4 without a port, at most 253 bytes.
- The owner may contain slash-separated groups and is at most 255 bytes.
- The name is one segment and is at most 255 bytes.
- Segments contain ASCII letters, digits, `.`, `_` and `-`, and cannot be `.` or `..`.
- Remove one trailing `.git` suffix.

The API stores the canonical identity in lowercase. It stores `<owner>/<name>`
for `github.com`, and `<host>/<owner>/<name>` for other hosts. This form creates
no repository link and starts with `automaticBuilds` false. A workspace allows
one project per stored identity and config path. A duplicate returns
`duplicate-project` with the existing project ID, whether either project has a link.

[Billing plan gates](./billing-plan-gates.md#plan-gated-writes) defines the
visibility of a new project on each plan and the plan that a change to private
needs. Changing a project to public and editing an existing private project do
not require Team. Public visibility grants anonymous project reads and
publication reads; it never grants mutations or member/token-directory access.
A private transition takes effect on the next request. Lists under a
workspace still require membership. Approval policy is persisted as false;
enabling it returns `operation-unavailable` because there is no review
feature. Repository and config path are immutable after creation.

Cloud builds add the Automatic builds setting of
[cloud builds](./cloud-builds.md#availability-and-eligibility) to projects linked
to GitHub. It is on for new projects linked to GitHub. Effective project admins
change it through the full project update. A project without a repository link
starts with it off and cannot turn it on. Builds and their logs follow member access, not public
visibility. Effective project admins and members may request and cancel builds,
and a build publishes only while the project's `publishingAllowed` capability
holds; reviewers may read builds.

## Invitations And Deletion

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

Project deletion requires its current name and version and atomically removes
its grants and credentials. Workspace deletion requires an owner, name and
version, detaches all GitHub installations bound to it, and cascades its
projects and memberships. Detachment preserves repository references from
projects in other workspaces that previously disconnected from the same
installation. Deleted reads return 404;
there is no restore or soft-delete state. Sessions end on sign-out, expiry or
rotation. Token revocation is idempotent and keeps the token's metadata. Token
secrets are returned only by creation, never stored or returned by any read API.

Related: [Navigation](./product-navigation.md),
[Settings](./settings-dialog.md), [Persistence](./persistence-boundaries.md).
