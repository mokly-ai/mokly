# CLI Terminal Output

## Scope

This contract defines the user-visible terminal behavior of the `mokly` CLI.
It covers output-mode selection, rich progress, plain compatibility, errors,
watched Serve events, and interactive shortcuts. It does not change catalogue
HTTP errors, `MoklyError` messages, generated files, or timing records.

## Output mode

Every invocation selects one reporter before command work starts:

1. `--debug-timings` always selects plain mode.
2. `MOKLY_OUTPUT=plain` selects plain mode.
3. `MOKLY_OUTPUT=rich` selects rich mode, including through a pipe.
4. A nonempty `CI` value selects plain mode.
5. Otherwise, a TTY stdout selects rich mode and any other stdout selects plain.

Unknown `MOKLY_OUTPUT` values have no effect. Mode selection does not control
colour. Help and version use their established bytes in either mode and do not
render progress. Plain mode is the automation contract. Rich mode is the
interactive developer experience. Stdin is never claimed in plain mode.

The approved [`mokly mcp`](./mokly-mcp.md) command will bypass this selection
and is exempt from the plain-mode stderr silence rule below: its stdout carries
only protocol messages, its `Mokly listening at` line and every diagnostic go
to stderr in plain mode, the supervised child's stdout is mapped to stderr, and
stdin belongs to the transport, so shortcuts never start.

## Colour, glyphs, and width

Rich colour uses Node's `util.styleText` with stdout or stderr as the validation
stream. Node therefore applies its normal TTY, `NO_COLOR`, and `FORCE_COLOR`
rules. Success glyphs are green when colour is supported and remain unstyled
when colour is disabled or unavailable. Mokly adds no colour dependency and
never emits styling in plain mode.

Modern terminals use these glyphs:

| Meaning              | Glyph |
| -------------------- | ----- |
| Success              | `✔`   |
| Failure              | `✖`   |
| Warning              | `!`   |
| Rebuild              | `↻`   |
| Browser reload       | `⟳`   |
| Child restart        | `↺`   |
| Git evidence refresh | `⟲`   |

A legacy Windows console without Windows Terminal or a known terminal host uses
ASCII: `+`, `x`, `!`, `R`, `L`, `S`, and `G`. The spinner uses Braille
frames in modern terminals and `|`, `/`, `-`, `\\` in the fallback.

Every rich line is bounded by stdout's current positive `columns` value, or 80
columns when unavailable. Mokly accounts for ANSI control sequences when
measuring, truncates content with a single ellipsis where possible, preserves
complete styling sequences in the retained prefix, and never writes a partial
escape sequence. A shortened styled line ends with a full style reset so its
colour cannot bleed into later output. User-authored paths are made relative to
the repository when possible before truncation.

## Spinner lifecycle

One reporter owns both terminal streams. It renders at most one in-place
spinner line, advances it every 80 milliseconds, and `unref()`s the timer. The
cursor is never hidden. Before any event, warning, diagnostic, error, or success
line is written, the reporter clears the spinner with carriage return plus the
ANSI erase-line sequence. Completing a phase replaces the spinner with one
durable line; failing or abandoning a phase clears it first. Shutdown always
clears the timer and current line.

When output is forced rich through a non-TTY pipe, progress frames are not
animated. The starting line and durable completion lines remain observable and
deterministic.

Durations below one second use rounded milliseconds, such as `312ms`. Durations
from one second through 59.9 seconds use one decimal place, such as `4.9s`.
Longer durations use whole minutes and zero-padded seconds, such as `2m 03s`.
Watch timestamps use the local `HH:mm:ss` clock.

## Serve layout

Rich Serve begins with the installed version, generation mode, comparison base,
and config path, followed by its stable URL in a compact bordered panel. The
panel contains only the address so it remains the primary action; watch state
and shortcut guidance are dim secondary copy beneath it:

```text
  mokly 0.10.0                          derived · comparing against origin/main
  examples/basic/mokly.config.ts

  ┌─────────────────────────┐
  │  http://127.0.0.1:4175  │
  └─────────────────────────┘
  watching entries, renderer and styles · press h for shortcuts
```

The borders are cyan and the middle URL line is bold cyan when colour is
enabled. Borders use the Unicode box glyphs shown above and fall back to `+`,
`-`, and `|` on legacy Windows consoles. The panel contracts to the available
terminal width and truncates a long address with an ellipsis without breaking
its border. `--no-watch` replaces the secondary description with `snapshot`;
shortcut guidance appears only when watched Serve owns an interactive stdin. A
watched catalogue then reports existing lifecycle boundaries:

