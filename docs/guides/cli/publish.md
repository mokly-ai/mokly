---
title: "publish"
description: "Export the catalogue and upload only the files the service does not already hold."
section: "cli"
order: 5
---

## Usage

```shell
npx mokly publish
```

Publish runs the export, then hands it to the endpoint you name in three
steps: it sends the export's file list with a digest for every file, the
service answers with the digests it does not hold, publish uploads only those
files, and the service commits the publication. It works with Mokly Cloud or
with any service that implements the upload contract.

## Options

| Option                               | Meaning                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `--endpoint <url>`                   | The service's plan URL; overrides `MOKLY_ENDPOINT`                     |
| `--token <token>`                    | Bearer token; overrides `MOKLY_TOKEN`                                  |
| `--out <path>`                       | Config-relative export directory; defaults to `.context/mokly-publish` |
| `--config <path>`                    | Use an explicit `mokly.config` file                                    |
| `--base <ref>`                       | Git base ref used to find the branch point                             |
| `--no-changes`                       | Publish the current catalogue with no comparison baseline              |
| `--repository <host>/<owner>/<name>` | Override the detected repository identity                              |
| `--upload-concurrency <n>`           | Upload 1 to 32 missing files at once; defaults to 8                    |
| `--debug-timings`                    | Report phase timings and catalogue counts on standard error            |

## Credentials

Set `MOKLY_ENDPOINT` and `MOKLY_TOKEN` in your shell or your CI secrets;
prefer the environment variable for the token so it stays out of your shell
history. The endpoint is the address of the service's plan route, for Mokly
Cloud `https://api.mokly.ai/v1/projects/<projectId>/publications`; publish
posts to it exactly, never appends a path, and takes every other address from
the service's answer. For a token that begins with `-`, use the assigned form
`--token=-TOKEN`. The token never appears in output, including errors, and is
only ever sent to the endpoint's own origin.

## Comparisons

Comparisons are included unless you pass `--no-changes`, which needs no
history and cannot be combined with `--base`. A derived catalogue also skips
the historical rebuild in that mode. Either way, publish needs a Git checkout
with a commit, because the upload identifies the revision it came from.

## Repository identity

Identity comes from the `origin` remote, or from the only remote when there is
no `origin`; several other remotes are ambiguous and fail. Credentials in a
remote URL are discarded and never printed. `--repository` overrides
detection:

```shell
npx mokly publish --no-changes --repository git.example.com/team/project
```

## What is uploaded

The export's `mokly-upload.json`, its ownership marker and, with comparisons,
the pinned comparison file go first, as one small archive posted to the exact
endpoint. The marker lists every exported file with its SHA-256 digest and byte
size, so the service can answer with the digests it is missing. Publish then
uploads each missing file's bytes, up to `--upload-concurrency` files at a
time, and asks the service to complete the publication. A service that already holds
every digest receives no blob PUT; the plan artifacts still go first so the
service can validate and complete the publication.

A request that fails in transit or is answered with a temporary status is
retried up to five times with growing delays. When the plan's expiry time
passes, or the service reports that the upload expired, publish plans once
more and continues from what the service already holds. Redirects are never
followed.

## What you see

Success prints one line, for example
`Published Mokly catalogue. 12 files uploaded, 266 unchanged.`, and, when the
service returns one, the address of the published catalogue on the line after
it. In a terminal, publish also shows how many of the requested files have
been uploaded so far.

A service keeps the first publication it completed for a commit and config
path. Publishing that commit again prints
`Mokly catalogue already published for this commit.` with the existing
catalogue's address, and uncommitted changes in the working tree are not a
way to replace a published commit.

A failed publish leaves the complete local export in place for you to inspect,
and running it again resumes from whatever the service already stored.
