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
| `--strict`        | Fail before comparison when the build reports warnings      |

## What it validates

Check compiles the catalogue and calculates the same bytes `build` would
write, without writing them. It validates your entries and documents, the
paths they derive, the links between them and the resources they reference.

When Git indexes the complete `<mockupsDir>/mokly-generated/` tree, Check reports
missing, stale and extra local files. Run `mokly build` and commit the full
tree, or untrack and ignore the directory. When none of it is in the index,
Check ignores local output completely: it can be absent or stale. A mixture
is a `build-invalid` error that lists tracked and missing-index paths and
offers both ways out. Build first if a new route is missing: Build succeeds
without inspecting tracking, and Check lists the unstaged route under
`untracked:` until staged. Check alone guards the index against tracked
`.mokly-cache/` paths. Authored, referenced CSS stays in its original location and may
remain tracked; unrelated files are not served or exported.

## In continuous integration

`check` is the command to run in CI: it needs no browser, no server and no
network, and it fails when tracked output and its sources disagree.
When it reports a stale file, run `mokly build`, read the diff, and run
`check` again.

Build warnings appear on standard error and do not fail the check. Pass
`--strict` when a pull request should fail on warnings as well. The failure
says `1 build warning with --strict` for one warning and
`<n> build warnings with --strict` otherwise.

Warnings name a generated page, an entry, a component, a folder or the
configuration file. Strict mode counts all warnings, including ignored inputs.
