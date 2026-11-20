//! Child-owned homes keep every platform's OS cache outside the catalogue.

use std::path::PathBuf;

use tempfile::TempDir;

/// Keep this owner alive until the child process has stopped.
pub(crate) struct Cache {
    home: TempDir,
}

impl Cache {
    /// Make a home separate from the catalogue's watched source root.
    pub(crate) fn new() -> Self {
        Self {
            home: tempfile::tempdir().unwrap(),
        }
    }

    /// Set child variables only, retaining their ordinary home and cache meanings.
    pub(crate) fn environment(&self) -> [(&'static str, PathBuf); 3] {
        let home = dunce::canonicalize(self.home.path()).unwrap();
        [
            ("HOME", home.clone()),
            ("XDG_CACHE_HOME", home.join(".cache")),
            ("LOCALAPPDATA", home.join("AppData").join("Local")),
        ]
    }
}
