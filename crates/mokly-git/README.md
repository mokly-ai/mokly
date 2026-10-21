# mokly-git

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-git` runs bounded Git commands for the Mokly core. Use the runner trait
for Git IO and the batch trait for path queries. `mokly-platform` supplies
process groups and Windows job objects.

## Responsibilities

- Run Git with an explicit argument vector and checkout directory.
- Bound captured output on both streams.
- Split path arguments into ordered, bounded batches.
- Preserve binary input, output, and typed process failures.
- Validate checkout identity before resolving a merge base.
- Read changed paths, tree metadata, and checkout-converted regular source files.
- Extract exact commit sources with the pinned commit's checkout attributes.

## What This Crate Does

`SystemRunner` starts Git without a shell. It removes repository-redirection
environment variables and captures stdout and stderr concurrently. Each
stream is limited to at most 64 MiB. A request can set a smaller bound.
Stderr has its own bound, 1 MiB by default, so Git warnings cannot exhaust a
tiny exact stdout budget. An excessive request fails with `InvalidOutputLimit` before process setup.
Exceeding the selected bound kills the process tree before returning
`OutputLimit`. `run_cancellable` accepts an explicit cancellation boundary.
The runner sends termination to the process tree, escalates to a forceful kill
after one second, reaps the child, and drains both pipes. Only an operation
that acted on cancellation returns `Cancelled`. Other typed failures keep
their own category.

`BoundedRunner` consumes `dyn Runner`. The default budgets are 128 path
arguments and 16 KiB of conservative encoded argument cost. A path too large
for one batch fails before any command runs. Empty path input issues no
command. A failed batch stops the sequence. Merge-base, changed-path, tree,
blob, and source archive operations build on this boundary.

`GitRepositories::open` compares canonical filesystem identities with Git's
checkout root. Its `Repository` trait resolves the configured ref to a commit
before `merge-base`. Changed paths include committed, staged, unstaged, and
untracked paths. Rename records keep Git's previous path and similarity.
Untracked additions never infer a rename.

Tree queries use literal pathspecs and NUL records. Base reads check missing
object ids first and fetch them in one promisor request before conversion. A
private index applies the base commit's attributes, configured smudge filters,
line-ending rules, and Git LFS. Tree listings retain directory and link modes.
Regular files and all metadata nodes have independent count bounds.
The commit source reader indexes requested roots and exact paths. Nonrecursive
path lookups avoid enumerating unrelated directories. `digest` streams blob
stdout through SHA-256 with bounded memory and the same cancellation and exit
checks; stderr retains its capture limit. Working inputs compare
bytes first and hash changed confined paths in one stdin-paths command. `read_many` accepts
proved entries and reads their converted files through bounded batches. A
failed filter, timeout, or converted-byte bound leaves that resource
unavailable with a warning while independent reads continue. Extraction has a
total disk byte bound.
It streams oversized files to disk and writes smaller files one batch at a time, copies regular blobs, preserves executable mode, and omits symbolic links
and submodules. Unsupported host names and non-UTF-8 candidates are traced
and skipped. Ordinary colons and backslashes remain in Git path identities.
Archive-only attributes never change source bytes. A destination
must be fresh; a failed extraction removes its partial directory.

The runner writes and closes stdin concurrently with both output readers.
Input is bounded to 64 MiB. Cancellation before spawn starts nothing. Active
cancellation sends TERM once and KILL at one second. The runner waits for the
child and every pipe before it returns. It also disposes remaining helpers.

## Quick Start

```bash
cargo test -p mokly-git
```

Construct `SystemRunner` with `Arc<dyn ProcessGroups>`, `Arc<dyn Clock>`, and
`Arc<dyn Cancellation>` at the CLI composition root. Pass it as `Arc<dyn Runner>` to consumers. Tests use `unimock` at this
boundary.

## Development

Consumers enable the `mock` feature to use every public trait with unimock.

```bash
cargo clippy -p mokly-git --all-targets -- -D warnings
```

Unit tests assert argument order, budgets, and command counts. Integration
tests execute Git and verify output limits, failed exit statuses, and partial
extraction cleanup after cancellation during a streamed copy.

### Key Code

- [Request and runner trait](./src/command.rs).
- [Batch coordinator](./src/batches.rs).
- [Host adapter](./src/system.rs), [control](./src/control.rs), and
  [repository operations](./src/repository.rs).
- [Tree metadata](./src/tree.rs), [extraction](./src/disk.rs), and
  [errors](./src/error.rs).

### Related Docs

- [Rust architecture](../../docs/architecture/rust-core.md).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [Comparison](../../docs/protocol/mokly-comparison.md).
