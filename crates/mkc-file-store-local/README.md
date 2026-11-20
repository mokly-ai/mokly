# mkc-file-store-local

Local immutable storage for Mokly Cloud development and integration tests.
Construct it through `LocalFileStoreFactory` and pass `Arc<dyn FileStore>` to
services. Production configuration selects GCS.

## Responsibilities

Persist verified content in an exclusively owned directory with private access.

## What This Crate Does

The factory prepares a mode-0700 root. Writes verify size and hash, then
publish the file atomically without replacing existing bytes. Reads reject
symlinks and verify content integrity; a full stream open verifies length and
SHA-256 before releasing its final byte, and a ranged open exposes exactly
the selected bytes. Object paths use only typed hash/incarnation values;
user-authored catalogue paths never reach disk. Pagination bounds retained
listing memory; object modification time determines orphan grace. The
directory must remain exclusively owned by this process's user because
filesystem path checks do not protect against a hostile writer with the same
operating-system permissions. `put` borrows the shared `Bytes` allocation
while writing and rejects an already exhausted `OperationDeadline` before
touching the filesystem.

`SeedStoreFactory::open_seed` prepares the same private root and returns
`Arc<dyn SeedStore>`. Seed objects live at `<root>/seed/<run>/<file>`, separate
from content objects. Each put publishes a synced temporary file by atomic
replacement, so a second status write replaces the first complete file.
Seed reads return `None` for missing objects and enforce the interface's byte
limits. Reads and writes refuse symlink ancestors, symlink files and nonfiles.

## Quick Start

Open the directory at a composition root and hand out the shared boundary:

```rust
use std::path::Path;
use std::sync::Arc;

use mkc_file_store_interface::error::Result;
use mkc_file_store_interface::store::FileStore;
use mkc_file_store_local::directory::{FileStoreFactory, LocalFileStoreFactory};

fn open_blob_directory(root: &Path) -> Result<Arc<dyn FileStore>> {
    LocalFileStoreFactory.open(root)
}
```

The development scripts do this for the API and the catalogue server, which
share one blob directory and signing key:

```sh
scripts/cloud/dev-api.sh
# In another terminal:
scripts/cloud/dev-catalogue.sh
```

## Development

```sh
cargo test -p mkc-file-store-local
cargo clippy -p mkc-file-store-local --all-targets -- -D warnings
```

### Key Code

- [directory.rs](./src/directory.rs) — `FileStoreFactory`, `SeedStoreFactory` and `LocalFileStoreFactory`, the composition-root factories, and the native directory boundary that checks symlink ancestors and publishes immutable files atomically.
- [local.rs](./src/local.rs) — `LocalStore`, the `FileStore` implementation: streamed opens, deletes that fence the exact incarnation and the bounded-memory listing.
- [seed.rs](./src/seed.rs) — `LocalSeedStore`, the seed implementation with bounded reads and atomic replacing puts.
- [seed_tests.rs](./tests/seed_tests.rs) — the seed lifecycle, replacement, read limits and filesystem safety tests.
- [storage_tests.rs](./tests/storage_tests.rs) — the real-filesystem lifecycle, integrity, symlink and incarnation-fence tests.

### Related Docs

- [Storage interface](../mkc-file-store-interface/README.md)
- [Catalogue hosting](../../docs/protocol/cloud/catalogue-hosting.md)
- [Publish smoke](../../docs/ops/publish-smoke.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
