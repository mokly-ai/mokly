---
title: "Settings"
description: "The panes that hold your account, a workspace, a project, its tokens and its access."
section: "cloud"
order: 7
status: "ahead"
---

<!-- Source: mokly-cloud protocol/settings-dialog.md, protocol/settings-dialog-github.md, protocol/product-navigation.md, protocol/product-accounts-and-roles.md, protocol/viewer-builds.md -->

## Settings open over the page

Settings open over whatever you were doing and close back to it unchanged. On a
narrow screen each pane is a full-screen page with an index listing the
sections; the panes themselves are the same on both.

## The panes

| Section   | Pane        | What it holds                                                       |
| --------- | ----------- | ------------------------------------------------------------------- |
| You       | `account`   | Name, email, GitHub connection, sign out                            |
| Workspace | `workspace` | Name, GitHub accounts, projects overview                            |
| Workspace | `github`    | GitHub accounts and connection actions                              |
| Workspace | `members`   | Members and roles, pending invitations, invite form, member details |
| Workspace | `billing`   | Plan, seats in use, renewal and trial facts, upgrade and payment    |
| Project   | `project`   | Name, repository and config path, visibility, Automatic builds      |
| Project   | `tokens`    | Publishing tokens, create, reveal once, revoke                      |
| Project   | `access`    | Inherited workspace access and project grants                       |
| Project   | `danger`    | Delete the project                                                  |

The project panes appear when a project is in scope. Administrators see every
pane; members and reviewers see their account and read-only workspace and
project panes, without the destructive and credential actions.

The **GitHub accounts** pane lists every account connected to the workspace.
Owners and admins can add an account, manage it on GitHub or remove it. Members
and reviewers can read the list.

## The project pane

The repository and config path are fixed once the project exists. Visibility is
private or public, and changing it asks you to confirm what the change does to
who can read the project's publications. Automatic builds turns builds of
pushes and pull requests on or off.

## Tokens

The tokens pane lists each publishing token by name and prefix, when it was
created and when it was last used. A new token's secret appears once, in a
state of its own, and never again in a list or an address — copy it into your
CI secret storage while it is on screen.

Revoking asks for confirmation. Create the replacement first and publishing
does not stop.

## Members

The members pane invites people, sets their role, shows invitations that are
still pending and revokes them. Removing a member is confirmed.

## Deleting a project

The danger pane names the project, states that its publications become
unavailable, and keeps the control disabled until you type the name back.
