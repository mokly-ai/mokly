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

| Option            | Meaning                                                     |
| ----------------- | ----------------------------------------------------------- |
| `--config <path>` | Use an explicit `mokly.config` file                         |
| `--watch`         | Rebuild after validated source changes                      |
| `--debug-timings` | Report phase timings and catalogue counts on standard error |
| `--strict`        | Fail before writing when the build reports warnings         |

## Warnings

A build can succeed with warnings, for example a styled link placed inside a
button. Each warning is one line on standard error naming the route and the
element, the output is still written, and the exit status stays `0`. Pass
`--strict` to print the warnings and then fail without writing anything.
The failure says `1 build warning with --strict` for one warning and
`<n> build warnings with --strict` otherwise.

With `--watch --strict`, a warning rejects that compilation and keeps the last
successful output. Watching continues so you can repair the source.

## What it writes

Generated output goes only under `<mockupsDir>/mokly-generated/`: one directory per entry named by
its path, with a document per effective viewport and color scheme for screens
and component variants, each page, Markdown documents and copied resources,
`mokly-manifest.json`, compiled CSS in `styles/` and copied CSS assets in `assets/`.
The entire directory is disposable and replaced as a transaction; a failed
build leaves the previous output in place. Referenced authored assets stay
under `mockupsDir` outside `mokly-generated/`.

The manifest stays internal: its source inventory is never served over HTTP,
published in an export or included in comparison resources. Ordinary public
JSON beside your catalogue is unaffected unless it is referenced by the
catalogue; only referenced assets are served and exported.

## Git tracking and watching

Only `check` reads the Git index to decide whether to compare generated files;
`build` never reads head tracking or refuses to write a new route. Either
commit the **entire** `mokly-generated/` tree, or ignore that directory. After building a new entry in a tracked catalogue, `check`
lists its route under `untracked:` until it is staged. Only `check` reports
partial tracking, with instructions for both choices.

`build --watch` performs an initial build and then watches configured inputs with debounced
rebuilds. Every successful complete compilation replaces `mokly-generated/`;
errors preserve the last-good tree and watching continues. Plain `serve` and
`export` never write generated output. Use `serve --build` to opt into writing
while you browse.

Mokly keeps private state in `.mokly-cache/` at the repository
root and writes a `.gitignore` file inside it, so Git never shows or adds that
folder. Also list `.mokly-cache/` in your root `.gitignore` when other tools,
such as formatters or linters, read only that file.

Warnings name a generated page, an entry, a component, a folder or the
configuration file. Strict mode counts all warnings, including ignored inputs.
