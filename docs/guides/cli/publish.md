---
title: "publish"
description: "Export the catalogue and upload it to a service you choose."
section: "cli"
order: 5
---

## Usage

```shell
npx mokly publish
```

Publish runs the export, then uploads it once to the endpoint you name. It
works with Mokly Cloud or with any service that implements the upload
contract.

## Options

| Option                               | Meaning                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `--endpoint <url>`                   | Upload URL; overrides `MOKLY_ENDPOINT`                                 |
| `--token <token>`                    | Bearer token; overrides `MOKLY_TOKEN`                                  |
| `--out <path>`                       | Config-relative export directory; defaults to `.context/mokly-publish` |
| `--config <path>`                    | Use an explicit `mokly.config` file                                    |
| `--base <ref>`                       | Git base ref used to find the branch point                             |
| `--no-changes`                       | Publish the current catalogue with no comparison baseline              |
| `--repository <host>/<owner>/<name>` | Override the detected repository identity                              |
| `--debug-timings`                    | Report phase timings and catalogue counts on standard error            |

## Credentials

Set `MOKLY_ENDPOINT` and `MOKLY_TOKEN` in your shell or your CI secrets;
prefer the environment variable for the token so it stays out of your shell
history. For a token that begins with `-`, use the assigned form
`--token=-TOKEN`. The token never appears in output, including errors.

## Comparisons

Comparisons are included unless you pass `--no-changes`, which needs no
history and cannot be combined with `--base`. Publishing without Changes skips
the historical rebuild regardless of head tracking. Either way, publish needs a Git checkout
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

One gzip tarball of the export, posted once to the exact endpoint. The export
includes `mokly-upload.json`, which names the repository, the revision and the
pinned comparison. The command does not follow redirects and does not retry;
a failed upload leaves the complete local export in place for you to inspect.
