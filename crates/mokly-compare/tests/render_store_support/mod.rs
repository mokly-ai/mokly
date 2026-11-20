//! Isolated real storage and one location for render-kind test data.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_compare::cache::DiskCache;
use mokly_compare::cache_types::Reporter;
use mokly_compare::storage::SystemStorage;
use mokly_git::control::{SystemClock, Token};
use mokly_platform::flush::SystemFlush;
use mokly_platform::locks::SystemLocks;

struct Notices;
impl Reporter for Notices {
    fn opened(&self, _: &Path) {}
}

pub fn cache(root: PathBuf) -> DiskCache {
    let cancellation = Arc::new(Token::default());
    DiskCache {
        root: root.clone(),
        source_bytes: 1,
        dependency_bytes: 1,
        storage: Arc::new(SystemStorage {
            root,
            cancellation: cancellation.clone(),
            flush: Arc::new(SystemFlush),
        }),
        locks: Arc::new(SystemLocks),
        clock: Arc::new(SystemClock::default()),
        cancellation,
        reporter: Arc::new(Notices),
    }
}

pub fn namespace(cache: &DiskCache) -> PathBuf {
    cache.root.join("renders")
}
pub fn data(cache: &DiskCache, key: &str) -> PathBuf {
    namespace(cache)
        .join("entries")
        .join(key)
        .join("data/bundle.json")
}

pub mod document;
