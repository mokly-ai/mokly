# GitHub Accounts Settings Pane

The `github` pane is the workspace's account list. It is a pane of the
[settings dialog](./settings-dialog.md), not a standalone settings page. It
opens at `?settings=github` over the working page and at
`/:workspace/-/settings/github` on mobile or as a durable link.

## Section And Roles

The pane is in the Workspace section. Its title is **GitHub accounts**. Owners
and admins see the section action **Add GitHub account**. Members and reviewers
can read the rows but see no section action and no row menu.

The add action starts the installation flow with the pane's durable address as
`returnTo`. The flow can bind another GitHub account to the same workspace.

## Account Rows

Each row shows the account name and then **Personal** or **Organization**. A
connected row has no state word. A suspended row adds **Suspended** and a
**Resume on GitHub** link. The link opens the account's GitHub manage page in a
new tab.

Owners and admins get a three-dot menu named for the account. The menu contains
**Manage on GitHub**, which opens the account's manage page in a new tab, and
**Remove**. Members and reviewers do not get this menu.

**Remove** opens a confirmation modal with the row's account name in the title,
such as **Remove mokly-ai?**. The modal says "Mokly stops reading its
repositories. Its projects and publications stay." It offers **Remove** and
**Cancel**. While the write runs, the action says **Removing…**. Removing the
local binding does not delete projects or publications.

## States

The empty state says **No GitHub accounts yet**. Owners and admins get
**Add GitHub account** in that state. Members and reviewers get no action.

The loading state names "Loading GitHub accounts" and draws the pane's
[wait](./folio-chrome.md#compositions) with one placeholder row. The error
state says "GitHub accounts couldn’t load" and offers **Try again**. Loading
keeps the pane landmarks. An error keeps the pane open and places its retry
beside the failed read.

The account list includes every installation bound to the workspace, including
suspended installations. Each row keeps its own manage link and removal action.

The Workspace pane has one fact row labelled **GitHub accounts**. Its value is
the bound account names joined by ", ". A suspended account reads
"mokly-ai · Suspended". With no bound account, the value is "None". Owners and
admins get a quiet **Manage** action beside the fact. It opens this pane. The
row follows workspace-read access, so every active member role sees the account
names and suspension state. The pane has no separate GitHub account or App
facts and no Manage installation action.
