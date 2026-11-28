---
title: "Builds"
description: "How Mokly Cloud builds and publishes your branches and pull requests without a CI workflow."
section: "cloud"
order: 3
status: "ahead"
---

<!-- Source: mokly-cloud protocol/cloud/cloud-builds.md, protocol/cloud/cloud-build-runner.md, protocol/cloud/viewer-builds.md, protocol/cloud/billing.md -->

## Publishing without CI

Once the GitHub App is installed and a project is created from one of its
repositories, Mokly Cloud builds the catalogue itself. Each build checks out
the exact commit in a fresh, isolated environment, installs your dependencies
from your lockfile, runs your repository's own `mokly publish`, and publishes
the result exactly as an upload from CI would be published.

## What builds automatically

| Event                                      | What is published                            |
| ------------------------------------------ | -------------------------------------------- |
| A push to the default branch               | The current catalogue                        |
| A pull request opened, reopened or updated | The catalogue, with Changes against its base |
| A new project linked to GitHub             | The default branch, once                     |

Mokly builds pull requests whose branch is in the repository. Review a fork’s
screens locally, as [The check on a pull request](/docs/ci/the-check-on-a-pull-request/#forks)
describes. Any other branch publishes when a project member presses Publish
this branch, and compares against the default branch.

Automatic builds is on for new projects linked to GitHub. An administrator can
turn it off in project settings when CI already publishes the project. A
project without a repository link keeps Automatic builds off and publishes with
the CLI. Private projects build and publish on Team, as Plans and billing
describes.

## How a build runs

| Step      | What happens                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------- |
| Check out | The commit, plus the base branch when the build compares against one                              |
| Install   | pnpm, Yarn or npm from the lockfile nearest your config; a repository without one skips this step |
| Publish   | Your installed `mokly`, or the version Mokly Cloud pins when the repository installs none         |

Projects that install with Bun publish from CI, and a repository's own Mokly
must be 0.18.0 or later. Each build has fifteen minutes. Checking out stops
after two minutes without output and installing after five. A workspace
runs two builds at a time; more wait their turn.

## Following a build

The switcher and history show Publishing while a build runs and Failed if it
does not publish. A build's details show its steps and live output; project
members can cancel a running build or try a failed one again. The `Mokly`
check on the commit moves from queued to in progress to the result, and its
details link opens the build.

A newer push to the default branch, or a new commit on a pull request, replaces
that branch's or pull request's build while it is still waiting or running,
and the check on the older commit reads as cancelled.

## What a build can reach

Each build runs in its own isolated environment, which is discarded when the
build ends. It receives a read-only token for its one repository and a
single-use upload token for its own head; it holds no other credential. It
can reach public registries and the internet, and nothing on Mokly Cloud's
private network. Build output is visible to project members.

## Publishing from CI

Uploads from CI keep working alongside builds; the Continuous integration
section covers the action, the command and the token.
