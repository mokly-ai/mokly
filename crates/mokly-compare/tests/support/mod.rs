//! Host composition for isolated cache and local package-manager tests.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_compare::cache::DiskCache;
use mokly_compare::cache_types::{Builder, Reporter, Storage};
use mokly_compare::comparison_steps::{Step, Steps};
use mokly_compare::error::Result;
use mokly_compare::locations::OnceReporter;
use mokly_compare::storage::SystemStorage;
use mokly_git::control::{SystemClock, Token};
use mokly_platform::locks::SystemLocks;

/// Receives cache steps in fixtures that inspect sources and installed files.
pub struct IgnoredSteps;

impl Steps for IgnoredSteps {
    fn step(&self, _: Step) {}
}

#[derive(Default)]
pub struct Notices(pub AtomicUsize);

impl Reporter for Notices {
    fn opened(&self, _directory: &Path) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }
}

pub fn cache(root: PathBuf, limit: u64) -> DiskCache {
    DiskCache {
        root: root.clone(),
        source_bytes: limit,
        dependency_bytes: limit,
        storage: Arc::new(SystemStorage {
            flush: Arc::new(mokly_platform::flush::SystemFlush),
            root: root.clone(),
            cancellation: Arc::new(Token::default()),
        }),
        locks: Arc::new(SystemLocks),
        clock: Arc::new(SystemClock::default()),
        cancellation: Arc::new(Token::default()),
        reporter: Arc::new(OnceReporter {
            reporter: Arc::new(Notices::default()),
            announced: false.into(),
        }),
    }
}

pub struct Files {
    pub calls: AtomicUsize,
}

impl Files {
    pub fn new() -> Self {
        Self {
            calls: AtomicUsize::new(0),
        }
    }
}

impl Builder for Files {
    fn build(&self, destination: &Path) -> Result<()> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        fs::create_dir(destination).unwrap();
        fs::write(destination.join("file"), b"content").unwrap();
        Ok(())
    }
}

pub fn storage(root: &Path) -> Arc<dyn Storage> {
    Arc::new(SystemStorage {
        flush: Arc::new(mokly_platform::flush::SystemFlush),
        root: dunce::canonicalize(root).unwrap(),
        cancellation: Arc::new(Token::default()),
    })
}
