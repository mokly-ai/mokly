---
title: "build"
description: "Generate the catalogue's documents and manifest in one transaction."
section: "cli"
order: 2
---

## Usage

```shell
npx mokly build
```

## Options

| Option            | Meaning                                                     |
| ----------------- | ----------------------------------------------------------- |
| `--config <path>` | Use an explicit `mokly.config` file                         |
| `--debug-timings` | Report phase timings and catalogue counts on standard error |
| `--strict`        | Fail before writing when the build reports warnings         |

## Warnings

A build can succeed with warnings, for example a styled link placed inside a
button. Each warning is one line on standard error naming the route and the
element, the output is still written, and the exit status stays `0`. Pass
`--strict` to print the warnings and then fail without writing anything.
The failure says `1 build warning with --strict` for one warning and
`<n> build warnings with --strict` otherwise.

## What it writes

Under `mockupsDir`, one directory per entry named by its path: a document per
effective viewport and color scheme for each screen and component variant,
the document of each page, Markdown documents per enabled scheme and their
copied resources, generated CSS/assets beneath `mokly-generated/`,
and `mokly-manifest.json`. Writes are transactional, so a failed build leaves
the previous output in place.

The manifest stays internal: its source inventory is never served over HTTP,
published in an export or included in comparison resources. Ordinary public
JSON beside your catalogue is unaffected.

## Overwriting

Mokly will not overwrite an HTML file that does not carry a valid Mokly
ownership header, so authored output is never deleted by a build. Move the
authored file or give the entry a different path; Mokly derives every
generated file name from it.

Mokly owns and replaces the entire `mokly-generated/` directory: do not put
consumer-authored files there. Build removes obsolete files anywhere in that
reserved directory after a successful transaction.

## Committed and derived output

With the default `generatedOutput: "derived"`, keep the generated routes, the
manifest, `mokly-generated/` and `.mokly-cache/` out of Git; build still
writes them locally in the same transaction. With `generatedOutput:
"committed"`, commit what build writes to `mockupsDir`. When the repository is
a Git work-tree root, Build and Check reject generated files hidden by
`.gitignore`; the error names the matching rule and a negation to add in that
rule's `.gitignore` file. Do not ignore the mockups directory itself: remove
that rule or choose derived output.

In both modes, Mokly keeps private state in `.mokly-cache/` at the repository
root and writes a `.gitignore` file inside it, so Git never shows or adds that
folder. Also list `.mokly-cache/` in your root `.gitignore` when other tools,
such as formatters or linters, read only that file.
