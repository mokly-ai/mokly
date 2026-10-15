//! Host cache storage with durable receipts and metadata-only namespace scans.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_git::control::Cancellation;

use crate::cache_types::{Receipt, Record, Storage};
use crate::durability::{publish_receipt, read_receipt, rename, sync_directory, sync_tree};
use crate::error::{Error, InternalError, IoResult, Result};
use crate::package_links;
use crate::storage_tree::{check, copy_tree, size, validate_directory, vanished};

/// Host storage composed with a canonical namespace root and cancellation.
pub struct SystemStorage {
    /// Root resolved once at composition. Links at or above it are permitted.
    pub root: PathBuf,
    /// Generation cancellation, checked during walks.
    pub cancellation: Arc<dyn Cancellation>,
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
        for item in fs::read_dir(directory).base()? {
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
        let bytes = self.size(&entry.join("data"), limit)?.saturating_add(1024);
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
        sync_tree(directory, self.cancellation.as_ref())
    }

    fn receipt(&self, entry: &Path, receipt: &Receipt) -> Result<()> {
        validate_directory(&self.root, entry)?;
        publish_receipt(entry, receipt)
    }

    fn size(&self, path: &Path, limit: u64) -> Result<u64> {
        size(&self.root, path, limit, self.cancellation.as_ref())
    }

    fn remove(&self, path: &Path) -> Result<()> {
        validate_directory(&self.root, path.parent().unwrap_or(path))?;
        match fs::symlink_metadata(path) {
            Ok(metadata) if metadata.is_dir() => fs::remove_dir_all(path).base(),
            Ok(_) => fs::remove_file(path).base(),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(source) => Err(InternalError::Io { source }.into()),
        }
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

    fn packages(
        &self,
        destination: &Path,
        source: &Path,
        packages: &BTreeMap<String, String>,
    ) -> Result<()> {
        self.prepare(destination)?;
        package_links::write(&self.root, destination, source, packages)
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
