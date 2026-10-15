# CLI Terminal Output

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Scope

This contract defines the user-visible terminal behaviour of the `mokly` CLI
for `serve`, `build`, and `publish`: reporter selection, rich progress, plain
compatibility, warnings, errors, watched Serve events, the cache directory
line, and interactive shortcuts. It does not change HTTP errors, the error
messages themselves, the static output, or timing records. The exact plain
strings, the rich error table, and the exit statuses are in the
[terminal compatibility contract](./mokly-terminal-errors.md).

## Output Mode

Every invocation selects one reporter before command work starts:

1. `--debug-timings` always selects plain mode.
2. `MOKLY_OUTPUT=plain` selects plain mode.
3. `MOKLY_OUTPUT=rich` selects rich mode, including through a pipe.
4. A nonempty `CI` value selects plain mode.
5. Otherwise, a TTY stdout selects rich mode and any other stdout selects plain.

Unknown `MOKLY_OUTPUT` values have no effect. Mode selection does not control
colour. Help and version use the [fixed bytes](./mokly-terminal-help.md) in either
mode and render no progress. Plain mode is the automation contract. Rich mode is the interactive
developer experience. Stdin is never claimed in plain mode.

## Colour, Glyphs, And Width

Rich colour follows the terminal rules: styling is emitted only when the
stream is a TTY that supports it, `NO_COLOR` disables it, and `FORCE_COLOR`
enables it. Success glyphs are green when colour is supported and unstyled
otherwise. Plain mode never emits styling.

Modern terminals use these glyphs:

| Meaning              | Glyph |
| -------------------- | ----- |
| Success              | `✔`   |
| Failure              | `✖`   |
| Warning              | `!`   |
| Rebuild              | `↻`   |
| Reload               | `⟳`   |
| Configuration reload | `↺`   |
| Git evidence refresh | `⟲`   |

A Windows console without Windows Terminal or a known terminal host uses
ASCII: `+`, `x`, `!`, `R`, `L`, `C`, and `G`. The spinner uses Braille frames
in modern terminals and `|`, `/`, `-`, `\\` in the fallback.

Every rich line is bounded by stdout's current positive `columns` value, or 80
columns when unavailable. Mokly accounts for ANSI control sequences when
measuring, truncates content with a single ellipsis where possible, preserves
complete styling sequences in the kept prefix, and never writes a partial
escape sequence. A shortened styled line ends with a full style reset so its
colour cannot bleed into later output. Authored paths are made relative to
the repository when possible before truncation.

## Spinner Lifecycle

One reporter owns both terminal streams. It renders at most one in-place
spinner line, advances it every 80 milliseconds, and never hides the cursor.
Every in-place frame begins with `\r\x1b[2K` (carriage return and ANSI
erase-line) before writing its new bounded label, including a timer frame and
an immediate phase-label update, so a shorter label replaces every character
of a longer one. Before any event, warning, diagnostic, error, or success
line, the reporter performs the same erase. Completing a phase replaces the
spinner with one durable line; failing or abandoning a phase clears it first.
Shutdown always clears the timer and the current line.

When output is forced rich through a non-TTY pipe, progress frames are not
animated. The starting line and the durable completion lines stay observable
and deterministic.

Durations below one second use rounded milliseconds, such as `312ms`. Durations
from one second through 59.9 seconds use one decimal place, such as `4.9s`.
Longer durations use whole minutes and zero-padded seconds, such as `2m 03s`.
Watch timestamps use the local `HH:mm:ss` clock.

## Serve Layout

Rich Serve begins with the installed version, the comparison base, and the
config path, followed by its stable URL in a compact bordered panel. The
panel contains only the address so it stays the primary action; watch state
and shortcut guidance are dim secondary copy beneath it. Serve installs its
`SIGINT`, `SIGTERM`, and `SIGHUP` handling before it writes the ready layout
or opens the browser, so an immediate interrupt closes Serve cleanly.

```text
  mokly 0.10.0                          comparing against origin/main
  examples/basic/mokly.config.json

  ┌─────────────────────────┐
  │  http://127.0.0.1:4175  │
  └─────────────────────────┘
  watching sources and styles · press h for shortcuts
```

The borders are cyan and the middle URL line is bold cyan when colour is
enabled. Borders use the Unicode box glyphs shown above and fall back to `+`,
`-`, and `|` on consoles that use the ASCII glyphs. The panel contracts to
the available terminal width and truncates a long address with an ellipsis
without breaking its border. `--no-watch` replaces the secondary description
with `snapshot`; shortcut guidance appears only when watched Serve owns an
interactive stdin. Serve then reports its lifecycle boundaries:

```text
  ✔ Catalogue ready · 96 screens · 12 pages · 18 components            4.9s
  ◐ Comparing with origin/main…
  ✔ Changes ready · 5 changes · 1 moved · 2 ignored-only              3.6s
```

