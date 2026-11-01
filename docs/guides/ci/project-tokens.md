---
title: "Project tokens"
description: "The credential a publishing job presents, and where it belongs."
section: "ci"
order: 3
---

## Keep the checkout clean

Publish requires committed HEAD and a clean checkout before the build and again
before upload. Commit source changes before the job runs. Keep build products
ignored by Git. Mokly builds in a private directory outside the checkout and
prints its location before rendering. Ignored files and operation-owned
reservations do not count as uncommitted changes.

Use `npm ci` to install the committed dependency lockfile. A job that changes
tracked sources or creates non-ignored files must resolve those changes before
it publishes.

## One token per publishing job

Publishing presents a bearer token to the endpoint you name. The token is read
from `MOKLY_TOKEN` or from `--token`, and it is sent in the `Authorization`
header of every upload request, only to the endpoint's own origin, and
nowhere else.

## Where to keep it

Keep the token in your CI system's secret storage and expose it to the job as
an environment variable. A token on the command line ends up in shell history
and in job logs. [Keep the token safe](/docs/cli/publish/#keep-the-token-safe)
gives the variable to use and the other risks of `--token`.

A token that begins with `-` needs the assigned form so it is not read as an
option:

```shell
npx mokly publish --token=-TOKEN
```

## What the token controls

The service that receives the upload decides what a token may do. The upload
names the repository, the branch and the revision it came from, and it is the
receiver that checks whether that token is allowed to publish for that
repository before it exposes anything.

Mokly never prints the token, including in error messages and diagnostics, and
it never writes it into the output. It also keeps the token out of the
processes that render your catalogue and out of base dependency installs.
[Keep the token safe](/docs/cli/publish/#keep-the-token-safe) gives the limit
of this protection and what to do about it.

## Rotating

Because the token lives only in your CI secrets, rotating it is a change in
one place. A rejected token fails the job with the `upload-unauthorized`
category rather than a partial publication.
