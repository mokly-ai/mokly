# Product Accounts And Roles

Account entry and onboarding, the workspace and project roles, the slug
rules, and the states every owning screen has. The routes these screens live
on, their resolution and fallbacks, and the navigation shell are in
[Product navigation](./product-navigation.md). The panes that administer a
workspace or a project are in [Settings dialog](./settings-dialog.md).

## Accounts And Onboarding

Email sign-in and sign-up share the same one-use link process; sending a link
never reveals whether an account exists. The sent page shows the submitted
email, “Check your email”, Resend link and Change email. Pending delivery disables
resend; rate limits show a server-supplied retry time. Callback loading, expired
link, and declined GitHub access have distinct recovery text. Do not invent
token lifetimes or limits in UI; the auth API returns applicable deadlines.

Onboarding is three steps: Workspace, Install, Repository. A new account
starts at `/new`; `/dashboard` sends any signed-in reader with no workspace
there. There is no earlier step, so the workspace step has no back link.
The header names the signed-in reader on every step, per
[Folio chrome](./folio-chrome.md), and no panel repeats it.

Personal workspace creation requires a trimmed name (1–80 characters) and a slug.
The authenticated suggestion read derives an available candidate from the
entered workspace name, and creation submits the displayed slug explicitly.
Installing the GitHub App later binds that existing workspace and preserves
its chosen slug. The generic suggestion read also accepts a real GitHub login
as its source name when a caller already has one; it does not infer one from an
installation. Suggestions are advisory: a nonempty value already displayed remains
submittable while a later suggestion refreshes or fails. The create command
validates the complete form and rechecks availability. An initially empty slug
still disables creation. Late suggestions never replace a reader's own edit.
Automatic field updates pause as soon as it receives focus, before typing can
begin. An untouched field accepts the latest suggestion when focus leaves it.
While either form waits for its suggestion, it keeps the entered name or real
repository and shows “Finding an available address” in the address preview
under the slug field, in place of the address, and inserts nothing.
That pending form is distinct from loading the workspace or repository
screen and never fills the field with invented data.

The install step, `/install?workspaceId=W`, reads the workspace's
`githubInstallationState` and the reader's role. An owner or admin sees
**Install the Mokly app**, the line "Choose the repositories Mokly can read.",
and **Install on GitHub**. A suspended workspace also shows its suspension as a
fact with **Resume on GitHub**. When the installation list cannot be read, the
fact keeps **Suspended** and shows "Couldn’t load" with a quiet **Try again**
in place of the link. A member sees **Install the Mokly app** and the
line "Ask an owner or admin to install it." Members get no installation
action. A reviewer sees **No projects yet** and the line "Ask an owner or admin
to create the first project." Reviewers get no action or CLI link. Owners,
admins and members also get **Publish with the CLI instead** beneath the
actions. It opens the workspace's `/:workspace/-/new/cli` form. A connected
workspace sends the reader to the repository step.

`/install?installationId=N` is the connect situation. It requires a signed-in
session. A signed-out reader signs in with this address as `returnTo`. The
screen title is **Connect a GitHub account** and its action is **Continue on
GitHub**, with the GitHub glyph. The action starts the candidate flow for the
selected workspace.

When the address names no workspace and the reader administers at least one,
the screen shows a **Workspace** select over those workspaces, starting on the
first. The select's last choice is **Create a workspace**, which opens
`/new?installationId=N`. The select shows also for one workspace, so the reader
can always put the account in a new workspace instead. When the address names a
workspace that the reader administers, the screen shows a **Workspace** fact
row with the workspace name. While the workspaces load it
says "Loading your workspaces". If the read fails it says "Workspaces couldn’t
load" and offers **Try again**. A reader who administers no workspace sees the
line "Create a workspace to connect this account." and the action **Create a
workspace**, which opens `/new?installationId=N`.

The workspace step carries `installationId=N` to the install step after it
creates the workspace. The flow then keeps the order Workspace, Install,
Repository. Installation cancellation returns to the install screen. Installing
links the reader's GitHub identity to their account when it is not linked yet;
the account pane offers **Connect GitHub** on demand for a reader who signed up
by email and wants to sign in with GitHub, and that is the only screen that
starts a signed-in connection.

The repository step, `/:workspace/-/new`, has a searchable **Repository**
select. It reads the workspace-filtered installation list and the repositories
of each connected installation. With several connected installations, it
groups the options into one section per GitHub account, titled with its name.
With one connected installation, the select stays flat. The sentence beneath
it is "Don’t see it? Manage repository access". With one bound account, the
link opens that installation's manage page on GitHub in a new tab. With several
bound accounts, it opens the `github` settings pane.

Config path and the project slug with its address preview follow the select.
**Create project** submits the selected repository's API identifier. Below the
select, **Publish with the CLI instead** opens `/:workspace/-/new/cli` for
owners, admins and members. Reviewers get no link. An empty list shows the
disabled select over "No repositories yet". The manage sentence and CLI link
remain available to their authorized roles. A failed read offers **Try again**.
The select contains only repositories the App can read.

