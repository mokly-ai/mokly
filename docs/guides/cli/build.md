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

## What it writes

Under `mockupsDir`, one directory per entry named by its path: a document per
effective viewport and color scheme for each screen and component variant,
the document of each page, the light and dark renderings of each Markdown
document, and `mokly-manifest.json` beside them. Writes are transactional, so
a failed build leaves the previous output in place.

The manifest stays internal: its source inventory is never served over HTTP,
published in an export or included in comparison resources. Ordinary public
JSON beside your catalogue is unaffected.

## Overwriting

Mokly will not overwrite an HTML file that does not carry a valid Mokly
ownership header, so authored output is never deleted by a build. Move the
authored file or give the entry a different path; Mokly derives every
generated file name from it.

## Committed and derived output

With the default `generatedOutput: "derived"`, keep the generated routes, the
manifest and `.mokly-cache/` out of Git; build still writes them locally in the
same transaction. With `generatedOutput: "committed"`, commit what build
writes.
