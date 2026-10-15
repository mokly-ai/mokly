//! Host cache storage with atomic completion receipts and confined traversal.

use std::fs;
use std::io::{Read, Write};
use std::path::Path;

use crate::cache_types::{Receipt, Record, Storage};
use crate::error::{Error, InternalError, IoResult, Result};
use crate::storage_tree::{copy_tree, digest, size, validate_directory};

/// Filesystem cache adapter. Namespace and entry locks belong to the caller.
pub struct SystemStorage;

impl Storage for SystemStorage {
    fn prepare(&self, directory: &Path) -> Result<()> {
        validate_directory(directory)?;
        fs::create_dir_all(directory).base()?;
        validate_directory(directory)
    }

    fn clear_staging(&self, directory: &Path) -> Result<()> {
        for item in fs::read_dir(directory).base()? {
            self.remove(&item.base()?.path())?;
        }
        Ok(())
    }

    fn records(&self, entries: &Path) -> Result<Vec<Record>> {
        let mut records = Vec::new();
        for item in fs::read_dir(entries).base()? {
            let item = item.base()?;
            let path = item.path();
            let name = item.file_name().to_string_lossy().into_owned();
            if !item.file_type().base()?.is_dir() || !valid_key(&name) {
                return Err(Error::UnsafeCache { path });
            }
            let mut receipt = read_receipt(&path)?.unwrap_or(Receipt {
                bytes: 0,
                digest: String::new(),
                used: 0,
            });
            match size(&path.join("data"), u64::MAX) {
                Ok(bytes) if receipt.used > 0 => receipt.bytes = bytes.saturating_add(1024),
                _ => {
                    receipt = Receipt {
                        bytes: size(&path, u64::MAX)?.saturating_add(1024),
                        used: 0,
                        digest: String::new(),
                    }
                }
            }
            records.push(Record { key: name, receipt });
        }
        Ok(records)
    }

    fn receipt(&self, entry: &Path, receipt: &Receipt) -> Result<()> {
        validate_directory(entry)?;
        let bytes = match serde_json::to_vec(receipt) {
            Ok(bytes) => bytes,
            Err(source) => return Err(InternalError::Json { source }.into()),
        };
        let temporary = entry.join("receipt.tmp");
        match fs::remove_file(&temporary) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(source) => return Err(InternalError::Io { source }.into()),
        }
        {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)
                .base()?;
            file.write_all(&bytes).base()?;
        }
        fs::rename(temporary, entry.join("receipt.json")).base()
    }

    fn size(&self, path: &Path, limit: u64) -> Result<u64> {
        size(path, limit)
    }

    fn digest(&self, path: &Path, limit: u64) -> Result<String> {
        digest(path, limit)
    }

    fn remove(&self, path: &Path) -> Result<()> {
        validate_directory(path.parent().unwrap_or(path))?;
        match fs::symlink_metadata(path) {
            Ok(metadata) if metadata.is_dir() => fs::remove_dir_all(path).base(),
            Ok(_) => fs::remove_file(path).base(),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(source) => Err(InternalError::Io { source }.into()),
        }
    }

    fn publish(&self, stage: &Path, target: &Path) -> Result<()> {
        validate_directory(stage)?;
        if fs::symlink_metadata(target).is_ok() {
            return Err(Error::UnsafeCache {
                path: target.to_owned(),
            });
        }
        fs::rename(stage, target).base()
    }

    fn copy(&self, source: &Path, destination: &Path, limit: u64) -> Result<()> {
        copy_tree(source, destination, limit)
    }
}

pub(crate) fn valid_key(key: &str) -> bool {
    matches!(key.len(), 40 | 64) && key.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn read_receipt(path: &Path) -> Result<Option<Receipt>> {
    let path = path.join("receipt.json");
    let metadata = match fs::symlink_metadata(&path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(source) => return Err(InternalError::Io { source }.into()),
    };
    if !metadata.is_file() || metadata.len() > 1024 {
        return Ok(None);
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .base()?
        .take(1025)
        .read_to_end(&mut bytes)
        .base()?;
    Ok(serde_json::from_slice(&bytes).ok())
}
