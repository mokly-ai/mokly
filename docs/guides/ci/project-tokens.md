---
title: "Project tokens"
description: "The credential a publishing job presents, and where it belongs."
section: "ci"
order: 3
---

## One token per publishing job

Publishing presents a bearer token to the endpoint you name. The token is read
from `MOKLY_TOKEN` or from `--token`, and it is sent in the `Authorization`
header of every upload request, only to the endpoint's own origin, and
nowhere else.

## Where to keep it

Keep the token in your CI system's secret storage and expose it to the job as
an environment variable. Prefer the environment variable to the option: a
command line ends up in shell history and in job logs, and an environment
variable does not.

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
it never writes it into the export.

## Rotating

Because the token lives only in your CI secrets, rotating it is a change in
one place. A rejected token fails the job with the `upload-unauthorized`
category rather than a partial publication.
