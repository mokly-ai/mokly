---
title: "Workspaces and roles"
description: "Who administers a workspace, who reviews a project, and how a project grant works."
section: "cloud"
order: 6
status: "ahead"
---

<!-- Source: mokly-cloud protocol/product-navigation.md, protocol/product-accounts-and-roles.md -->

## Roles in a workspace

| Role     | What it carries                                                       |
| -------- | --------------------------------------------------------------------- |
| Owner    | Everything an admin does, plus owner roles and deleting the workspace |
| Admin    | Projects and invitations                                              |
| Member   | Create projects and open the publications they can reach              |
| Reviewer | Read a project and take part in its review, without administering it  |

A workspace keeps at least one owner. Removing the last owner, or changing
their role, is refused.

## Grants on a single project

A project can grant admin, member or reviewer to someone directly. Owners and
admins of the workspace already administer every project in it, and a
project grant only adds access; it never reduces what someone already has.

A member of the workspace sees the workspace's projects. Someone who
holds a project grant and nothing else sees only the projects they were
granted.

## What a role means in review

Reviewers, members and admins comment on screens and approve a publication. A
reviewer cannot administer the project, and read access to a public project on
its own never allows writing. A change of role or the loss of access applies
from the next request.
