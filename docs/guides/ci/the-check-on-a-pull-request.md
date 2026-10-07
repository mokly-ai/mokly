---
title: "The check on a pull request"
description: "How publishing shows up while a pull request is being reviewed."
section: "ci"
order: 5
---

## Keep the checkout clean

Publish requires a clean checkout before export and again before upload.
Git-ignored files, this run's output directory, and Mokly's own caches and
temporary files never count. Committed generated files count and must match the
build. Derived generated output must be ignored by Git.

A build step that changes tracked files or leaves files that Git does not ignore
stops the publish. Commit generated changes before the job runs. Add build
products to `.gitignore`. Use `npm ci` to install from the committed lockfile
without changing it.

## The job is the check

When the publishing workflow runs on `pull_request`, its job appears as a
check on that pull request. The check passes when the catalogue built,
compared cleanly against the base and was accepted by the service; it fails
with the category that explains which of those did not happen.

## Publish the branch, not the merge

Check out the pull request's head commit so the upload identifies the branch
under review. With the merge reference CI checks out by default, the revision
in the upload is a synthetic merge commit that exists nowhere else.

On GitHub Actions the branch and the pull request number are read from the
job's own environment, so the upload carries them without any configuration
from you.

## Comparisons on a pull request

Give the job the full history and a base ref, and the published catalogue
carries the comparison between the branch and the point it shares with that
base: the screens that changed, the ones that were added and the ones that
were removed.

## Forks

A pull request from a fork must not receive your upload credentials, because
the export runs the code in that pull request. Guard the job so it only runs
for branches of your own repository, and review a fork's screens locally.
