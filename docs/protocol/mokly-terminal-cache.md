# Cache Output

The [terminal output contract](./mokly-terminal-output.md) owns modes and width.

## Cache Directory

The first time a command opens the base-side extraction cache, the dependency
install cache, the bundle cache, or the
[render store](./mokly-render-store.md) of the
[cache contract](./mokly-base-cache.md), it writes one line that names the
directory. All four caches share this line. While `build` or `publish`
renders the head catalogue, the line waits. The command writes it before the
next phase starts, or when rendering passes validation, whichever comes
first. A failure or a cancellation while the line waits drops it. Serve and
every other phase write the line at once. Rich mode prints it dimmed before
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

```text
  cache ~/.cache/mokly/3f9c1a…
```

## Cache Warnings

The bundle cache and the [render store](./mokly-render-store.md#faults) write
one warning line on stderr in each of these cases:

| Case                                                                    | Warning                                                              |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Mokly reads a damaged, unreadable, or foreign entry of the bundle cache | `A cached JavaScript bundle could not be reused. Bundling it again.` |
| The bundle cache directory is unusable, at most once per process        | `The JavaScript bundle cache is unavailable. Bundling without it.`   |
| Mokly reads a damaged, unreadable, or foreign entry of the render store | `A cached document could not be reused. Rendering it again.`         |
| The render store directory is unusable, at most once per process        | `The rendered document cache is unavailable. Rendering without it.`  |

Rich mode prefixes `!`, and plain mode prefixes `[mokly/warning]`. The command
then compiles the bundle or renders the document, and continues. A cache warning is not a
[build warning](./mokly-build-warnings.md), so `--strict` does not count it.
Decision: a cache failure warns and the command continues. Failing the command
was rejected, because cache faults must not fail a command. A
record in the timing output alone was rejected, because the user then cannot
see the failure.
