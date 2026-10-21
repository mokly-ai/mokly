---
title: "build"
description: "Validate and render a complete static catalogue."
section: "cli"
order: 2
---

## Usage

```shell
npx mokly build
npx mokly build --no-changes --out .context/site --strict
npx mokly build --config tools/mokly.config.json --base origin/main
```

## Options

| Option                      | Meaning                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `--config {path}`           | Load a JSON configuration file. Omission searches upward.                                           |
| `--out {directory}`         | Write beside the config for a relative path. The default is `mokly-static/` at the repository root. |
| `--base {ref}`              | Override `review.base`, whose default is `origin/main`.                                             |
| `--base-install-scripts`    | Run lifecycle scripts during base dependency installation.                                          |
| `--no-base-install-scripts` | Keep lifecycle scripts disabled during base dependency installation.                                |
| `--no-changes`              | Build current content without Git history or a comparison.                                          |
| `--strict`                  | Fail on warnings before output installation.                                                        |
| `--sidecars {count}`        | Set the positive JavaScript worker count.                                                           |
| `--debug-timings`           | Select plain output and report timing records.                                                      |

`--base` and `--no-changes` cannot be combined. Build starts no server or
watcher. Use [Serve](/docs/cli/serve/) for watched browsing.

## Output

The output contains `index.html`, `404.html`, and one shell stub at
`view/{entry path}/index.html`. `mokly-viewer/` holds the browser client,
catalogue index, entry details, styles, fonts, and any comparison generation.
`static/mokly-generated/` holds rendered documents and generated resources.
`static/` also holds exactly the authored resources the catalogue references.

The ownership marker lists every file and its exact digest. Identical inputs
produce identical output, including its deployment identity. Static controls
are read-only and make no live render request.

## Destination and recovery

The output must be a strict descendant of the repository root. It cannot
overlap source roots, protected inputs, dependencies, or runtime directories.
Git must ignore it. Mokly accepts missing or empty output and complete output
that its current ownership marker authorizes.

A reservation stops competing writers. The build stages the new output and
checks its inputs again before installation. A changed input fails with a
retry instruction. A failed installation restores the old output when the
destination is still absent. Recovery never overwrites a newly created
folder. A cleanup failure names the remaining reservation or backup.

## Warnings and exit status

Warnings appear on standard error. Without `--strict`, warnings do not change
the exit status. With it, the build fails before installation. Success exits
`0` and prints the output directory, file count, and deployment instruction.
A failure or cancellation exits `1` with its error category.

See [static delivery](/docs/reference/export-delivery/) for host requirements.

Ignore `.mokly-export-reservations/` in Git as well as the selected output.
The owned reservation namespace stays after cleanup.
