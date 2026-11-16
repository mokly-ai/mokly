# Cache Output

Status: In progress under the [bundle disk cache plan](../../plans/bundle-disk-cache.md).

The [terminal output contract](./mokly-terminal-output.md) owns modes and width.

## Cache Directory

The first time a command opens the base-side extraction cache, the dependency
install cache, or the bundle cache of the
[cache contract](./mokly-base-cache.md), it writes one line that names the
directory. All three caches share this line. Rich mode prints it dimmed before
the next durable line; plain mode prints the exact string of the
compatibility contract on stdout. The line appears once per process and names
the directory so a reader can delete it, which is always safe.

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
