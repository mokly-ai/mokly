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
| `--strict`        | Fail before writing when the build reports warnings         |

## What it produces

Export builds first, then packages the catalogue: one shell page per entry at
`view/<path>/index.html`, the generated views and documents under `static/`,
assets and Git comparisons. The result is a directory of static files. Export
never uploads anything.

Deploy the directory's contents at the root of an HTTP(S) origin. Hosting
requirements are on the Catalogue page for export and hosting.

## Warnings

Export prints the warnings of the build it packages on standard error and
still exports. With `--strict` it prints them and stops before writing the
destination. The failure says `1 build warning with --strict` for one warning
and `<n> build warnings with --strict` otherwise.

## The destination

`--out` resolves beside the loaded config rather than your working directory,
and an absolute path must stay inside the repository root. Choose a directory
that is missing or empty and outside your source, generated, dependency and
comparison roots, and keep unrelated files out of it.

A re-export replaces only the output it owns, and restores the previous site
if installation fails and recovery is safe. If something else recreates the
destination while an export is running, both it and the captured backup are
kept for you to recover by hand.

Every exported path must be portable: relative slash-separated Unicode with no
control character, backslash, colon, empty segment, `.` or `..`, and at most
1,024 UTF-8 bytes. When a path is refused, Mokly prints it with invisible
characters escaped so you can rename the file or folder. If the destination
holds an export from an earlier Mokly release, move any files you added before
deleting that folder and exporting again.

## History

`--base` overrides `review.base`, which defaults to `origin/main`. The branch
point must exist in the checkout together with the authored assets and either
the committed generated output or the tooling a derived baseline rebuild
needs. In CI, check out the full history.

Warnings name a generated page, an entry, a component, a folder or the
configuration file. Strict mode counts all warnings, including ignored inputs.
