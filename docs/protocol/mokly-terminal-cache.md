# Cache Output

Status: Serve does not use the stylesheet store yet, so no cache line or warning comes from it. [Milestone 3](../../plans/persistent-stylesheet-records.md#milestone-3-serve-integration) adds that use.

The [terminal output contract](./mokly-terminal-output.md) owns modes and width.

## Cache Directory

The first time a command opens the base-side extraction cache, the dependency
install cache, the bundle cache, the
[render store](./mokly-render-store.md), or the
[stylesheet store](./mokly-stylesheet-cache.md) of the
[cache contract](./mokly-base-cache.md), it writes one line that names the
directory. All five caches share this line. While `build` or `publish`
renders the head catalogue, the line waits. The command writes it before the
next phase starts, or when rendering passes validation, whichever comes
first. A failure or a cancellation while the line waits drops it. While Serve
starts, the line also waits. Serve writes it after its ready output: the
listening line of the [compatibility contract](./mokly-terminal-errors.md) in
plain mode, or the URL panel of the
[Serve layout](./mokly-terminal-output.md#serve-layout) in rich mode. A Serve
start that fails or is cancelled before that output drops the line. After the
ready output, Serve writes the line at once, and so does every other phase.
Rich mode prints it dimmed before
the next durable line; plain mode prints the exact string of the
compatibility contract on stdout. The line appears at most once per process
and names the directory so a reader can delete it, which is always safe.
Decision: the line waits only while the head renders, so a build that fails
there writes no cache line, and the base caches keep their timing. A wait
until validation for every cache was rejected, because it moves the line of
the base caches and drops it when a later step fails. A deferring reporter
for each cache kind was rejected, because each new kind then needs its own
wiring. A line after the whole command and a buffer of all plain stdout were
rejected, because they delay or hold unrelated output.
Decision: a startup line of Serve waits for the ready output, so a failed start
keeps stdout empty, and the listening line stays the first line. A line at once
was rejected, because Serve opens the render store before it listens.

```text
  cache ~/.cache/mokly/3f9c1a…
```

## Cache Warnings

The bundle cache, the [render store](./mokly-render-store.md#faults), and the
[stylesheet store](./mokly-stylesheet-cache.md#faults) write one warning line
on stderr in each of these cases:

| Case                                                                        | Warning                                                                 |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Mokly reads a damaged, unreadable, or foreign entry of the bundle cache     | `A cached JavaScript bundle could not be reused. Bundling it again.`    |
| The bundle cache directory is unusable, at most once per process            | `The JavaScript bundle cache is unavailable. Bundling without it.`      |
| Mokly reads a damaged, unreadable, or foreign entry of the render store     | `A cached document could not be reused. Rendering it again.`            |
| The render store directory is unusable, at most once per process            | `The rendered document cache is unavailable. Rendering without it.`     |
| Mokly reads a damaged, unreadable, or foreign entry of the stylesheet store | `Cached stylesheets could not be reused. Building them again.`          |
| The stylesheet store directory is unusable, at most once per process        | `The stylesheet cache is unavailable. Building stylesheets without it.` |

Rich mode prefixes `!`, and plain mode prefixes `[mokly/warning]`. The command
then compiles the bundle, builds the stylesheets, or renders the document, and
continues. A cache warning is not a
[build warning](./mokly-build-warnings.md), so `--strict` does not count it.
Decision: a cache failure warns and the command continues. Failing the command
was rejected, because cache faults must not fail a command. A
record in the timing output alone was rejected, because the user then cannot
see the failure.
