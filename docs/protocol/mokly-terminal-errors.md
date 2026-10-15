# CLI Terminal Compatibility And Errors

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This document supplements [CLI Terminal Output](./mokly-terminal-output.md)
with the exact plain output, the rich error presentation, and the exit
statuses of `serve`, `build`, and `publish`.

## Plain Compatibility

Successful plain commands write these exact strings, including punctuation,
capitalization, spacing, and trailing newlines:

```text
Mokly listening at <url> (watching)
Mokly listening at <url>
Mokly cache: <directory>
Mokly publish build: <directory>
Built Mokly to <outDir> (<n> files).
Deploy this directory at your site's root with your hosting provider.
Published Mokly catalogue. 0 files uploaded, <unchanged> unchanged.
Published Mokly catalogue. 1 file uploaded, <unchanged> unchanged.
Published Mokly catalogue. 2 files uploaded, <unchanged> unchanged.
Mokly catalogue already published for this commit.
<viewer-url>
```

The counted lines show the exact plural rule for any counted summary:
singular only for one. `<outDir>` is the output directory relative to the
repository. `Mokly publish build: <directory>` appears once per `publish` process, before
its build starts, and names the output inside the private directory that
`publish` keeps after a failed upload. `Mokly cache: <directory>` appears at most once per process, when the command first opens the base-side
extraction cache or the dependency install cache, and names the directory
under the operating system's cache directory. `<uploaded>` and `<unchanged>`
use the same decimal counts as rich mode. A publish prints one counted line
or the already-published line. `<viewer-url>` appears only when accepted and
contains that normalized URL alone.

Plain commands add no phase or watch-event lines.
[Build warnings](./mokly-build-warnings.md) use stderr. A warning-free
successful plain command writes nothing to stderr except requested timing
JSON; errors use stderr. Expected plain errors are exactly
`[mokly/<code>] <message>\n`, where `<message>` is one line unless its exact
text lists locations; a diagnostic with
a source location starts it with `<file>:<line>:<column>`,
repository-relative. A diagnostic whose exact text lists locations prints
those locations as following lines, as `git-uncommitted` does. Each line
escapes its control characters and has its own width bound in rich mode.
Timing mode keeps the same stdout and adds its JSON
lines to stderr beside warnings and failures.

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

## Exit Statuses

Every command exits `0` on success, including Serve closed by `q`, Ctrl+C,
`SIGINT`, or `SIGTERM` after its URL was reported, and `--help` and
`--version`. Every failure exits `1`, including `cli-invalid`, a `--strict`
warning failure, a cancelled `build` or `publish`, and a Serve that cannot
bind. No other status exists, so automation branches on the `[mokly/<code>]`
prefix, not on the number. A `build` that fails leaves its last successful
output directory unchanged; a failed `publish` leaves its local build
available and is not rolled back.

## Rich Errors

Rich errors use `✖ <headline>  [mokly/<code>]`, with the code dimmed, followed
by the original safe detail when it adds information and one indented hint.
Secrets are redacted before every line and optional stack. `MOKLY_DIAGNOSTIC=1`
appends the redacted stack; otherwise expected failures show no stack.

For a failure classified as cancellation by the exchange contract, rich mode
renders headline `Publication was cancelled.`, no detail line, and hint
`Run mokly publish again when you are ready.` It never shows a connection
hint. Every other error keeps its own category and safe recovery detail. An
exhausted retry or transport failure renders headline
`The catalogue upload did not complete.`, no detail line, and the distinct hint
`Check the endpoint and connection, then retry.` A rich detail and hint never
repeat the same sentence.

| Code                         | Headline                                      | Hint                                                     |
| ---------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| `build-invalid`              | The catalogue could not be built.             | Fix the reported catalogue source and retry.             |
| `cli-invalid`                | The command could not be understood.          | Run `mokly --help` to see commands.                      |
| `config-invalid`             | The Mokly configuration is invalid.           | Fix the reported configuration value and retry.          |
| `config-missing`             | No Mokly configuration was found.             | Run inside a consumer repository or pass `--config`.     |
| `export-invalid`             | The static output could not be written.       | Fix the reported output directory or input and retry.    |
| `git-failed`                 | Git information could not be read.            | Check the repository and configured base.                |
| `git-uncommitted`            | The checkout has uncommitted changes.         | Commit, stash or ignore these files, then publish again. |
| `review-invalid`             | The comparison could not be created.          | Fix the reported comparison input and retry.             |
| `server-failed`              | The catalogue server could not start.         | Check the reported port or process and retry.            |
| `upload-failed`              | The catalogue could not be published.         | Check the endpoint and connection, then retry.           |
| `upload-invalid-bundle`      | The catalogue upload is invalid.              | Rebuild the catalogue and retry.                         |
| `upload-too-large`           | The catalogue is too large to publish.        | Reduce the output size or raise the receiver limit.      |
| `upload-unauthorized`        | The catalogue upload was not authorized.      | Check the token and repository access.                   |
| `upload-unsupported-version` | The receiver does not support this catalogue. | Upgrade the receiver or use a supported Mokly version.   |

The sidecar's fail-closed codes of the
[sidecar contract](./mokly-sidecar.md#fail-closed-rules) present as
`build-invalid` with their own detail: the missing part, both versions, the
module and its diagnostic, or the entry with its viewport and scheme. A base
commit whose sources fail validation makes Changes unavailable with those
diagnostics in every command, and the `base-dependencies` warning is a
warning, not an error. A base ref that cannot be resolved, or a history too
shallow for the merge base, keeps Serve browsable with Changes unavailable
and fails `build` and `publish` with `git-failed`.

A missing or invalid viewer package uses `server-failed` and asks the user to
build or reinstall the matching `@mokly/viewer` package.

`git-uncommitted` shows the headline, detail and hint in both plain and rich
output. Plain output keeps the `[mokly/<code>]` prefix and puts the detail and
hint on following lines. Rich output prints each sentence once. Details list
at most 20 unique repository-relative paths, sorted by path, then the number
of other paths. Control characters in path names are escaped. When a listed
path lies under a `build` output directory inside the repository, the detail
names the rule `/<directory>/` to add to the repository's `.gitignore`, with
Git pattern characters escaped so it matches the literal directory. Changes
found after the build say `Changes appeared during the build.`

For `unknown command: <candidate>`, the headline is
`Unknown command "<candidate>".` and the hint names the closest public command
when its edit distance is unambiguous; otherwise it uses the standard help
hint. Unknown options likewise quote the option in the headline. Argument
values and the original typed error are unchanged outside this presentation
layer.

Private publication-directory allocation failures use `export-invalid`. The
plain line names the temporary root and says to set `TMPDIR`, or `TMP` on
Windows, to a writable directory outside the checkout. Rich output uses headline
`The publish build directory could not be prepared.`, the temporary-root
detail, and that same hint once. A missing Git checkout or committed HEAD
uses `git-failed` with `Publish requires a Git checkout with a committed HEAD.`
