//! Isolated temporary directories and expected-state waits for OS adapter tests.

use std::env;
use std::fs;
use std::io::ErrorKind;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;
use std::time::{Duration, Instant};

static NEXT_DIRECTORY: AtomicUsize = AtomicUsize::new(0);

pub(super) struct TestDirectory {
    root: PathBuf,
}

impl TestDirectory {
    pub(super) fn new() -> Self {
        loop {
            let number = NEXT_DIRECTORY.fetch_add(1, Ordering::SeqCst);
            let root = env::temp_dir().join(format!(
                "mokly-remote-adapter-{}-{number}",
                std::process::id()
            ));
            match fs::create_dir(&root) {
                Ok(()) => return Self { root },
                Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
                Err(error) => panic!("cannot create adapter directory: {error}"),
            }
        }
    }

    pub(super) fn path(&self) -> &Path {
        &self.root
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        #[cfg(unix)]
        if let Ok(entries) = fs::read_dir(&self.root) {
            for entry in entries.flatten() {
                let _ = fs::set_permissions(entry.path(), fs::Permissions::from_mode(0o700));
            }
        }
        let _ = fs::remove_dir_all(&self.root);
    }
}

/// The deadline only stops a hung expected-state wait. It is not a speed check.
pub(super) fn wait_for(condition: impl Fn() -> bool) -> bool {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if condition() {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        thread::sleep(Duration::from_millis(1));
    }
}
