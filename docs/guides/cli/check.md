---
title: "Validate a catalogue"
description: "Check every source and saved view with a strict temporary build."
section: "cli"
order: 3
---

## Validate every view

```shell
npx mokly build --strict --no-changes --out .context/validation
```

Build checks the catalogue's sources, props, paths, links, and referenced
resources. It renders every saved view before it installs the output.
`--strict` makes warnings fail the command. `--no-changes` lets this check
run without Git history.

The output path resolves beside the configuration file. Keep it ignored by
Git and outside source roots. You can remove this temporary output after the
check. To validate Changes too, omit `--no-changes` and provide the base history.

## Continuous integration

Run the strict build after installing the consumer's dependencies.
A failure exits `1` and prints its category and source diagnostic. Success
exits `0`. Build starts no server or watcher.

Use [the build reference](/docs/cli/build/) for all build options and output
recovery rules.
