# mokly-git

`mokly-git` runs bounded Git commands for the Mokly core. Use the runner trait
for Git IO and the batch trait for path queries. `mokly-platform` supplies
process groups and Windows job objects.

## Responsibilities

- Run Git with an explicit argument vector and checkout directory.
- Bound captured output on both streams.
- Split path arguments into ordered, bounded batches.
- Preserve binary output and typed process failures.

## What This Crate Does

`SystemRunner` starts Git without a shell. It removes repository-redirection
environment variables and captures stdout and stderr concurrently. Each
stream is limited to 64 MiB by default. Exceeding a bound kills the process
tree before returning `OutputLimit`.

`BoundedRunner` consumes `dyn Runner`. The default budgets are 128 path
arguments and 16 KiB of conservative encoded argument cost. A path too large
for one batch fails before any command runs. Empty path input issues no
command. A failed batch stops the sequence. Merge-base, changed-path, tree,
blob, and archive operations build on this boundary.

## Quick Start

```bash
cargo test -p mokly-git
```

Construct `SystemRunner` with `Arc<dyn ProcessGroups>` at the CLI composition
root. Pass it as `Arc<dyn Runner>` to consumers. Tests use `unimock` at this
boundary.

## Development

```bash
cargo clippy -p mokly-git --all-targets -- -D warnings
```

Unit tests assert argument order, budgets, and command counts. Integration
tests execute Git and verify output limits and failed exit statuses.

### Key Code

- [Request and runner trait](./src/command.rs).
- [Batch coordinator](./src/batches.rs).
- [Host adapter](./src/system.rs) and [errors](./src/error.rs).

### Related Docs

- [Rust architecture](../../docs/architecture/rust-core.md).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [Comparison](../../docs/protocol/mokly-comparison.md).
