//! Host composition for isolated cache and local package-manager tests.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;

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

pub fn git(root: &Path, args: &[&str]) -> Vec<u8> {
    git_input(root, args, b"")
}

/// Run Git with isolated configuration and piped standard input.
pub fn git_input(root: &Path, args: &[&str], input: &[u8]) -> Vec<u8> {
    let mut child = Command::new("git")
        .env(
            "GIT_CONFIG_GLOBAL",
            if cfg!(windows) { "NUL" } else { "/dev/null" },
        )
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .current_dir(root)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let (output, write_result) = thread::scope(|scope| {
        let writer = scope.spawn(move || stdin.write_all(input));
        let output = child.wait_with_output().unwrap();
        let write_result = writer.join().unwrap();
        (output, write_result)
    });
    assert!(
        output.status.success(),
        "{:?}: {}",
        args,
        String::from_utf8_lossy(&output.stderr)
    );
    write_result.unwrap();
    output.stdout
}

pub fn storage(root: &Path) -> Arc<dyn Storage> {
    Arc::new(SystemStorage {
        flush: Arc::new(mokly_platform::flush::SystemFlush),
        root: dunce::canonicalize(root).unwrap(),
        cancellation: Arc::new(Token::default()),
    })
}
