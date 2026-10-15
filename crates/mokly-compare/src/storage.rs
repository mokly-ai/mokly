//! Host cache storage with durable receipts and metadata-only namespace scans.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_git::control::Cancellation;
use mokly_platform::flush::Flush;

use crate::cache_types::{Receipt, Record, Storage};
use crate::durability::{publish_receipt, read_receipt, rename, sync_directory, sync_tree};
use crate::error::{Error, InternalError, IoResult, Result};
use crate::storage_tree::{check, copy_tree, remove, retire, size, validate_directory, vanished};

/// Host storage composed with a canonical namespace root and cancellation.
pub struct SystemStorage {
    /// Root resolved once at composition. Links at or above it are permitted.
    pub root: PathBuf,
    /// Generation cancellation, checked during walks.
    pub cancellation: Arc<dyn Cancellation>,
    /// Host flush strategy, composed through its platform boundary.
    pub flush: Arc<dyn Flush>,
}

impl Storage for SystemStorage {
    fn prepare(&self, directory: &Path) -> Result<()> {
        validate_directory(&self.root, directory)?;
        let created = directory
            .ancestors()
            .take_while(|path| !path.exists())
            .map(Path::to_owned)
            .collect::<Vec<_>>();
        fs::create_dir_all(directory).base()?;
        validate_directory(&self.root, directory)?;
        for path in created {
            check(self.cancellation.as_ref())?;
            sync_directory(&path)?;
            if let Some(parent) = path.parent() {
                sync_directory(parent)?;
            }
        }
        Ok(())
    }

    fn stages(&self, directory: &Path) -> Result<Vec<String>> {
        validate_directory(&self.root, directory)?;
        let mut names = Vec::new();
        let items = match fs::read_dir(directory) {
            Ok(items) => items,
            Err(error) if vanished(&error) => return Ok(names),
            Err(source) => return Err(InternalError::Io { source }.into()),
        };
        for item in items {
            check(self.cancellation.as_ref())?;
            let item = match item {
                Ok(item) => item,
                Err(error) if vanished(&error) => continue,
                Err(source) => return Err(InternalError::Io { source }.into()),
            };
            let kind = match item.file_type() {
                Ok(kind) => kind,
                Err(error) if vanished(&error) => continue,
                Err(source) => return Err(InternalError::Io { source }.into()),
            };
            if kind.is_symlink() {
                return Err(Error::UnsafeCache { path: item.path() });
            }
            let name = item.file_name().to_string_lossy().into_owned();
            if valid_key(&name) {
                names.push(name);
            }
        }
        Ok(names)
    }

    fn inspect(&self, entry: &Path, limit: u64) -> Result<Option<Receipt>> {
        validate_directory(&self.root, entry)?;
        let Some(mut receipt) = read_receipt(entry)? else {
            return Ok(None);
        };
        if receipt.used == 0 || receipt.bytes > limit {
            return Ok(None);
        }
        if !fs::symlink_metadata(entry.join("data")).is_ok_and(|metadata| metadata.is_dir()) {
            return Ok(None);
        }
        let bytes = match self.size(&entry.join("data"), limit) {
            Ok(bytes) => bytes.saturating_add(1024),
            Err(Error::CacheLimit { .. }) => return Ok(None),
            Err(error) => return Err(error),
        };
        if bytes > limit {
            return Ok(None);
        }
        receipt.bytes = bytes;
        Ok(Some(receipt))
    }

    fn records(&self, entries: &Path) -> Result<Vec<Record>> {
        validate_directory(&self.root, entries)?;
        let mut records = Vec::new();
        for item in fs::read_dir(entries).base()? {
            check(self.cancellation.as_ref())?;
            let item = match item {
                Ok(item) => item,
                Err(error) if vanished(&error) => continue,
                Err(source) => return Err(InternalError::Io { source }.into()),
            };
            let kind = match item.file_type() {
                Ok(kind) => kind,
                Err(error) if vanished(&error) => continue,
                Err(source) => return Err(InternalError::Io { source }.into()),
            };
            if kind.is_symlink() {
                return Err(Error::UnsafeCache { path: item.path() });
            }
            let key = item.file_name().to_string_lossy().into_owned();
            if !valid_key(&key) || !kind.is_dir() {
                continue;
            }
            let receipt = match read_receipt(&item.path())? {
                Some(receipt) => receipt,
                None => Receipt { bytes: 0, used: 0 },
            };
            records.push(Record { key, receipt });
        }
        Ok(records)
    }

    fn synchronize(&self, directory: &Path) -> Result<()> {
        validate_directory(&self.root, directory)?;
        sync_tree(directory, self.cancellation.as_ref(), self.flush.as_ref())
    }

    fn receipt(&self, entry: &Path, receipt: &Receipt) -> Result<()> {
        validate_directory(&self.root, entry)?;
        publish_receipt(entry, receipt, true)
    }

    fn size(&self, path: &Path, limit: u64) -> Result<u64> {
        size(&self.root, path, limit, self.cancellation.as_ref())
    }

    fn touch(&self, entry: &Path, receipt: &Receipt) -> Result<()> {
        validate_directory(&self.root, entry)?;
        publish_receipt(entry, receipt, false)
    }

    fn retire(&self, path: &Path, trash: &Path) -> Result<()> {
        validate_directory(&self.root, path)?;
        validate_directory(&self.root, trash)?;
        fs::create_dir_all(trash).base()?;
        validate_directory(&self.root, trash)?;
        retire(path, trash)
    }

    fn remove(&self, path: &Path) -> Result<()> {
        validate_directory(&self.root, path.parent().unwrap_or(path))?;
        remove(path, self.cancellation.as_ref())
    }

    fn publish(&self, stage: &Path, target: &Path) -> Result<()> {
        validate_directory(&self.root, stage)?;
        validate_directory(&self.root, target)?;
        if fs::symlink_metadata(target).is_ok() {
            return Err(Error::UnsafeCache {
                path: target.to_owned(),
            });
        }
        rename(stage, target)?;
        if let Some(parent) = target.parent() {
            sync_directory(parent)?;
        }
        if let Some(parent) = stage.parent() {
            sync_directory(parent)?;
        }
        Ok(())
    }

    fn copy(&self, source: &Path, destination: &Path, limit: u64) -> Result<()> {
        validate_directory(&self.root, destination)?;
        copy_tree(
            &self.root,
            source,
            destination,
            limit,
            self.cancellation.as_ref(),
        )
    }
}

pub(crate) fn valid_key(key: &str) -> bool {
    matches!(key.len(), 40 | 64) && key.bytes().all(|byte| byte.is_ascii_hexdigit())
}
