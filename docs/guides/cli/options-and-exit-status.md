---
title: "Options and exit status"
description: "Choose command options and interpret command results."
section: "cli"
order: 6
---

## Command shape

```shell
npx mokly build --config tools/mokly.config.json --no-changes
```

Use `serve`, `build`, or `publish`. With no command, Mokly starts watched Serve.
Value options accept `--name=value`. Use that form when a value begins with a
hyphen, such as `--token=-TOKEN` or `--config=-catalogue.config.json`.
Boolean options take no value. There are no silent positional arguments.

## Options

| Option                           | Commands           | Meaning                                           |
| -------------------------------- | ------------------ | ------------------------------------------------- |
| `--config {path}`                | all                | Use an explicit JSON configuration file.          |
| `--base {ref}`                   | all                | Override the comparison base.                     |
| `--base-install-scripts`         | all                | Run lifecycle scripts during base dependency installation. |
| `--no-base-install-scripts`      | all                | Keep lifecycle scripts disabled during base dependency installation. |
| `--sidecars {count}`             | all                | Set the positive JavaScript worker count.         |
| `--debug-timings`                | all                | Select plain output and print timing records.     |
| `--port {port}`                  | `serve`            | Select a starting port. Zero selects a free port. |
| `--watch`                        | `serve`            | Watch inputs. This is the default.                |
| `--no-watch`                     | `serve`            | Serve one snapshot.                               |
| `--open`                         | `serve`            | Open the reported address in a browser.           |
| `--out {directory}`              | `build`            | Select config-relative output.                    |
| `--strict`                       | `build`, `publish` | Require a warning-free build.                     |
| `--no-changes`                   | `build`, `publish` | Omit comparison work and base history.            |
| `--endpoint {url}`               | `publish`          | Override `MOKLY_ENDPOINT`.                        |
| `--token {token}`                | `publish`          | Override `MOKLY_TOKEN`.                           |
| `--repository {host/owner/name}` | `publish`          | Override repository detection.                    |
| `--upload-concurrency {count}`   | `publish`          | Bound parallel Blob requests to 1 through 32.     |
| `--help`, `-h`                   | all                | Show command help.                                |
| `--version`, `-v`                | all                | Print the installed version.                      |

Unknown, repeated, misplaced, and empty options fail before command work.
`--base` conflicts with `--no-changes`. Publish chooses a private build directory.

## Exit status

Success exits `0`. A failure exits `1`. Closing Serve normally also exits `0`.
Cancelling a build or publish exits `1`.

Build warnings print on standard error. `build --strict` and `publish --strict`
fail on warnings before output installation or upload. Without `--strict`, both
commands can succeed with warnings.

## Error categories

Plain errors start with `[mokly/{code}]`. Rich errors show the same code with
an explanation and recovery action.

| Category                           | Meaning                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `cli-invalid`                      | An argument is invalid.                               |
| `config-missing`, `config-invalid` | Configuration is missing or invalid.                  |
| `build-invalid`                    | Catalogue validation or rendering failed.             |
| `export-invalid`                   | Output selection, assembly, or recovery failed.       |
| `git-failed`                       | Git identity or comparison history could not be read. |
| `git-uncommitted`                  | Publish found uncommitted changes.                    |
| `review-invalid`                   | Comparison creation failed.                           |
| `server-failed`                    | The server or matching viewer package is unavailable. |
| `upload-unauthorized`              | The receiver refused the token or repository.         |
| `upload-invalid-bundle`            | The receiver rejected the artifact.                   |
| `upload-too-large`                 | A documented upload limit was exceeded.               |
| `upload-unsupported-version`       | The receiver does not support the format.             |
| `upload-failed`                    | Upload failed or was cancelled.                       |

A recovery error names the retained paths. Inspect them before removing files.
Credentials and raw receiver response bodies do not appear in terminal output.
