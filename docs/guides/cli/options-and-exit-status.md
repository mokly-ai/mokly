---
title: "Options and exit status"
description: "The options every command shares, and what an exit code means."
section: "cli"
order: 6
---

## Shape of a command

The command comes first and its options follow it:

```shell
npx mokly build --config tools/mokly.config.ts
```

A value option also accepts the assigned form `--name=value`, which is how you
pass a value beginning with `-`, such as `--token=-TOKEN` or
`--config=-catalogue.config.ts`. Empty values are rejected, and a boolean flag
takes no value. There are no silent positional arguments.

## Options

| Option                               | Commands                     | Meaning                                                        |
| ------------------------------------ | ---------------------------- | -------------------------------------------------------------- |
| `--config <path>`                    | every command                | Use an explicit `mokly.config` file                            |
| `--debug-timings`                    | every command                | Report phase timings and catalogue counts on standard error    |
| `--port <port>`                      | `serve`                      | Starting port; advances if occupied, `0` selects any free port |
| `--watch`                            | `serve`                      | Watch your inputs; the default                                 |
| `--no-watch`                         | `serve`                      | Serve one deterministic snapshot                               |
| `--base <ref>`                       | `serve`, `export`, `publish` | Git base ref used to find the branch point                     |
| `--out <path>`                       | `export`, `publish`          | Config-relative output directory                               |
| `--endpoint <url>`                   | `publish`                    | Upload URL, or `MOKLY_ENDPOINT`                                |
| `--token <token>`                    | `publish`                    | Bearer token, or `MOKLY_TOKEN`                                 |
| `--repository <host>/<owner>/<name>` | `publish`                    | Override the detected repository identity                      |
| `--no-changes`                       | `publish`                    | Publish with no comparison baseline                            |
| `--help`                             | every command                | Show the commands and their options                            |
| `-h`                                 | every command                | Short form of `--help`                                         |
| `--version`                          | every command                | Print the installed version                                    |
| `-v`                                 | every command                | Short form of `--version`                                      |

An option given to a command that does not take it is refused by name rather
than ignored. `--out` is required by `export`, and `--no-changes` cannot be
combined with `--base`.

## Exit status

| Code | Meaning               |
| ---- | --------------------- |
| `0`  | The command succeeded |
| `1`  | The command failed    |

Warnings about ignored, unnecessary inputs appear on standard error in plain
mode and do not change a successful exit code. Each distinct warning appears
once per command or watched rebuild.

## Errors

A failure prints one line on standard error that begins with its category, so
you can tell a configuration problem from an upload problem without reading a
stack trace:

```text
[mokly/config-missing] no mokly.config file was found
```

| Category                       | Raised when                                            |
| ------------------------------ | ------------------------------------------------------ |
| `cli-invalid`                  | An argument is unknown, misplaced or missing its value |
| `config-missing`               | No configuration file was found                        |
| `config-invalid`               | The configuration is not valid                         |
| `build-invalid`                | The catalogue could not be built or validated          |
| `manifest-invalid`             | A manifest could not be read or does not match         |
| `review-invalid`               | A comparison could not be produced from the inputs     |
| `export-invalid`               | An export destination or artifact was refused          |
| `server-failed`                | The local server could not start or continue           |
| `git-failed`                   | A Git command failed                                   |
| `baseline-history-unavailable` | The branch point is not in the checkout                |
| `baseline-extraction-failed`   | The historical checkout could not be extracted         |
| `baseline-command-failed`      | A baseline build command failed                        |
| `baseline-output-invalid`      | A baseline build produced no valid catalogue           |
| `baseline-interrupted`         | Baseline preparation was interrupted                   |
| `baseline-lock-timeout`        | The baseline cache stayed locked                       |
| `upload-unauthorized`          | The service refused the token or the repository        |
| `upload-invalid-bundle`        | The upload was rejected as malformed                   |
| `upload-too-large`             | An upload limit was exceeded                           |
| `upload-unsupported-version`   | The service does not support this upload version       |
| `upload-failed`                | The upload failed for any other reason                 |
