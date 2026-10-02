---
title: "check"
description: "Prove the catalogue in the repository matches the sources it came from."
section: "cli"
order: 3
---

## Usage

```shell
npx mokly check
```

## Options

| Option            | Meaning                                                     |
| ----------------- | ----------------------------------------------------------- |
| `--config <path>` | Use an explicit `mokly.config` file                         |
| `--debug-timings` | Report phase timings and catalogue counts on standard error |

## What it validates

Check compiles the catalogue and calculates the same bytes `build` would
write, without writing them. It validates your entries, the links between
them and the resources they reference.

With committed output it then compares those bytes with the files in the
repository. It groups generated files that are missing, stale, or no longer
part of the catalogue, plus unclaimed HTML that has a valid Mokly ownership
header whose source is outside every configured entry-glob prefix and the
current source inventory. Run `build` for missing, stale, and orphan files.
Delete an unclaimed file or restore its source under a configured entry glob;
Build deliberately leaves it untouched. Consumer-authored HTML without a Mokly
header is not reported.

With derived output it instead requires that no generated file or cache path
is tracked in Git. Your authored public CSS and HTML stay tracked as usual,
and local generated files need not exist or match. The index check also
recognises ownership headers on generated pages that were renamed or removed
from the current catalogue, even when no local copy is left.

## In continuous integration

`check` is the command to run in CI: it needs no browser, no server and no
network, and it fails when the committed catalogue and its sources disagree.
When it reports a stale file, run `mokly build`, read the diff, and run
`check` again.
