# Cache Directory Output

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

The [terminal output contract](./mokly-terminal-output.md) owns modes and width.

## Cache Directory

The first time a command opens the base-side extraction cache or the
dependency install cache of the
[render graph and cache contract](./mokly-render-cache.md#render-graph-and-cache), it writes one
line that names the directory. Rich mode prints it dimmed before the next
durable line; plain mode prints the exact string of the compatibility
contract on stdout. The line appears once per process and names the directory
so a reader can delete it, which is always safe.

```text
  cache ~/.cache/mokly/3f9c1a…
```
