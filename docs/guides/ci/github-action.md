---
title: "GitHub Action"
description: "Publish a catalogue from a GitHub workflow with the public composite action."
section: "ci"
order: 1
---

## What the action does

The public composite action installs an exact published `@mokly/mokly`
release in the runner's temporary storage and runs its `publish` command
against the endpoint you give it. It uses no private repository or package
interface, so it works with any service that implements the upload contract.

<!-- x-release-please-start-version -->

It is maintained in the Mokly repository at
`.github/actions/publish`. Pin it to a reviewed commit, and set `version` to
an exact published release such as 0.11.0; a range or a tag is refused.
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
          config: mokly.config.ts
          base: origin/main
```

Pin `actions/checkout` and `actions/setup-node` to commit hashes of your own
choosing, and replace `COMMIT_SHA` with the action commit you reviewed.

## Inputs

| Input        | Required | Meaning                                                     |
| ------------ | -------- | ----------------------------------------------------------- |
| `version`    | yes      | Exact published version; ranges, tags and URLs are refused  |
| `endpoint`   | yes      | Full receiver URL                                           |
| `token`      | yes      | Bearer credential, forwarded only through the environment   |
| `config`     | no       | Config path relative to the working directory               |
| `base`       | no       | Comparison ref; otherwise the config's own base             |
| `no-changes` | no       | `true` publishes without comparisons; conflicts with `base` |

## What it leaves to you

The action sets up Node and runs the command. Checking out your repository,
installing its dependencies, fetching enough history for the comparison, and
any comment you want on the pull request are yours. Success means the service
accepted the upload; a failure exits with the command's own code and category.
