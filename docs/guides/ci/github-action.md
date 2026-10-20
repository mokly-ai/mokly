---
title: "GitHub Action"
description: "Publish a catalogue from a GitHub workflow with the public composite action."
section: "ci"
order: 1
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

## What the action does

The public composite action installs an exact published `@mokly/mokly`
release in the runner's temporary storage and runs its `publish` command
against the endpoint you give it. It uses no private repository or package
interface, so it works with any service that implements the upload contract.

<!-- x-release-please-start-version -->

It is maintained in the Mokly repository at
`.github/actions/publish`. Pin it to a reviewed commit, and set `version` to
an exact published release such as 0.14.0; a range or a tag is refused.
<!-- x-release-please-end -->

## A workflow

```yaml
name: Publish catalogue
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  publish:
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
      - uses: actions/setup-node@v6
        with:
          node-version: "24.21"
      - run: npm ci
      - uses: mokly-ai/mokly/.github/actions/publish@COMMIT_SHA
        with:
          version: ${{ vars.MOKLY_VERSION }}
          endpoint: ${{ vars.MOKLY_ENDPOINT }}
          token: ${{ secrets.MOKLY_TOKEN }}
          config: mokly.config.json
          base: origin/main
```

Pin `actions/checkout` and `actions/setup-node` to commit hashes of your own
choosing, and replace `COMMIT_SHA` with the action commit you reviewed.

## Inputs

| Input        | Required | Meaning                                                     |
| ------------ | -------- | ----------------------------------------------------------- |
| `version`    | yes      | Exact published version; ranges, tags and URLs are refused  |
| `endpoint`   | yes      | Full URL of the receiver's plan route                       |
| `token`      | yes      | Bearer credential, forwarded only through the environment   |
| `config`     | no       | Config path relative to the working directory               |
| `base`       | no       | Comparison ref; otherwise the config's own base             |
| `no-changes` | no       | `true` publishes without comparisons; conflicts with `base` |

## What it leaves to you

The action uses the tested Node 24.21 lane and runs the command. Published Mokly
releases support Node.js 22.15 or newer except Node 23 and Node 24.14 through 24.18; 24.21
is a tested representative, not the lower bound. Checking out your repository,
installing its dependencies, fetching enough history for the comparison, and
any comment you want on the pull request are yours. The action has no input
for upload concurrency, so the command's default applies. Success means the
service completed the publication; a failure exits with the command's own code
and category.
