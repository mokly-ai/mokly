# Settings Dialog

Status: The account menu's Settings entry and its focus return are not built yet. [Milestone 13](../../../plans/canvas-redesign-milestones-viewer.md#milestone-13-cloud-viewer-chrome) builds them.

Settings for the account, the workspace and the project are panes of one
dialog layered over the viewer the user is in, in the `settings` slot of the
[package host](./viewer-host.md#package-host). Opening settings never
navigates the viewer beneath; closing returns to it unchanged. Mobile presents
the same panes as full-screen routes; the
[architecture doc](../../architecture/cloud.md) places settings among the app's
components. See [Product navigation](./product-navigation.md) for routes,
[Product accounts and roles](./product-accounts-and-roles.md) for roles,
[GitHub accounts](./settings-dialog-github.md) for the workspace account list,
[Shared controls](./shared-controls.md) for the modal and static overlay rules,
and [Product mockups](./product-mockups.md) for the screen inventory.

The dialog and the durable settings routes stay inert while the reader is
signed out: they read no settings scope until the session is signed in. A
signed-out durable route first replaces itself with sign-in and carries its
exact path and query as `returnTo`, which
[Navigation](./product-navigation.md#routes-and-entry) validates and
preserves byte for byte.

## Presentation

- Desktop (and wide web) renders settings as one dialog: a left rail of
  sections and one active pane. The dialog is centered, at most 960px wide
  and between 700px and 90dvh tall, with the page beneath inert.
- A confirmation that interrupts a row or a field renders as a modal over the
  pane: the visibility change, a token revoke, a member removal. The reader is
  answering a question about one subject, so the question is drawn over that
  subject rather than displacing the list around it. The dialog beneath stays
  open and inert, one confirmation modal is open at a time, and a modal opens
  no layer of its own. Deleting a project is not one of these: the danger pane
  is itself the confirmation, reached by navigating to it, and its typed name
  is the deliberate friction, so it stays a pane.
- A secret a write returns once is revealed in the modal that made it rather
  than in a section of the pane beneath, because the value exists for a single
  render and a modal has to be dismissed rather than scrolled past. Only its
  own **Done** closes it; Escape and a press outside do nothing, so a stray
  press cannot lose a secret that is never shown again.
- What the reader types into a modal belongs to the modal, not to the settings
  drafts: the question is answered or declined in one sitting, and declining it
  — **Cancel**, Escape or a press outside — discards it. The dirty guard below
  measures the panes' own fields.
- A row's own actions sit behind its three-dot menu, named for the row. On a
  wide surface the menu opens as a popover anchored to the trigger, and the
  pane stays interactive around it; on a compact one it opens as a bottom sheet
  titled with the row's name, over the whole layer, with **Cancel**. Either way
  it is the one overlay over the pane: Escape, a press outside and **Cancel**
  close it and return focus to the trigger, and choosing a row closes it before
  the confirmation that row opens.
- Mobile and compact widths render each pane as a full-screen layer under the
  settings routes below, with a settings index listing the sections.
  The dialog is a desktop presentation of the same section registry, not a
  second settings system.
- The settings index lists every section and pane. Mobile presents it at
  `/settings`; the desktop dialog shows it in the pane area when the
  `settings` parameter names no pane, while an unknown pane value opens the
  first available pane.
- Focus moves into the dialog on open, and on close returns to the page
  beneath, on the control that opened the dialog: for the account menu's
  Settings, that menu's trigger, as the
  [account menu](./viewer-chrome-account.md#menus) defines. Escape closes
  unless a form is dirty, in which case a discard confirmation appears inline;
  Cancel keeps the draft and the dialog open. The backdrop, Close, the compact
  surface's Back and the browser's back gesture ask the same question, and a
  confirmed discard after a back gesture completes that gesture rather than
  choosing a destination of its own. A gesture that leaves the document the
  surface was loaded into cannot be stopped by the page, so the browser's own
  prompt covers it for exactly as long as a draft exists. A confirmation field
  that already matches what it confirms — the project name in the danger pane
  — is not a draft, because discarding it would lose nothing the reader typed
  that still means anything.
- A confirmation modal takes focus when it opens and returns it to the control
  that opened it when it closes, so a reader who declines lands back on the row
  they came from. Escape and the backdrop decline it, and declining never
  closes the dialog beneath. While its write is in flight the modal stays on
  screen and says what it is doing, and neither Escape nor the backdrop
  abandons a write already sent.
- Unsaved text belongs to settings, not to the pane or the presentation
  showing it. Switching panes, and crossing the breakpoint between the dialog
  and the full-screen layer, keep what the reader typed and restore it on the
  way back, so neither has to ask. Saving, discarding and leaving settings
  forget it.
- A save answers with what was stored, so the field settles itself; spacing
  the save would strip is not a change. Every draft is named for the account,
  workspace or project it belongs to, so one subject's text is never
  offered for another's.
- Every way out of settings asks the same question, including a control inside a
  pane whose destination is outside settings, and one whose effect ends the
  reader's session or otherwise leaves settings without naming a destination —
  signing out, for example. The one exception is a destructive action the reader
  has already confirmed by name and cannot undo, such as deleting a project:
  that confirmation is their answer, a second question could only offer a choice
  the product can no longer honour, and what was unsaved is forgotten on the way
  out rather than left behind.
- Every write a pane makes says it is working while it is, reports what failed
  with one way to try again, and cannot be sent twice by a second press. A
  control sends the fields it names and no others: renaming a project and
  changing its visibility are two writes the reader makes with two controls,
  even where one request carries both.

## Sections And Panes

| Section   | Pane        | Contents                                                                     |
| --------- | ----------- | ---------------------------------------------------------------------------- |
| You       | `account`   | Name, email, GitHub connection, sign out                                     |
| Workspace | `workspace` | Name, plan, slug/address, GitHub accounts fact, projects overview            |
| Workspace | `github`    | GitHub accounts, account actions and connection states                       |
| Workspace | `members`   | Members and roles, pending invitations, invite form, member details          |
| Workspace | `billing`   | Plan, seats in use, renewal and trial facts, Upgrade to Team, Manage billing |
| Project   | `project`   | Name, slug/address, repository and config path, visibility, Automatic builds |
| Project   | `tokens`    | Publishing tokens, a three-dot row menu, modal create/reveal/revoke          |
| Project   | `access`    | Inherited workspace access and project grants                                |
| Project   | `danger`    | Delete project with name confirmation                                        |

Repository and config path are read-only. The `project` pane's Automatic
builds switch is defined in
[Viewer build navigation](./viewer-build-navigation.md#project-setting-and-onboarding).

The Workspace pane's **GitHub accounts** fact row and its administrator-only
**Manage** action follow the rules in [GitHub accounts](./settings-dialog-github.md).

Project panes appear only when a project is in scope. Administrators see every
pane; members and reviewers see You and read-only Workspace and Project
panes without destructive or credential actions. The `billing` pane is shown
to owners and admins only, and only owners see its Upgrade
to Team and Manage billing actions; members and reviewers read the plan name
as a fact on the Workspace pane instead. Its states, the Checkout return
and the seat consequence the invite form shows on Team are defined
in [Billing](./billing.md). Roles are defined in
[Product accounts and roles](./product-accounts-and-roles.md#roles-and-settings).
Workspace panes appear only when the settings scope resolved an authorized
workspace read. A project-only guest keeps the Project section and its
canonical slug routes, but sees no Workspace or Members pane: the
workspace slug carried by a project is navigation data, not workspace
access.

## URL Grammar

Desktop addresses the dialog with a `settings` query parameter on any product
page: `?settings=<pane>`. Pane values are the identifiers in the table.
Project scope comes from the viewer beneath, which always has a project;
onboarding and account routes name it with `settingsProject=<projectId>`, and a
missing or unauthorized project hides the project section rather than failing
the page.
An empty `settings` value shows the index; an unknown value opens the first
available pane. `returnTo` handling and authorization follow the navigation
protocol; the parameter never carries credentials and its query is never
decoded or serialized as part of a settings handoff.
Mobile and the durable deep-link form use routes:

| Route                                  | Pane           |
| -------------------------------------- | -------------- |
| `/settings`                            | Settings index |
| `/settings/account`                    | `account`      |
| `/:workspace/-/settings`               | `workspace`    |
| `/:workspace/-/settings/github`        | `github`       |
| `/:workspace/-/settings/members`       | `members`      |
| `/:workspace/-/settings/billing`       | `billing`      |
| `/:workspace/:project/settings`        | `project`      |
| `/:workspace/:project/settings/tokens` | `tokens`       |
| `/:workspace/:project/settings/access` | `access`       |
| `/:workspace/:project/settings/danger` | `danger`       |

On desktop these routes redirect to the project's viewer (the workspace's
last opened project for workspace routes) with `?settings=` set,
preserving any query state. When the workspace has no project, the redirect
targets the workspace's destination in the Navigation table with the same
`?settings=` value, so the dialog still opens over the page the user is on. Share and help links use the
route form so they work on every surface; the complete table of terminal
destinations is in
[Navigation](./product-navigation.md#resolution-and-fallbacks).

## History And Entry Points

What the dialog costs the history stack is specified with every other
surface's, in [Web product shell](./web-product-shell.md#settings). On the full-screen
layer each pane is its own screen, so reaching one is a step Back takes the
reader out of, to the index they came from. Entry points are the account
menu's Settings, which opens the index because it names no pane, the workspace
and project switcher's settings actions, and the token-created flow, which
lands on its pane with the relevant row selected. The viewer bar carries no
Settings action of its own, as [Viewer chrome](./viewer-chrome.md#slot-inventory)
defines. Invitation acceptance opens the accepted workspace's viewer or
project setup.
External returns (GitHub installation, Stripe Checkout
and the Customer Portal) arrive on the route form and redirect into the dialog
on desktop. The Checkout return carries `checkout=success` or
`checkout=cancelled`. A successful return shows the confirming state for up to
thirty seconds, including one read at the end of that window, and the pane's
ordinary load never races it. A Team read shows the Team facts, and every pane
and the page beneath then show Team without a reload. A Free read after the
bounded wait shows **Still confirming your subscription** and only
**Check again**; that control makes one fresh read and returns to the delayed
state while the plan remains Free. The success path never offers Upgrade to
Team again. A failed confirmation read shows **Billing couldn’t load** with its
reference and one **Try again**; a failed Check again read stays beside that
control with the same failure fragment. Only a successful Free read enters the
delayed state. Either return value is removed from the address without adding
a history entry.

## States

[Settings dialog states](./settings-dialog-states.md) defines what a pane
draws while it loads and while it writes, how it reports a failure, and how
it edits a name or an address.

## Mockup Representation

[Settings mockups](./settings-mockups.md) defines pane paths, state variants,
confirmation/reveal screens and static dialog/layer composition. Pane entries
use path identities.