Catalogue counts come from the catalogue model; zero-valued kinds are omitted.
Catalogue counts include saved variants as entries of their parent's kind.
Unavailable Changes says `! Changes unavailable` with its reason and keeps
All browsable. Serve reports each state's
[build warnings](./mokly-build-warnings.md) immediately before
`Catalogue ready`; on-demand renders never repeat them, and the
`base-dependencies` warning of the
[comparison contract](./mokly-comparison.md#sides) prints before
`Changes ready`. `Changes ready` reports the
[Changes count](./mokly-catalogue-changes.md#changes-count) as `<n> changes`,
then `<n> moved` and `<n> ignored-only` when those counts are not zero; a zero
count omits its segment, and `0 changes` stays. Counted nouns use singular
only for one, including `1 change` and `2 changes`.

Accept resource failures keep Serve running. At the first failure of each
backoff period, the reporter writes `! Serve cannot accept connections: {reason}. Retrying.`
to stderr. Repeated failures in that period are silent. The first accepted
connection writes `! Serve can accept connections again.` to stderr.
Both modes use these lines. Rich mode applies its width and colour rules.

Watched actions use one durable line after the action settles:

```text
  12:04:31  ↻ specs/home.screen.html         rebuilt                   312ms
  12:04:40  ⟳ styles/theme.css               reloaded
  12:05:02  ↺ mokly.config.json              config reloaded           1.8s
  12:05:20  ⟲ origin/main moved              comparing again
```

At most three repository-relative paths are joined with commas; additional
paths become `+<n> more`. The action words are `rebuilt`, `reloaded`,
`config reloaded`, and `comparing again`. A coalesced burst keeps every
observed candidate path even when its strongest action subsumes the others.

A failed watched action keeps the last-good catalogue and renders:

```text
  12:05:31  ✖ specs/home.screen.html
            specs/home.screen.html:12:5 [mokly/html-element] unknown element ui-hero
            The last good catalogue is still being served.
```

The sidecar's standard error is routed through the reporter as diagnostic
lines, so consumer output cannot corrupt a spinner.

## Cache Directory

The first time a command opens the base-side extraction cache or the
dependency install cache of the
[runtime contract](./mokly-runtime.md#render-graph-and-cache), it writes one
line that names the directory. Rich mode prints it dimmed before the next
durable line; plain mode prints the exact string of the compatibility
contract on stdout. The line appears once per process and names the directory
so a reader can delete it, which is always safe.

```text
  cache ~/.cache/mokly/3f9c1a…
```

## One-Shot Commands

Rich `build` and `publish` report only the phases the command performs. Phase
labels are outcome-oriented: `Loading configuration`, `Rendering catalogue`,
`Comparing with <base>`, `Writing static output`, `Preparing upload`, and
`Uploading catalogue`.

While `Uploading catalogue` runs an exchange round with a nonempty `missing`
set, its spinner label becomes
`Uploading <n> of <total> <file/files> · <size>`. The
[exchange accounting rule](./mokly-upload-exchange.md#accounting-and-output)
defines all three values. No progress label is shown for empty `missing`. The
label uses `file` only when `<total>` is one, whole bytes below 1 KiB and one
decimal place from KiB upward:

```text
Uploading 0 of 1 file · 312 B
Uploading 2 of 4 files · 4.1 KiB
```

Each completion updates the label; a forced-rich pipe shows only the starting
line and the durable completion line. Completion summaries are:

```text
  ✔ Built Mokly to mokly-static · 278 files (5.9s)
  ✔ Published Mokly catalogue · 1 file uploaded, 0 unchanged (9.3s)
  ✔ Published Mokly catalogue · 12 files uploaded, 266 unchanged (9.3s)
  ✔ Mokly catalogue already published for this commit (2.1s)
```

`build` names its output directory relative to the repository and follows its summary with the unstyled guidance
`Deploy this directory at your site's root with your hosting provider.`
Publish follows its summary with the receiver's viewer URL on its own unstyled
line when the completion response supplied an accepted URL, and adds nothing
otherwise; the line is omitted when the normalized URL contains the bearer
token or its `encodeURIComponent` form. The counted summary uses `file` only
for one uploaded marker entry; zero and every other count use `files`.
`unchanged` has no following noun. The already-published summary replaces the
counted one only when Complete returns `200`.

## Warnings And Strict Mode

The [build warnings contract](./mokly-build-warnings.md) owns warning order,
the exact stderr formats, and `--strict`. `build` and `publish` print their
warnings after rendering and before the summary; with `--strict` they fail
with `build-invalid` after printing them and before any file is written or
uploaded. `serve` refuses `--strict` with `cli-invalid`.

## Plain Compatibility And Errors

Exact plain command strings, cancellation and transport copy, rich error
headlines and hints, and exit statuses follow the separate
[terminal compatibility contract](./mokly-terminal-errors.md).

## Interactive Controls

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
state is restored on close. Mokly stops reading stdin during shutdown so a
piped or spawned process cannot be kept alive by shortcuts.

`serve --open` invokes the same browser opener once, after the URL is ready.
It works with `--no-watch`; the flag is rejected for other commands. macOS
uses `open`, Linux uses `xdg-open`, and Windows uses
`cmd.exe /d /s /c start "" <url>`, detached with ignored stdio. A launch
failure is a warning and does not stop Serve.
