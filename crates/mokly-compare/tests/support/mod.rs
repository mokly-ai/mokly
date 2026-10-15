//! Host composition for isolated cache and local package-manager tests.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_compare::cache::DiskCache;
use mokly_compare::cache_types::{Builder, Reporter, Storage};
use mokly_compare::error::Result;
use mokly_compare::locations::OnceReporter;
use mokly_compare::storage::SystemStorage;
use mokly_git::control::{SystemClock, Token};
use mokly_platform::locks::SystemLocks;

#[derive(Default)]
pub struct Notices(pub AtomicUsize);

impl Reporter for Notices {
    fn opened(&self, _directory: &Path) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }
}

pub fn cache(root: PathBuf, limit: u64) -> DiskCache {
    DiskCache {
        root,
        source_bytes: limit,
        dependency_bytes: limit,
        storage: Arc::new(SystemStorage),
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

pub fn git(root: &Path, args: &[&str]) -> Vec<u8> {
    let output = Command::new("git")
        .current_dir(root)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{:?}: {}",
        args,
        String::from_utf8_lossy(&output.stderr)
    );
    output.stdout
}

pub fn storage() -> Arc<dyn Storage> {
    Arc::new(SystemStorage)
}
