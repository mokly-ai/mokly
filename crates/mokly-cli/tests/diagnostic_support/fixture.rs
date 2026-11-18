//! Temporary catalogue repositories with fixture-owned external OS caches.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tempfile::TempDir;

/// Keep the catalogue and its external cache alive for all fixture commands.
pub(crate) struct Fixture {
    repository: TempDir,
    cache: TempDir,
}

impl Fixture {
    /// Return the catalogue repository root.
    pub(crate) fn path(&self) -> &Path {
        self.repository.path()
    }

    /// Prepare the native CLI with a cache removed when this fixture drops.
    pub(crate) fn command(&self) -> Command {
        let cache = dunce::canonicalize(self.cache.path()).unwrap();
        let mut command = Command::new(env!("CARGO_BIN_EXE_mokly"));
        command
            .current_dir(self.path())
            .env("MOKLY_OUTPUT", "plain")
            .env("MOKLY_PACKAGE_ROOT", workspace().join("packages/mokly"))
            .env("XDG_CACHE_HOME", &cache)
            .env("HOME", &cache)
            .env("LOCALAPPDATA", &cache);
        command
    }
}

/// Create a JavaScript catalogue and a separate temporary OS cache root.
pub(crate) fn fixture() -> Fixture {
    let repository = tempfile::tempdir().unwrap();
    let cache = tempfile::tempdir().unwrap();
    write(repository.path(), "mokly.config.json", "{}");
    #[cfg(unix)]
    std::os::unix::fs::symlink(
        workspace().join("node_modules"),
        repository.path().join("node_modules"),
    )
    .unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(
        workspace().join("node_modules"),
        repository.path().join("node_modules"),
    )
    .unwrap();
    Fixture { repository, cache }
}

/// Write one source file in the temporary catalogue.
pub(crate) fn write(root: &Path, path: &str, text: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

fn workspace() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap()
}
