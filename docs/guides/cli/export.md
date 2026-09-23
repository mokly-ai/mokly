---
title: "export"
description: "Package a complete static catalogue you can deploy anywhere."
section: "cli"
order: 4
---

## Usage

```shell
npx mokly export --out .context/mokly-site
```

## Options

| Option            | Meaning                                                     |
| ----------------- | ----------------------------------------------------------- |
| `--out <path>`    | Config-relative export directory; required                  |
| `--config <path>` | Use an explicit `mokly.config` file                         |
| `--base <ref>`    | Git base ref used to find the branch point                  |
| `--debug-timings` | Report phase timings and catalogue counts on standard error |

## What it produces

Export compiles without writing generated files to your catalogue, then
packages every screen and page under `.generated/`, the referenced authored
assets at their catalogue-relative paths, real id aliases and Git comparisons.
It does not copy unrelated files or upload anything.

Deploy the directory's contents at the root of an HTTP(S) origin. Hosting
requirements are on the Catalogue page for export and hosting.

## The destination

`--out` resolves beside the loaded config rather than your working directory,
and an absolute path must stay inside the repository root. Choose a directory
that is missing or empty and neither contains nor is contained by
`.generated/`; it must also stay outside source, dependency and
comparison roots, and keep unrelated files out of it.

A re-export replaces only the output it owns, and restores the previous site
if installation fails and recovery is safe. If something else recreates the
destination while an export is running, both it and the captured backup are
kept for you to recover by hand.

## History

`--base` overrides `review.base`, which defaults to `origin/main`. The branch
point must exist in the checkout with enough history to read its complete
generated tree or rebuild it using that commit's own dependencies and tooling.
In CI, check out the full history and use a trusted base for rebuilds.
