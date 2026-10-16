//! Debug fault injection delegates every unaffected filesystem operation.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_static::error::Result;
use mokly_static::filesystem::{Entry, Files};

use super::{Faults, failure};

pub(super) struct Injected {
    pub(super) inner: Arc<dyn Files>,
    pub(super) faults: Faults,
}
impl Files for Injected {
    fn entry(&self, path: &Path) -> Result<Option<Entry>> {
        self.inner.entry(path)
    }
    fn project(&self, path: &Path) -> Result<PathBuf> {
        self.inner.project(path)
    }
    fn children(&self, path: &Path) -> Result<Vec<PathBuf>> {
        self.inner.children(path)
    }
    fn read(&self, path: &Path, limit: usize) -> Result<Vec<u8>> {
        self.inner.read(path, limit)
    }
    fn hash(&self, path: &Path) -> Result<String> {
        self.inner.hash(path)
    }
    fn link(&self, path: &Path) -> Result<PathBuf> {
        self.inner.link(path)
    }
    fn mkdir(&self, path: &Path) -> Result<()> {
        self.inner.mkdir(path)
    }
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<()> {
        if path
            .file_name()
            .is_some_and(|name| name == ".mokly-export-transaction")
        {
            if self.faults.has("setup-signal") {
                let _ = self.faults.gate("setup-signal");
                return Err(failure(path));
            }
            if self.faults.has("setup") {
                return Err(failure(path));
            }
        }
        if path.components().any(|part| part.as_os_str() == "stage") {
            if self.faults.has("stage-signal") {
                let _ = self.faults.gate("stage-signal");
                return Err(failure(path));
            }
            if self.faults.has("stage") {
                return Err(failure(path));
            }
        }
        self.inner.write(path, bytes)
    }
    fn unlink(&self, path: &Path) -> Result<()> {
        if path.components().any(|part| part.as_os_str() == "backup")
            && self.faults.has("backup-cleanup")
        {
            return Err(failure(path));
        }
        if path
            .file_name()
            .is_some_and(|name| name == ".mokly-export-transaction")
        {
            self.faults.event("reservation-unlink");
            if self.faults.has("reservation-cleanup") {
                return Err(failure(path));
            }
        }
        self.inner.unlink(path)
    }
    fn rmdir(&self, path: &Path) -> Result<()> {
        self.inner.rmdir(path)
    }
    fn remove_stage(&self, path: &Path) -> Result<()> {
        self.faults.event("remove-stage");
        if self.faults.has("stage-cleanup") {
            return Err(failure(path));
        }
        self.inner.remove_stage(path)
    }
}
