---
title: "Publish from CI"
description: "Run the publish command from any continuous integration system."
section: "ci"
order: 2
---

## The command

Any CI system can install the package and run the command directly:

```shell
npm ci
npx --no-install mokly publish --config mokly.config.ts --base origin/main
```

Set `MOKLY_ENDPOINT` and `MOKLY_TOKEN` as secrets of the job rather than
passing them in a shell command.

## Check out enough history

Publish compares your branch with the point it shares with the base ref, so
the checkout needs the full history, not the single commit CI clones by
default. On GitHub Actions that is `fetch-depth: 0`.

Check out the pull request's head commit, not the merge commit CI creates for
you, so that the revision in the upload is the branch you are reviewing.

If you would rather not carry history at all, publish the current catalogue
alone with `--no-changes`. There is then no baseline to fetch, and a derived
catalogue skips its historical rebuild too.

## Keep the credentials safe

Your authoring code runs during the export, so only grant upload credentials
to workflows you trust. A pull request from a fork should not receive them.

## What success prints

The last line of a successful job is
`Published Mokly catalogue. 12 files uploaded, 266 unchanged.` with the
counts of that run, followed by the published catalogue's address when the
service returns one. Only files the service did not already hold are sent, so
a job that publishes an unchanged catalogue uploads nothing and still succeeds.

## What a failure tells you

The command exits non-zero with a category, so a job log says whether the
build failed, the history was missing or the service refused the upload.
Temporary failures are retried before the job fails, and rerunning the job
resumes from whatever the service already stored. The token is never printed,
and no response body or header is echoed.
