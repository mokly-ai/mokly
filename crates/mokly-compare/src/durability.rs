//! Completion receipt publication after durable data and directory flushes.

use std::fs;
use std::io::{Read, Write};
use std::path::Path;

use mokly_git::control::Cancellation;
use mokly_platform::flush::Flush;
use serde::{Deserialize, Serialize};

use crate::cache_types::Receipt;
use crate::error::{InternalError, IoResult, PlatformResult, Result};
use crate::storage_tree::check;

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct StoredReceipt {
    schema_version: u8,
    bytes: u64,
    used: u64,
}

pub(crate) fn read_receipt(entry: &Path) -> Result<Option<Receipt>> {
    let path = entry.join("receipt.json");
    let metadata = match fs::symlink_metadata(&path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(source) => return Err(InternalError::Io { source }.into()),
    };
    if !metadata.is_file() || metadata.len() > 1024 {
        return Ok(None);
    }
    let mut bytes = Vec::new();
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(error)
            if matches!(
                error.kind(),
                std::io::ErrorKind::NotFound | std::io::ErrorKind::NotADirectory
            ) =>
        {
            return Ok(None);
        }
        Err(source) => return Err(InternalError::Io { source }.into()),
    };
    file.take(1025).read_to_end(&mut bytes).base()?;
    let stored = match serde_json::from_slice::<StoredReceipt>(&bytes) {
        Ok(stored) if stored.schema_version == 1 => stored,
        _ => return Ok(None),
    };
    Ok(Some(Receipt {
        bytes: stored.bytes,
        used: stored.used,
    }))
}

pub(crate) fn publish_receipt(entry: &Path, receipt: &Receipt, durable: bool) -> Result<()> {
    let stored = StoredReceipt {
        schema_version: 1,
        bytes: receipt.bytes,
        used: receipt.used,
    };
    let bytes = match serde_json::to_vec(&stored) {
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
        if durable {
            file.sync_all().base()?;
        }
    }
    if durable {
        sync_directory(entry)?;
        rename(&temporary, &entry.join("receipt.json"))?;
        sync_directory(entry)
    } else {
        fs::rename(&temporary, entry.join("receipt.json")).base()
    }
}

pub(crate) fn sync_tree(
    root: &Path,
    cancellation: &dyn Cancellation,
    flush: &dyn Flush,
) -> Result<()> {
    check(cancellation)?;
    if flush.filesystem(root).base()? {
        return check(cancellation);
    }
    let mut pending = vec![root.to_owned()];
    let mut directories = Vec::new();
    while let Some(directory) = pending.pop() {
        check(cancellation)?;
        for item in fs::read_dir(&directory).base()? {
            check(cancellation)?;
            let item = item.base()?;
            let metadata = fs::symlink_metadata(item.path()).base()?;
            if metadata.is_symlink() {
                continue;
            }
            if metadata.is_dir() {
                pending.push(item.path());
            } else if metadata.is_file() {
                flush.file(&item.path()).base()?;
            }
        }
        directories.push(directory);
    }
    for directory in directories.into_iter().rev() {
        check(cancellation)?;
        flush.directory(&directory).base()?;
    }
    if let Some(parent) = root.parent() {
        flush.directory(parent).base()?;
    }
    Ok(())
}

pub(crate) fn sync_directory(directory: &Path) -> Result<()> {
    #[cfg(unix)]
    fs::File::open(directory).base()?.sync_all().base()?;
    #[cfg(windows)]
    {
        let _ = directory;
    }
    Ok(())
}

pub(crate) fn rename(source: &Path, target: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        fs::rename(source, target).base()
    }
    #[cfg(windows)]
    {
        crate::windows_durability::rename(source, target)
    }
}
