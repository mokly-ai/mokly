# mokly-git

`mokly-git` runs bounded Git commands for the Mokly core. Use the runner trait
for Git IO and the batch trait for path queries. `mokly-platform` supplies
process groups and Windows job objects. `mokly-compare` reads base sources
through this crate, and `mokly-publish` checks the checkout with it.

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
environment variables and captures stdout and stderr concurrently. The
[Git command runtime](../../docs/protocol/mokly-git.md) sets the bound of each
stream. A request can set smaller bounds. An excessive request fails with
`InvalidOutputLimit` before process setup. Exceeding the selected bound kills
the process tree before returning `OutputLimit`. `run_cancellable` accepts an
explicit cancellation boundary. The runner terminates the process tree,
escalates to a forceful kill, reaps the child, and drains both pipes. Only an
operation that acted on cancellation returns `Cancelled`. Other typed failures
keep their own category.

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

Tree queries use literal pathspecs and NUL records. Requested files and their
ancestor attribute files share a missing-object preflight with lazy fetch
disabled. One serialized `fetch --stdin` request retrieves each missing set
before conversion. Failed fetches name the remote and a recovery command. Tree
listings retain directory and link modes. Regular files and all metadata nodes
have independent count bounds.

Byte reads, extraction, and digests share a commit-pinned `cat-file --filters`
context in the real repository. `--attr-source` selects the base attributes,
also when the caller exports a different `GIT_ATTR_SOURCE`. Relative smudge
commands and relative file reads keep their normal repository context. The
real index and working files stay intact.

A batch of two or more files within 48 MiB converts in one
`cat-file --batch --filters -Z` process. Each input line names a blob and its
path, and a sentinel name follows each file. Git prints the raw blob size in
each header, not the converted size, so the decoder ends each converted file
at the sentinel's `missing` record. The sentinel is random for each batch, so
no file content can predict it. The decoder validates the blob id, the NUL
framing, and the batch byte bound. A read keeps the converted files in memory
within its byte bound. The extraction streams each file into an owned
temporary file outside the repository. A path that starts with a space or a
tab converts alone, because Git strips that whitespace from a batch line. A
single file also converts alone with `--filters`. Every file of a call above
48 MiB streams alone: effective attributes and `core.autocrlf` select raw
`cat-file blob` for a path without conversion and `--filters` for the others.
The byte bound stops the process before more data is written. When a batch
reaches its deadline, each of its files converts again alone with its own
deadline, and a failure names its file. A file whose own conversion reaches
its deadline fails at once in each later call of the same repository session.
A store write failure keeps its typed error. A batch that fails or exceeds a bound
returns a typed `Conversion` error, and the extraction and the prefetch
convert its files again one at a time. A deadline and process-tree
cancellation supervise every conversion. Failed optional filters return typed
`Conversion` errors instead of raw fallback bytes. Conversion includes line
endings, encodings, filters, and LFS downloads.

`Repository::fingerprint_extracted` records a `Fingerprint` of each confined
regular file of an extraction: its size, its times, and on Unix its change
time and inode. `Repository::read_extracted` and
`Repository::digest_extracted` read the converted files back with the count
and byte checks and the error kinds of a Git read. A file reads from the
extraction only while it matches its fingerprint before and after the read. A
file that the extraction does not hold, that changed, or that it cannot
read, reads through Git.

Opaque digests stream converted stdout into SHA-256 without a temporary spool.
Working dependency inputs retain Git clean normalization through
`hash-object --stdin-paths`. Extraction copies regular converted files in
bounded batches and preserves executable mode. It omits links and submodules.
Copying checks cancellation after each chunk. Unsupported host names and
non-UTF-8 candidates are traced and skipped. Archive-only attributes never
change source bytes. A destination must be fresh. A failed extraction removes
its partial directory. Recoverable conversion failures omit individual files
and retain warnings.

The runner writes and closes stdin concurrently with both output readers. It
waits for the child and every pipe before it returns, and it disposes
remaining helpers.

## Quick Start

Construct the runner at the composition root and open a checkout:

```rust
use std::path::Path;
use std::sync::Arc;

use mokly_git::command::Runner;
use mokly_git::control::{SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::error::Result;
use mokly_git::identity::ObjectId;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::system::SystemRunner;
use mokly_platform::processes::SystemProcessGroups;

fn merge_base(checkout: &Path) -> Result<ObjectId> {
    let runner: Arc<dyn Runner> = Arc::new(SystemRunner {
        groups: Arc::new(SystemProcessGroups),
        cancellation: Arc::new(Token::default()),
        clock: Arc::new(SystemClock::default()),
    });
    let repositories: &dyn Repositories = &GitRepositories {
        runner,
        disk: Arc::new(SystemDisk),
    };
    repositories.open(checkout)?.merge_base("origin/main")
}
```

Pass the runner as `Arc<dyn Runner>` to consumers. Tests use `unimock` at
this boundary.

## Development

```bash
cargo test -p mokly-git
cargo clippy -p mokly-git --all-targets -- -D warnings
```

Consumers enable the `mock` feature to use every public trait with unimock.
Unit tests assert argument order, budgets, and command counts. Integration
tests execute Git and verify output limits, failed exit statuses, and partial
extraction cleanup after cancellation during a streamed copy.

### Key Code

- [`src/command.rs`](./src/command.rs) defines `Request`, `Output`, and
  `Runner`, the boundary for one bounded Git invocation.
- [`src/system.rs`](./src/system.rs) defines `SystemRunner`, the host runner
  that owns the process tree, the cancellation, and the clock.
- [`src/control.rs`](./src/control.rs) defines the `Cancellation` and `Clock`
  traits and their host types `Token` and `SystemClock`.
- [`src/batches.rs`](./src/batches.rs) defines `Batches` and `BoundedRunner`,
  which split path arguments into ordered, bounded batches.
- [`src/repository.rs`](./src/repository.rs) defines `Repositories`,
  `GitRepositories`, and `Repository`, which validate a checkout and read merge
  bases, changed paths, trees, blobs, and archives.
- [`src/disk.rs`](./src/disk.rs) defines `Disk` and `Archive`, the filesystem
  boundary for checkout identity, working reads, confined digests, and
  extraction.
- [`src/extracted.rs`](./src/extracted.rs) defines `ExtractedFiles` and reads
  and hashes the converted files of an extraction, with Git for the files
  that it lacks, that changed, or that it cannot read.
  [`src/fingerprint.rs`](./src/fingerprint.rs) defines `Fingerprint` and the
  checked reads.
- [`src/checkout.rs`](./src/checkout.rs) defines `Checkout`, the converted
  files of one batch. [`src/checkout_batch.rs`](./src/checkout_batch.rs) builds
  the filtered batch request, and
  [`src/checkout_output.rs`](./src/checkout_output.rs) defines `BatchSink`,
  the decoder that splits its output at the sentinel records.
  [`src/checkout_files.rs`](./src/checkout_files.rs) defines `BatchFiles`, with
  `MemoryFiles` for reads and `DirectoryFiles` for the extraction.
- [`src/tree.rs`](./src/tree.rs) and [`src/changes.rs`](./src/changes.rs)
  define the tree `Entry` and `Limits` records and the changed-path `Change`
  records.
- [`src/error.rs`](./src/error.rs) defines `Error`, the typed failure of every
  Git operation.

### Related Docs

- [Git command runtime](../../docs/protocol/mokly-git.md).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [Comparison](../../docs/protocol/mokly-comparison.md).
- [Base preparation](../../docs/protocol/mokly-base-preparation.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
