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
with any service that implements the current upload contract. Mokly Cloud
requires a receiver and viewer update for this format. Until then, publishing
fails with: "The catalogue service does not support this Mokly version. Update
the service and try again." It does not retry or downgrade the artifact.

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
| `--strict`                           | Fail before upload when the build reports warnings                     |

## Warnings

After the checkout passes its first check, Publish reports the export's build
warnings the same way `export` does. With `--strict` it prints them and stops
before uploading. The failure says
`1 build warning with --strict` for one warning and
`<n> build warnings with --strict` otherwise.

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
history and cannot be combined with `--base`. Publishing without Changes skips
the historical rebuild regardless of head tracking. Either way, publish needs a Git checkout
with a commit, because the upload identifies the revision it came from.
If the base was built by an earlier Mokly version, publish prints the reason
and uploads the current catalogue with Changes unavailable.

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
tried up to five times. Before attempts two through five, publish waits a
random duration of at most 1, 2, 4 and 8 seconds respectively, unless a valid
`Retry-After` asks for up to sixty seconds. When the Plan expires, or the
service reports expiry, publish plans once more and continues from content
already stored for the project. Redirects are never followed.

## What you see

Success prints one line, for example
`Published Mokly catalogue. 1 file uploaded, 266 unchanged.` or
`Published Mokly catalogue. 12 files uploaded, 255 unchanged.`, and, when the
service returns one, the catalogue address on the next line. The uploaded count
includes marker entries whose digest matches a Plan-archive file and every
entry sharing a digest whose Blob PUT was attempted; the others are unchanged. A first
publish to an empty service therefore reports `0 unchanged`.

In a terminal, progress includes marker entries matching Plan files from its first
frame and advances all entries sharing each completed digest. It reads
`Uploading 0 of 1 file · <size>` for one file and uses `files` otherwise. A
re-plan restarts the round label; an empty missing set shows no progress label.

A service keeps the first publication it completed for a commit and config
path. Publishing that commit again prints
`Mokly catalogue already published for this commit.` with the existing
catalogue's address. Publish requires a clean checkout before export and again
before upload. Commit, stash or ignore uncommitted files first. Git-ignored
files, this run's `--out` directory, and Mokly's own caches and temporary files
never count. Committed generated files count. If they are out of date, run
`mokly build` and commit the result. Derived generated output must be ignored;
the error names the `.gitignore` rules to add.

A failed publish leaves the complete local export in place for you to inspect,
and running it again resumes from whatever the service already stored.
Cancelling prints
`[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.`
instead of telling you to check the connection. If Mokly could not put your
previous export back, it prints the recovery error with the folder to recover
instead, even when you cancelled.

Warnings name a generated page, an entry, a component, a folder or the
configuration file. Strict mode counts all warnings, including ignored inputs.