```text
  ✔ Catalogue ready · 96 screens · 12 pages · 18 components            4.9s
  ◐ Preparing comparison baseline from origin/main…
  ✔ Baseline ready · rebuilt a1b2c3d                                  23.0s
  ✔ Changes ready · 3 changed screens                                  3.6s
```

Catalogue counts come from accepted manifest entries. Zero-valued kinds are
omitted. A baseline cache hit says `Baseline ready · reused <short-sha>`; a
committed catalogue omits baseline preparation. Unavailable Changes says
`! Changes unavailable` and preserves All browsing.

Watched actions use one durable line after the action settles:

```text
  12:04:31  ↻ entries/home.mockup.tsx     rebuilt                      312ms
  12:04:40  ⟳ styles/theme.css            reloaded
  12:05:02  ↺ mokly.config.ts             config reloaded, restarted   1.8s
  12:05:20  ⟲ origin/main moved           comparing again
```

At most three repository-relative paths are joined with commas. Additional
paths become `+<n> more`. The action words are `rebuilt`, `reloaded`,
`restarted`, `config reloaded, restarted`, and `comparing again`. A coalesced
burst retains every observed candidate path even when its strongest action
subsumes the others.

A failed watched action preserves last-good output and renders:

```text
  12:05:31  ✖ entries/home.mockup.tsx
            Link target "missing-screen" does not exist in the catalogue.
            The last good catalogue is still being served.
```

Diagnostics raised inside the supervised child cross IPC as
`{ type: "diagnostic", message: string }`. The parent validates the message,
routes it through the reporter, and prevents child stderr from corrupting a
spinner. A standalone child without IPC writes the same diagnostic directly.

## One-shot commands

Rich `build`, `check`, `export`, and `publish` report only phases the command
actually performs. Phase labels are outcome-oriented: `Loading configuration`,
`Rendering catalogue`, `Writing generated output`, `Checking generated output`,
`Exporting catalogue`, `Preparing upload`, and `Uploading catalogue`.

Completion summaries are:

```text
  ✔ Generated 278 files in examples/basic/generated (5.9s)
  ✔ Mokly output is valid and untracked · 278 files (5.9s)
  ✔ Mokly output is current · 278 files (5.9s)
  ✔ Exported Mokly to .context/mokly-site (8.1s)
  ✔ Published Mokly catalogue (9.3s)
```

Export follows its summary with the unstyled guidance
`Deploy this directory at your site's root with your hosting provider.`

## Plain compatibility

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
Published Mokly catalogue.
```

Plain commands add no phase or watch-event lines. Successful plain commands
write nothing to stderr unless `--debug-timings` was requested. Expected plain
errors remain exactly `[mokly/<code>] <message>\n`. Timing mode retains the
same stdout and writes only its documented JSON lines plus existing failures.

## Rich errors

Rich errors use `✖ <headline>  [mokly/<code>]`, with the code dimmed, followed
by the original safe detail when it adds information and one indented hint.
Secrets are redacted before every line and optional stack. `MOKLY_DIAGNOSTIC=1`
still appends the redacted stack; otherwise expected failures show no stack.

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

## Interactive controls

Shortcuts are available only for rich watched Serve with readable stdin:

| Key    | Action                                                       |
| ------ | ------------------------------------------------------------ |
| `o`    | Open the served URL in the default browser.                  |
| `r`    | Enqueue a rebuild through the serialized watch-action queue. |
| `c`    | Clear the terminal and reprint the header and URL.           |
| `h`    | Print the shortcut list.                                     |
| `q`    | Close Serve cleanly.                                         |
| Ctrl+C | Close Serve cleanly.                                         |

Unknown keys are ignored. Raw mode is enabled only for TTY stdin and its prior
state is restored on close. Mokly removes listeners and pauses stdin during
shutdown so a piped or spawned process cannot be kept alive by shortcuts.

`serve --open` invokes the same browser opener once, after the URL is ready. It
works in either output mode and with `--no-watch`; the flag is rejected for
other commands. macOS uses `open`, Linux uses `xdg-open`, and Windows uses
`cmd.exe /d /s /c start "" <url>`, detached with ignored stdio. A launch failure
is a warning and does not stop Serve.
