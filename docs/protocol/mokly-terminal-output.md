# CLI Terminal Output

## Scope

This contract defines the user-visible terminal behavior of the `mokly` CLI.
It covers output-mode selection, rich progress, plain compatibility, warnings,
errors, watched Serve events, and interactive shortcuts. It does not change
catalogue HTTP errors, `MoklyError` messages, generated files, or timing records.

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
cursor is never hidden. Every in-place frame begins with `\r\x1b[2K` (carriage
return and ANSI erase-line) before writing its new bounded label, including a
timer frame and an immediate phase-label update. This makes a shorter label
replace every character of a longer one. Before any event, warning, diagnostic,
error, or success line, the reporter performs the same erase. Completing a
phase replaces the spinner with one durable line; failing or abandoning a phase
clears it first. Shutdown always clears the timer and current line.

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

Serve installs its `SIGINT` and `SIGTERM` shutdown handling before it writes
the ready layout or opens the browser. Once a URL is visible, an immediate
interrupt must close Serve cleanly rather than terminate it by signal.

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
`! Changes unavailable` and preserves All browsing. Serve reports each
generation's build warnings immediately before `Catalogue ready`; on-demand
previews never repeat them. Counted nouns use singular only for one, including
`1 changed screen` and `2 changed screens`.

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
            entries/home.mockup.tsx export default: link target missing-screen does not exist
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

While `Uploading catalogue` runs an exchange round with a nonempty `missing`
set, its spinner label becomes
`Uploading <n> of <total> <file/files> · <size>`. The
[exchange accounting rule](./mokly-upload-exchange.md#accounting-and-output)
defines all three values: Plan-archive entries count from the first frame,
entries sharing a completed digest advance together, and `<size>` counts
distinct round content including the Plan archive. A re-plan restarts with the
new round's values. No progress label is shown for empty `missing`.

The label uses `file` only when `<total>` is one, whole bytes below 1 KiB and
one decimal place from KiB upward:

```text
Uploading 0 of 1 file · 312 B
Uploading 2 of 4 files · 4.1 KiB
```

Each completion updates the label; a forced-rich pipe shows only the starting
line and durable `Catalogue uploaded` line.

Completion summaries are:

```text
  ✔ Generated 278 files in examples/basic/generated (5.9s)
  ✔ Mokly output is valid and untracked · 278 files (5.9s)
  ✔ Mokly output is current · 278 files (5.9s)
  ✔ Exported Mokly to .context/mokly-site (8.1s)
  ✔ Published Mokly catalogue · 1 file uploaded, 0 unchanged (9.3s)
  ✔ Published Mokly catalogue · 12 files uploaded, 266 unchanged (9.3s)
  ✔ Mokly catalogue already published for this commit (2.1s)
```

Export follows its summary with the unstyled guidance
`Deploy this directory at your site's root with your hosting provider.`
Publish follows its summary with the receiver's viewer URL on its own unstyled
line when the completion response supplied an accepted URL, and adds nothing
otherwise. Omit that line when the normalized URL contains the bearer token or
its `encodeURIComponent` form. The counted summary uses `file` only for one
uploaded marker entry; zero and every other count use `files`. `unchanged` has
no following noun. The exchange contract defines which digests count across
Plan files, Blob attempts and re-plans. The already-published summary replaces
the counted one only when Complete returns `200`, meaning a different upload
kept the first publication for the same commit and config path.

The build warnings contract owns warning order, exact stderr formats, and
`--strict` failures for one-shot commands and Serve; see
[Build warnings](./mokly-build-warnings.md).

## Plain Compatibility And Errors

Exact plain command strings, cancellation and transport copy, and rich error
headlines and hints follow the separate
[terminal compatibility contract](./mokly-terminal-errors.md).

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
