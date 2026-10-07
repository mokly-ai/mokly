# CLI Terminal Compatibility And Errors

This document supplements [CLI Terminal Output](./mokly-terminal-output.md)
with exact plain output and rich error presentation.

## Delivery Status

The plain and rich output rules describe current behaviour, including the
notice-stream changes from
[Generated Output Review Fixes](../../plans/generated-output-review-fixes.md).

## Plain Compatibility

Successful plain commands retain these exact strings, including punctuation,
capitalization, spacing, and trailing newlines:

```text
Mokly listening at <url> (watching)
Mokly listening at <url>
Generated <n> Mokly files.
Mokly output is valid and untracked (<n> files).
Mokly output is current (<n> files).
Exported Mokly to <outDir>.
Deploy this directory at your site's root with your hosting provider.
Published Mokly catalogue. 0 files uploaded, <unchanged> unchanged.
Published Mokly catalogue. 1 file uploaded, <unchanged> unchanged.
Published Mokly catalogue. 2 files uploaded, <unchanged> unchanged.
Mokly catalogue already published for this commit.
<viewer-url>
```

The first three lines show the exact plural rule for any counted summary:
singular only for one. `<uploaded>` and `<unchanged>` otherwise use the same
decimal counts as rich mode. A publish prints one counted line or the
already-published line. `<viewer-url>` appears only when accepted and contains
that normalized URL alone.

Plain commands add no phase or watch-event lines. Successful baseline
preparation notes and the exact earlier-version notice use stdout, under the
[watch-writer contract](./mokly-watch-writers.md#summaries-and-plain-notices).
Warning-free successful plain commands write nothing to stderr except requested
timing JSON. [Build warnings](./mokly-build-warnings.md) and errors remain on
stderr. Expected plain errors remain exactly `[mokly/<code>] <message>\n`.
Timing mode retains the same stdout and adds its documented JSON lines to
stderr alongside build warnings and existing failures.

The
[exchange cancellation rule](./mokly-upload-exchange.md#accounting-and-output)
decides whether a publish failure is a cancellation or another error. Only a
classified cancellation has this exact plain output:

```text
[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.
```

An exhausted retry or transport failure has exact plain output:

```text
[mokly/upload-failed] The catalogue upload did not complete. Check the endpoint and connection, then retry.
```

## Rich Errors

Rich errors use `✖ <headline>  [mokly/<code>]`, with the code dimmed, followed
by the original safe detail when it adds information and one indented hint.
Secrets are redacted before every line and optional stack. `MOKLY_DIAGNOSTIC=1`
still appends the redacted stack; otherwise expected failures show no stack.

For a failure classified as cancellation by the exchange contract, rich mode
renders headline `Publication was cancelled.`, no detail line, and hint
`Run mokly publish again when you are ready.` It never shows a connection
hint. Every other error keeps its own category and safe recovery detail. An
exhausted retry or transport failure renders headline
`The catalogue upload did not complete.`, no detail line, and the distinct hint
`Check the endpoint and connection, then retry.` A rich detail and hint must
never repeat the same sentence.

| Code                           | Headline                                       | Hint                                                   |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------ |
| `baseline-history-unavailable` | Comparison history is unavailable.             | Fetch the configured base and retry.                   |
| `baseline-extraction-failed`   | The comparison baseline could not be prepared. | Check the Git object and temporary storage.            |
| `baseline-command-failed`      | The comparison baseline build failed.          | Run the configured baseline command locally.           |
| `baseline-output-invalid`      | The comparison baseline output is invalid.     | Build the baseline and fix its generated output.       |
| `baseline-interrupted`         | Comparison preparation was interrupted.        | Retry when the repository is idle.                     |
| `baseline-lock-timeout`        | The comparison baseline is busy.               | Stop the other Mokly process or retry later.           |
| `build-invalid`                | The catalogue could not be built.              | Fix the reported catalogue source and retry.           |
| `cli-invalid`                  | The command could not be understood.           | Run `mokly --help` to see commands.                    |
| `config-invalid`               | The Mokly configuration is invalid.            | Fix the reported configuration value and retry.        |
| `config-missing`               | No Mokly configuration was found.              | Run inside a consumer repository or pass `--config`.   |
| `export-invalid`               | The catalogue could not be exported.           | Fix the reported destination or input and retry.       |
| `git-failed`                   | Git information could not be read.             | Check the repository and configured base.              |
| `manifest-invalid`             | The generated catalogue is invalid.            | Rebuild the catalogue and fix the reported entry.      |
| `review-invalid`               | The comparison could not be created.           | Fix the reported comparison input and retry.           |
| `server-failed`                | The catalogue server could not start.          | Check the reported port or process and retry.          |
| `upload-failed`                | The catalogue could not be published.          | Check the endpoint and connection, then retry.         |
| `upload-invalid-bundle`        | The catalogue upload is invalid.               | Rebuild the export and retry.                          |
| `upload-too-large`             | The catalogue is too large to publish.         | Reduce the export size or raise the receiver limit.    |
| `upload-unauthorized`          | The catalogue upload was not authorized.       | Check the token and repository access.                 |
| `upload-unsupported-version`   | The receiver does not support this catalogue.  | Upgrade the receiver or use a supported Mokly version. |

For `unknown command: <candidate>`, the headline is
`Unknown command "<candidate>".` and the hint names the closest public command
when its edit distance is unambiguous; otherwise it uses the standard help hint.
Unknown options similarly quote the option in the headline. Argument values and
the original typed error remain unchanged outside this CLI presentation layer.