The CLI form is `/:workspace/-/new/cli`, step 3 of the setup strip. Its title is
**Publish with the CLI**. It asks for **Repository**, Config path and the
project slug with its address preview, then offers **Create project**. Repository
accepts the [CLI identity grammar](./platform-model.md#projects-and-visibility).
The back link opens the repository step when the workspace has a connected
installation. Otherwise it opens `/install?workspaceId=W`. The form creates a
project without a repository link, which publishes with the CLI by hand or from
CI through a project token.

A project belongs to one workspace and has one repository identity and config
path. It can also link an installed repository chosen by its API identifier.
Its required slug is suggested from the repository and config path, remains
editable, and previews the resulting address. A free workspace's project is
created public and the repository step and the finished project both say so,
while a Team workspace's projects stay private by default (see
[Billing plan gates](./billing-plan-gates.md)). The config
path defaults to `mokly.config.json`. It accepts a
repository-relative path that ends in `.json` and rejects absolute paths, `..`
segments and every other extension, as
[Platform model](./platform-model.md#projects-and-visibility) defines.
Repository names are API
values. A duplicate pair returns the existing project link. Project-created
shows the repository, config path, and publishing setup. Publish from CI opens
the served `/docs/ci/publish-from-ci/` guide; the upload command and its
details are defined by [Publication upload](./publication-upload.md). When the
default branch's first [cloud build](./cloud-builds.md) is active,
project-created says that branch is being published and leads with Open
project, keeping the CI setup guide secondary; otherwise the guide leads.

## Roles And Settings

A workspace has owner, admin, member and reviewer roles. Owners/admins
manage projects and invitations; only owners manage owner roles or delete a
workspace. Last-owner removal/demotion is rejected atomically. Members may
create projects and open accessible publications. Reviewers may read but
cannot administer projects. Commenting and approving, and the reviewer and
approval permissions with them, are the draft contracts in
[Screen comments](./screen-comments.md) and [Approvals](./approvals.md), whose
routes answer 503. Project grants use admin, member,
reviewer; workspace owners/admins inherit project administration. Project
grants may add access but never reduce inherited rights. A workspace member
can see its projects; a project-only guest sees only explicitly granted projects.

### Slugs

Workspace owners and admins may change its slug. Effective project admins
may change a project slug. Each full update carries the current resource
version and all required settings fields. A successful rename keeps the old
slug as a claim for the same subject, so old checks, shared links and stored
return destinations resolve and replace themselves with the current route.
The create and settings forms show the suggested/current address, but the API
alone decides grammar, reserved words and availability. A taken or reserved
workspace slug and a taken project slug return a safe suggested replacement.

Project settings are the `project`, `tokens`, `access` and `danger` panes of
the [settings dialog](./settings-dialog.md). The project pane includes name,
repository/config (read-only after creation), visibility (`private` default on
Team, `public` on the free plan) and the administrator-only Automatic builds
switch, which a project that cannot build replaces with one sentence; the
approval policy is part of the [Approvals](./approvals.md) draft. A visibility
change requires a confirmation naming its access consequence. Making a project
private on the free plan is refused with `plan-required` inside that
confirmation modal, with the owner's way on leaving it for the Billing pane and
one sentence for everyone else; workspace billing is the `billing` pane,
where owners upgrade and manage the subscription and admins read it; and the
seat each invitation or grant adds on Team is named beside the control that
adds it.
Public makes publications readable to anyone with a link; it does not grant
write access. Making private invalidates public access on subsequent requests.

Tokens are shown as name, prefix, creation and last-use timestamps. A created
secret is revealed once in a dedicated state and never appears in lists or URL
state. Revoke requires confirmation; an authorized replacement can be created
first. Mockups use a clearly non-secret example, never a working credential.
Member management offers Invite, role selection, pending invitations, revoke,
and removal confirmation. Danger zone names the project before deletion, states
that publications become unavailable, and requires matching its name.
Destructive controls remain disabled until the confirmation is valid.

## States And Fixture Boundary

Every owning screen has default, empty, loading, and error pages.
“Empty” means the screen's missing input or data, not a forced empty list: sign-up
has an untouched form; sent email has no pending link; an overlay can have no
matching rows. Each state specifies a useful next
action, while loading retains landmarks and draws the screen's own layout, as
the [Wait](./folio-chrome.md#compositions) composition defines. Error text
names the failed operation and offers one applicable retry/back action; stale
data may remain only with an explicit indication and disabled unsafe actions.

The screen inventory and concrete state copy live in
[Product mockups](./product-mockups.md). These fixtures describe Mokly Cloud's
own repository and catalogue, with no invented customer content or claims.
All fixture data stays under `docs/mockups`; the product reads the API.
Normal screens carry no environment badges or build annotations.
