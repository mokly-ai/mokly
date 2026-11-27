---
title: "Connect a repository"
description: "Create a workspace, then link a GitHub repository or publish with the Mokly CLI."
section: "cloud"
order: 2
status: "ahead"
---

<!-- Source: mokly-cloud protocol/cloud/product-navigation.md, protocol/cloud/product-accounts-and-roles.md, protocol/cloud/cloud-builds.md -->

## Sign in

Signing in and signing up are the same one-use email link. Give your address,
then open the link from your mail to finish. The sent page shows the address
you submitted and offers Resend link and Change email. Sending a link never
tells anyone whether an account already exists.

## Create a workspace

Your first screen after signing in creates a workspace: the team that owns
projects and can invite members. Give it a name and continue.

## Install the GitHub App

To let Mokly build your catalogue, install the App on the personal GitHub
account or GitHub organization that owns the code. Choose which repositories
it can read. You can change that selection on GitHub at any time. Installing
also links your GitHub identity to Mokly for sign-in. Cancelling returns you to
the install step.

A workspace can connect several GitHub accounts. Add another account from the
**GitHub accounts** settings pane. A workspace with a connected installation
goes straight to choosing a repository.

An installation started on GitHub, or a change saved with Configure on GitHub,
returns to Mokly as **Connect a GitHub account**. Choose the workspace, then
**Continue on GitHub**. A GitHub account belongs to one workspace. If another
workspace has it, remove it from that workspace first. When an owner of a
GitHub organization must approve the App, Mokly shows **Installation
requested**.

Owners and admins can install the App. Owners, admins and members can choose
**Publish with the CLI instead** on the install step or beneath the repository
select. Reviewers cannot create projects.

## Choose the repository and the config path

Pick a repository that the App can read. With one connected installation, the
list is flat. With several, it groups repositories under their GitHub account
names. **Manage repository access** opens the GitHub accounts settings pane.
There you add another GitHub account, or open an account on GitHub to change
which repositories the App can read.

The config path defaults to `mokly.config.json`. It can be any repository-relative
`.json` path without absolute paths or `..` segments.

Creating a project for a repository and config path that already has one opens
the existing project instead of making a second.

## Publish with the CLI

**Publish with the CLI instead** opens a form titled **Publish with the CLI**.
Enter **Repository**, Config path and the project slug, then choose
**Create project**. Repository accepts `<host>/<owner>/<name>` from any Git
host. A two-segment `<owner>/<name>` uses `github.com`.

The project has no repository link. Publish with the Mokly CLI by hand or from
CI, using a project token. Mokly hosts the catalogue, compares versions and
keeps history. The project has no builds, GitHub check or pull request details.
Automatic builds stays off.

## Start publishing

A new project linked to GitHub starts publishing its default branch. **Open
project** takes you to it while it builds. Builds covers later automatic
publishing.

The CLI can also publish a project linked to GitHub. The Continuous integration
section covers the publish action, command and project token.
