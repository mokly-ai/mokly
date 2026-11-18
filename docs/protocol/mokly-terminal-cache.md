# Cache Output

The [terminal output contract](./mokly-terminal-output.md) owns modes and width.

## Cache Directory

The first time a command opens the base-side extraction cache, the dependency
install cache, or the bundle cache of the
[cache contract](./mokly-base-cache.md), it writes one line that names the
directory. All three caches share this line. While `build` or `publish`
renders the head catalogue, the line waits. The command writes it before the
next phase starts, or when rendering passes validation, whichever comes
first. A failure or a cancellation while the line waits drops it. Serve and
every other phase write the line at once, except early base preparation in
Serve. It holds the line until Changes takes its outcome, under the
[handover rule](./mokly-base-early-preparation.md#handover). A stale or
rejected outcome drops it. A later cache opening by Changes itself then
writes the line. Rich mode prints it dimmed before
the next durable line; plain mode prints the exact string of the
compatibility contract on stdout. The line appears at most once per process
and names the directory so a reader can delete it, which is always safe.
Decision: in `build` and `publish`, the line waits only while the head renders, so a build that fails
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

The bundle cache writes one warning line on stderr in each of these cases:

| Case                                                                    | Warning                                                              |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Mokly reads a damaged, unreadable, or foreign entry of the bundle cache | `A cached JavaScript bundle could not be reused. Bundling it again.` |
| The bundle cache directory is unusable, at most once per process        | `The JavaScript bundle cache is unavailable. Bundling without it.`   |

Rich mode prefixes `!`, and plain mode prefixes `[mokly/warning]`. The command
then compiles the bundle and continues. A cache warning is not a
[build warning](./mokly-build-warnings.md), so `--strict` does not count it.
Decision: a cache failure warns and the command continues. Failing the command
was rejected, because deleting or damaging the cache must change time only. A
record in the timing output alone was rejected, because the user then cannot
see the failure.
