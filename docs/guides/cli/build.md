---
title: "build"
description: "Generate the catalogue's documents and manifest in one transaction."
section: "cli"
order: 2
---

## Usage

```shell
npx mokly build
npx mokly build --watch
```

## Options

| Option            | Meaning                                                      |
| ----------------- | ------------------------------------------------------------ |
| `--config <path>` | Use an explicit `mokly.config` file                          |
| `--watch`         | Rebuild after validated source changes using Serve's watcher |
| `--debug-timings` | Report phase timings and catalogue counts on standard error  |

## What it writes

Only under `<mockupsDir>/.generated/`: one document per screen for each
effective viewport and color scheme, the documents of your pages, and
`mokly-manifest.json`. The entire directory is disposable and replaced as a
transaction; a failed build leaves the previous output in place. Your
authored stylesheet and other referenced assets stay in `mockupsDir` outside
`.generated/`.

The manifest stays internal: its source inventory is never served over HTTP,
published in an export or included in comparison resources. Ordinary public
JSON beside your catalogue is unaffected unless it is referenced by the
catalogue; only referenced assets are served and exported.

## Git tracking and watching

Git index tracking, not a config option or `.gitignore` lookup, decides whether
`check` compares generated files. Either commit the **entire** `.generated/`
tree, or ignore that directory and `.mokly-cache/`. Partially tracked output
is an error with instructions for both choices.

`build --watch` performs an initial build and then uses Serve's debounce and
source rules. Every successful complete compilation replaces `.generated/`;
errors preserve the last-good tree and watching continues. Plain `serve` and
`export` never write generated output. Use `serve --build` to opt into writing
while you browse.
