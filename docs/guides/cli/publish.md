---
title: "publish"
description: "Build a catalogue from a clean checkout and upload it."
section: "cli"
order: 5
---

## Usage

```shell
npx mokly publish
npx mokly publish --no-changes
npx mokly publish --config tools/mokly.config.json --base origin/main
```

Set `MOKLY_ENDPOINT` and `MOKLY_TOKEN` in your shell or CI secrets. The endpoint
is the receiver's Plan URL. For Mokly Cloud it is
`https://api.mokly.ai/v1/projects/{projectId}/publications`.

## Options

| Option                           | Meaning                                                      |
| -------------------------------- | ------------------------------------------------------------ |
| `--config {path}`                | Load a JSON configuration file.                              |
| `--endpoint {url}`               | Override `MOKLY_ENDPOINT`.                                   |
| `--token {token}`                | Override `MOKLY_TOKEN`. Prefer the environment for secrets.  |
| `--repository {host/owner/name}` | Override repository identity detection.                      |
| `--base {ref}`                   | Override `review.base`, whose default is `origin/main`.      |
| `--no-changes`                   | Publish current content without base history or comparisons. |
| `--upload-concurrency {count}`   | Send 1 to 32 missing blobs at once. The default is 8.        |
| `--strict`                       | Fail on build warnings before output installation or upload. |
| `--sidecars {count}`             | Set the positive JavaScript worker count.                    |
| `--debug-timings`                | Select plain output and report timing records.               |

Value options also accept `--name=value`. Use `--token=-TOKEN` for a token
that starts with a hyphen. `--base` conflicts with `--no-changes`.
Publish chooses its own private output directory outside the repository.

## Checkout and identity

Publish requires committed HEAD and a clean checkout. It checks the whole
repository before the build and again before upload. Commit, stash, or ignore
uncommitted files first. A changed HEAD or new source edit stops publication.
Ignored build products and operation-owned temporary paths do not count.

Repository identity comes from `origin`, or the sole remote if `origin` is
absent. Use `--repository` when several remotes are ambiguous. Credentials
in remote URLs never enter the published identity.

`--no-changes` needs no base history. It still needs committed HEAD so the
receiver can identify the publication. With Changes, fetch enough history
before the command runs. Publish never fetches it.

## Upload and retry

Publish prints `Mokly publish build: {directory}` before it builds.
It sends the upload metadata and ownership inventory first. The receiver
returns the content digests it needs. Publish sends those exact immutable
bytes and then asks the receiver to complete the publication.

Requests have at most five attempts for temporary failures. One expired or
incomplete upload can start a new Plan. Rerunning the command reuses content
that the receiver already stored. Redirects are never followed, and bearer
credentials stay on the endpoint's origin.

The receiver keeps the first completed publication for a commit and config
path. Success prints uploaded and unchanged counts, or says that this commit
is already published. An accepted viewer URL appears on its own line.

## Failures

A build error stops publication before upload. Warnings stop publication only
with `--strict`. A failed upload
keeps the complete local build at the printed directory. Cancellation exits
`1` and reports that publication was cancelled. A recovery failure keeps its
own error category and names the directory that needs recovery.

See [the upload contract](/docs/reference/upload/) and
[exchange rules](/docs/reference/upload-exchange/) for receiver integration.
