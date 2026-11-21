# Product Navigation

Status: The Canvas palette, Geist and the new brand, and the account menu with Theme and Settings, are not built yet. [Milestone 3](../../../plans/canvas-redesign.md#milestone-3-palette-source-fonts-and-brand) builds the palette, Geist and the brand, and [Milestone 13](../../../plans/canvas-redesign.md#milestone-13-cloud-viewer-chrome) builds the account menu.

The product's routes, their resolution and fallbacks, and the navigation shell
around the hosted viewer. Accounts, onboarding, roles and settings are in
[Product accounts and roles](./product-accounts-and-roles.md). See
[Viewer](./viewer.md), [Settings dialog](./settings-dialog.md), and the
[OpenAPI boundary](../../api/README.md); comments and approvals are the draft
contracts of the review phase. Product uses the Canvas palette, Geist and
[shared controls](./shared-controls.md). The Mokly mark, the Geist wordmark
and the signal green are the brand, as [Shell brand](../mokly-shell-brand.md)
defines.

## Routes And Entry

UUIDs are identity; slugs are lookup keys and never grant access. Encode each
path segment with `encodeURIComponent`. Branch names remain query values
because they can contain slashes. The app is the default workload on the shared
origin. The site owns `/`, its declared first segments and built root files;
those values, app static first segments and policy names are reserved against
workspace slugs. See [Marketing site](./marketing-site.md).

| Route                                                     | Purpose / next action                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `/sign-up`, `/sign-in`                                    | Account entry; preserve `returnTo`; linked from the public site     |
| `/auth/email`                                             | Magic link sent; resend or change address                           |
| `/auth/email/callback`                                    | Consume a one-use email link; restore the stored return destination |
| `/workspaces/:uuid/invitations/:uuid/accept`              | Accept a pending invitation for the signed-in address               |
| `/auth/preview/callback`                                  | Exchange a preview's shared sign-in link; open `/dashboard`         |
| `/auth/github/callback`, `/auth/github/install`           | Complete GitHub authorization or installation                       |
| `/connect/desktop`                                        | Sign the desktop app in from the browser; issue a desktop grant     |
| `/auth/desktop/callback`                                  | Exchange a desktop grant in the app; restore the stored destination |
| `/dashboard`                                              | Last opened project; otherwise continue onboarding                  |
| `/new`, `/new?installationId=:id`                         | Create a workspace; carry a candidate installation into onboarding  |
| `/install`, `/install?workspaceId=:uuid`                  | Install the App for a workspace                                     |
| `/install?installationId=:id`                             | Connect a GitHub account to a workspace                             |
| `/:workspace`                                             | Resolve the workspace's last opened project, or create one          |
| `/:workspace/-/new`                                       | Choose an installed repository from a select, and the config path   |
| `/:workspace/-/new/cli`                                   | Create a project that publishes with the CLI                        |
| `/:workspace/:project/setup`                              | Project created; configure publishing                               |
| `/:workspace/:project`                                    | Default branch's latest ready publication viewer                    |
| `/:workspace/:project/branches?branch=...`                | Resolve a branch to its latest ready publication                    |
| `/:workspace/:project/pull-requests/:number`              | Resolve a PR to its latest ready publication                        |
| `/:workspace/:project/publications/:publicationId`        | Immutable publication viewer                                        |
| `/:workspace/:project/builds/:buildId`                    | One build's details in the viewer stage                             |
| `?settings=<pane>` and the settings route forms           | Settings dialog panes; see [Settings dialog](./settings-dialog.md)  |
| `/:workspace/-/settings/github`                           | GitHub accounts settings pane                                       |
| `/workspaces/:uuid`, `/projects/:uuid/…`                  | UUID permalink resolver; replace with the slug route                |
| `/:retired-workspace/…`, `/:workspace/:retired-project/…` | Replace retired slugs with both current slugs                       |

Inside the desktop app, `/sign-in` and `/sign-up` show the entry screen of
[Desktop sign-in](./desktop-sign-in.md#entry-screen), which opens
`/connect/desktop` in the browser.

The `-` sentinel owns workspace-level actions, so project slugs need no
reserved list. Static routes take precedence over `/:workspace`; adding a site or app
root route requires adding its first segment to workspace slug validation
before release. UUID and retired-slug resolvers preserve the complete tail and
query. They replace browser history and never change viewer selection state.

The invitation email opens the acceptance route directly. A signed-out reader
signs in with that route as `returnTo`; the route sends the authenticated POST
with the session CSRF token, then resolves the workspace ID to its current
slug and opens its viewer or project setup. The same reader may reopen the link
because acceptance is idempotent. A different signed-in address cannot accept;
the route offers a way to sign in with the invited address. An expired link
asks for a new invitation, while a temporary failure offers retry. The route
does not read the workspace before acceptance, since pending members have
no access to that read.

The route records a successful acceptance separately from the subsequent
workspace read. If that read fails, it says the invitation was accepted and
offers to open the workspace again. Retrying that read does not submit the
acceptance POST again. A read failure does not claim the invitation expired or
belongs to another account.

The install route has two addresses. `/install?workspaceId=W` is the ordinary
workspace step. `/install?installationId=N` is the connect situation for an
installation that arrived from GitHub without a live flow. It requires a
signed-in session and returns to sign-in with that address when the reader is
signed out. A reader who administers no workspace gets **Create a workspace**,
which opens `/new?installationId=N`. The workspace step carries the ID back to
the install step. A reader who administers several workspaces chooses one in the Workspace
select when the address names none. A named workspace, or the only workspace
the reader administers, appears as a fact row. The action then starts the
candidate flow and returns to GitHub.

Owners, admins and members get **Publish with the CLI instead** on the ordinary
install step and beneath the repository select. It opens
`/:workspace/-/new/cli`. Reviewers get no link. The form's back link opens the
repository step for a connected workspace, or `/install?workspaceId=W`
otherwise. The [account protocol](./product-accounts-and-roles.md#accounts-and-onboarding)
defines the form and repository grouping.

`returnTo` is validated after its outer transport has decoded it: URL query
parsing removes the sign-in URL's encoding, and JSON parsing removes the API
body's encoding. The canonical value therefore begins with `/`; its optional
query still contains the destination's own escapes. Never percent-decode or
re-serialize that complete canonical value. For compatibility, a value that
does not start with `/` but starts with `%2F` (case-insensitive) is accepted as
a wholly encoded destination and decoded exactly once before the same rules
run. No other encoded outer form is accepted.

A literal `#` ends and is removed from the destination; an escaped `%23` in
the query is data and stays escaped. Split the remaining value at its first
literal `?`. Strictly percent-decode the path into a validation-only copy, but
return the original path and query after the optional compatibility decode.
Reject malformed escapes, invalid UTF-8, literal or escaped controls, a scheme,
host, double slash, backslash, colon, residual escape or dot segment in the
decoded path. Also reject `/`, every site-owned first segment, and the
`sign-in`, `sign-up` and `auth` path families, including encoded spellings,
trailing slashes and descendants.

Inspect query structure only at literal `&` and `=` separators. Strictly
form-decode each key for validation and reject `token`, `secret`, `code` or
`session` case-insensitively, including percent-encoded spellings. Keep values
opaque after validating their escapes and controls. Accepted output preserves
escaped query bytes, escape case, literal `+`, Unicode, repeated keys and their
order; encoded `%26`, `%2B` and `%23` remain value data. An absent or rejected
value becomes `/dashboard`. Store the accepted value unchanged through email,
GitHub and desktop grant sign-in. Every API request after navigation rechecks
authorization without disclosing a private resource. Provider landings are
defined in [Authentication callbacks](./auth-callbacks.md).

## Resolution And Fallbacks

Every matched, syntactically valid viewer or resource route resolves to a terminal
destination. Because the viewer is the application, resource recovery lands
inside the viewer chrome wherever the user has one accessible project, and in
onboarding when they have none. No matched valid route ends on an error page or
sends the user to a project or workspace page, because the product has
neither. Invitation acceptance is an account handoff whose refused states stay
on its route so the reader can switch accounts, request another invitation or
retry. An unmatched app path renders the Mokly not-found screen instead.

| Situation                                                  | Destination                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/dashboard`, no workspace                                 | `/new`                                                                                                       |
| `/dashboard`, workspace with no project                    | `/install?workspaceId=W` until the installation is connected, otherwise `/:workspace/-/new`                  |
| `/install?workspaceId=W`, connected                        | `/:workspace/-/new`                                                                                          |
| `/install?workspaceId=W`, owner/admin and absent/suspended | Install step for the workspace's installation state                                                          |
| `/install?workspaceId=W`, member                           | Install step with **Install the Mokly app**, no install action, and the CLI link                             |
| `/install?workspaceId=W`, reviewer                         | Install step with **No projects yet** and no action                                                          |
| `/install?installationId=N`, signed out                    | Sign-in with the full connect address as `returnTo`                                                          |
| `/install?installationId=N`, no administered workspace     | Connect situation with **Create a workspace** opening `/new?installationId=N`                                |
| `/install?installationId=N`, administered workspace        | Connect situation with a fact row or Workspace select                                                        |
| `/:workspace/-/new/cli`, owner/admin/member                | CLI form regardless of installation availability                                                             |
| CLI form Back, connected workspace                         | `/:workspace/-/new`                                                                                          |
| CLI form Back, other workspace state                       | `/install?workspaceId=W`                                                                                     |
| `/dashboard`, a last opened project                        | That project's current slug viewer                                                                           |
| `/:workspace`, no project                                  | `/install?workspaceId=W` until the installation is connected, otherwise that workspace's `/:workspace/-/new` |
| Named workspace unknown or inaccessible                    | Replace with `/dashboard`, then use its ordinary authorized destination                                      |
| `/:workspace/:project`, no ready publication on any ref    | The project's viewer, the default branch's build or publishing card in the stage                             |
| UUID permalink                                             | The subject's current slug route with tail and query preserved                                               |
| Retired workspace or project slug                          | The route with both current slugs, tail and query preserved                                                  |
| Branch or pull request alias with no ready publication     | The project's viewer for that ref, its build or publishing card in the stage                                 |
| Publication expired, deleted or on another project         | The project's viewer, “This publication is unavailable” in the stage, switcher to recover                    |
| Build unknown, deleted, elsewhere or not visible           | The project's viewer, “This build is unavailable” in the stage, switcher to recover                          |
| Project unauthorized, another project accessible           | The last accessible project's viewer with the project switcher open                                          |
| Project unauthorized, no project accessible                | `/dashboard`, which resolves as above                                                                        |
| `?settings=` with no pane, or an unknown pane              | The settings index, then the first available pane                                                            |
| `?settings=project` with no project in scope               | The dialog without the Project section, on the first available pane                                          |
| `/:workspace/-/settings…` with no project                  | The workspace's destination as for `/:workspace`, hosting the dialog on the named pane                       |
| `/settings…` on mobile                                     | The full-screen settings route; no viewer is required                                                        |
| Unmatched product path                                     | App-owned not-found screen with one action to `/dashboard`; no product data is read                          |

With no ready publication, the project and alias rows show the reference's
build, its failed newest publication or the publishing card, as
[Viewer builds](./viewer-builds.md#references-without-a-ready-publication)
orders them; the publishing card is Set up
publishing for a project that cannot build. Its
[reference stage order](./viewer-builds.md#references-without-a-ready-publication)
places an active build before the closed or fork card, then applies the plan
cards, for every project and plan.

A project is in scope for the Project panes when the viewer beneath names one,
or when an account or onboarding route names it with `settingsProject`.
“You need access to this project” is the message the recovery carries; it never
names the project, its workspace or its publications.

The check's details URL resolves to the immutable publication route with
`view=changes`. Screen links add `catalogueScreen`, `viewport`, and `scheme` as
defined in [Viewer address state](./viewer-address-state.md). Share links always pin a publication; they never follow a branch
silently. Refreshing a branch/PR alias may select a newer ready publication,
but refreshing a publication URL never does. Failed uploads do not replace
the latest ready publication. An unpublished branch uses the reference stage
that [Viewer builds](./viewer-builds.md#references-without-a-ready-publication) defines.
A [build check](./changes-check-builds.md) links its build route
instead.

## Navigation Shell

The viewer is the application: there is no project page, workspace page or
workspace sidebar. Separate project and workspace pages were rejected because every list they would hold is a panel the viewer's chrome
already carries, and a page outside the viewer takes the reader away from the
catalogue for nothing the chrome cannot show. Once signed in with a project,
the user is always inside the hosted `@mokly/viewer` stage, and every piece of
cloud chrome lives in the package's slots: the workspace and project
switcher, the branch and pull request switcher, publication history, share,
and the account menu with Theme, Settings and Sign out. Project and workspace
lists are panels opened from that chrome, not destinations. Settings opens the
dialog over the viewer; workspace and project settings are its panes, not
pages. The only
full pages outside the viewer are account entry and onboarding, which end by
opening the new project's viewer with its build or publishing card until the
first publication arrives.

The package host contract, the mapping of five cloud controls into the
package's two top-bar slots, and the mockup representation are in
[Viewer chrome](./viewer-chrome.md); the top bar's geometry is in
[Viewer compositions](./folio-viewer.md).

Mobile keeps the same model: the publication stays in the compact top bar, and
its **More** menu holds the project, History and Share, then the account rows:
who is signed in, Theme, Settings and Sign out. The switcher, history and Share
open as bottom sheets, and Settings opens the full-screen settings layers.
History/share confirmations may use a centered shared modal on desktop or a
bottom sheet on mobile; Escape/Close restores focus to the trigger. Product
screens own one main landmark, one H1 and a skip link. Use Firna typography for
UI text; layout CSS never overrides a control's font, radius or colors.
