---
title: "Build"
description: "Write a complete static catalogue that you can deploy."
section: "start"
order: 4
---

## Build the catalogue

```shell
npx mokly build --no-changes
```

Build validates the catalogue and renders every saved view. It writes the
browser shell, entry details, documents, styles, and referenced assets to
`mokly-static/` at the repository root. A static file server can serve these
files without the source tree or a Mokly process.

Add `/mokly-static/` and `.mokly-export-reservations/` to the root `.gitignore`.
The reservation namespace stays after a build. Keep source files in Git.

## Choose an output directory

```shell
npx mokly build --no-changes --out .context/site --strict
```

A relative `--out` path resolves beside the loaded configuration file.
The directory must be inside the repository and outside the catalogue roots
and protected source inputs. Use a missing directory, an empty directory, or
output from an earlier build. Mokly refuses a directory with unowned files.

Build replaces the complete output. A failed build preserves the earlier
site when recovery is safe. If another process creates the destination during
replacement, Mokly keeps that directory and names the retained backup.

## Include Changes

Omit `--no-changes` to include Changes against the configured base.
Use `--base` to select another reference:

```shell
npx mokly build --base origin/main
```

The checkout must contain HEAD, the base, and their common history.
Build never fetches Git history. A current-only build with `--no-changes`
needs no Git checkout. Do not combine `--base` with `--no-changes`.

## Validate sources

Use `--strict` to make warnings fail the build. Mokly prints the warnings
before it stops. To validate without keeping a deployment, build into an
ignored temporary output directory.

Use [Serve](/docs/start/serve/) while editing. Use
[static hosting](/docs/catalogue/export-and-host/) to share the built site.
