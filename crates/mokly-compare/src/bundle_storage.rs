//! Confined single-file bundle IO and bounded namespace inventories.

use std::fs;
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_git::control::Cancellation;
use thiserror::Error;

use crate::bundle_cache_types::{CAPACITY, CompilationRead, OpenBundle, RECEIPT_BYTES};
use crate::bundle_inventory::measure;
use crate::bundle_receipts::{self, ReadReceipt};
use crate::error::{Error, Result};
use crate::storage::SystemStorage;
use crate::storage_tree::{self, check, validate_directory, vanished};

pub(crate) fn data_path(entry: &Path) -> PathBuf {
    entry.join("data").join("bundle.json")
}

pub(crate) fn compilation(storage: &SystemStorage, entry: &Path) -> Result<CompilationRead> {
    check(storage.cancellation.as_ref())?;
    validate_directory(&storage.root, entry.parent().unwrap_or(entry))?;
    let metadata = match fs::symlink_metadata(entry) {
        Ok(metadata) => metadata,
        Err(error) if vanished(&error) => return Ok(CompilationRead::Absent),
        Err(_) => return Ok(CompilationRead::Unreadable),
    };
    if !metadata.is_dir() {
        return Ok(CompilationRead::Damaged);
    }
    Ok(match bundle_receipts::read(entry) {
        ReadReceipt::Valid(receipt) => CompilationRead::Present(receipt.runtime_digest),
        ReadReceipt::Invalid => CompilationRead::Damaged,
        ReadReceipt::Unreadable => CompilationRead::Unreadable,
    })
}

pub(crate) fn open(storage: &SystemStorage, entry: &Path) -> Result<OpenBundle> {
    check(storage.cancellation.as_ref())?;
    validate_directory(&storage.root, entry.parent().unwrap_or(entry))?;
    let metadata = match fs::symlink_metadata(entry) {
        Ok(metadata) => metadata,
        Err(error) if vanished(&error) => return Ok(OpenBundle::Absent),
        Err(_) => return Ok(OpenBundle::Unreadable(None)),
    };
    if !metadata.is_dir() {
        return Ok(OpenBundle::Damaged(None));
    }
    let receipt = match bundle_receipts::read(entry) {
        ReadReceipt::Valid(receipt) => receipt,
        ReadReceipt::Invalid => return Ok(OpenBundle::Damaged(None)),
        ReadReceipt::Unreadable => return Ok(OpenBundle::Unreadable(None)),
    };
    let token = Some(receipt.publication);
    match measure(storage, entry, CAPACITY) {
        Ok(Some(bytes)) if bytes == receipt.bytes => {}
        Err(Error::Cancelled) => return Err(Error::Cancelled),
        Err(_) => return Ok(OpenBundle::Unreadable(token)),
        _ => return Ok(OpenBundle::Damaged(token)),
    }
    let mut files = match fs::read_dir(entry.join("data")) {
        Ok(files) => files,
        Err(error) if vanished(&error) => return Ok(OpenBundle::Damaged(token)),
        Err(_) => return Ok(OpenBundle::Unreadable(token)),
    };
    let file = match files.next() {
        Some(Ok(file)) if file.path() == data_path(entry) => file,
        Some(Err(_)) => return Ok(OpenBundle::Unreadable(token)),
        _ => return Ok(OpenBundle::Damaged(token)),
    };
    if files.next().is_some() {
        return Ok(OpenBundle::Damaged(token));
    }
    let metadata = match fs::symlink_metadata(file.path()) {
        Ok(metadata) => metadata,
        Err(_) => return Ok(OpenBundle::Unreadable(token)),
    };
    if !metadata.is_file() || metadata.len().saturating_add(RECEIPT_BYTES) != receipt.bytes {
        return Ok(OpenBundle::Damaged(token));
    }
    let input = match fs::File::open(file.path()) {
        Ok(input) => input,
        Err(_) => return Ok(OpenBundle::Unreadable(token)),
    };
    Ok(OpenBundle::Complete {
        input: Box::new(CheckedInput {
            input,
            cancellation: storage.cancellation.clone(),
        }),
        bytes: metadata.len(),
        receipt,
    })
}

pub(crate) fn retire(storage: &SystemStorage, path: &Path, trash: &Path) -> Result<()> {
    check(storage.cancellation.as_ref())?;
    validate_directory(&storage.root, path.parent().unwrap_or(path))?;
    validate_directory(&storage.root, trash)?;
    storage_tree::retire(path, trash)
}

struct CheckedInput {
    input: fs::File,
    cancellation: Arc<dyn Cancellation>,
}

#[derive(Debug, Error)]
#[error("[mokly-compare/bundle-cache] input cancelled")]
struct CancelledInput;

impl Read for CheckedInput {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        if self.cancellation.cancelled() {
            return Err(io::Error::other(CancelledInput));
        }
        self.input.read(bytes)
    }
}

impl Seek for CheckedInput {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        if self.cancellation.cancelled() {
            return Err(io::Error::other(CancelledInput));
        }
        self.input.seek(position)
    }
}
