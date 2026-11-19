//! Single-file bundle inventories bound memory and keep entry faults local.

use std::fs;
use std::path::Path;

use crate::bundle_cache_types::{BundleRecord, RECEIPT_BYTES};
use crate::bundle_receipts::{self, ReadReceipt};
use crate::error::{Error, InternalError, Result};
use crate::storage::{SystemStorage, valid_key};
use crate::storage_tree::{check, validate_directory, vanished};

pub(crate) fn records(
    storage: &SystemStorage,
    directory: &Path,
    limit: u64,
) -> Result<Vec<BundleRecord>> {
    validate_directory(&storage.root, directory)?;
    let items = match fs::read_dir(directory) {
        Ok(items) => items,
        Err(error) if vanished(&error) => return Ok(vec![]),
        Err(source) => return Err(InternalError::Io { source }.into()),
    };
    let entry_faults = directory.file_name().is_some_and(|name| name == "entries");
    let mut records = Vec::new();
    for item in items {
        check(storage.cancellation.as_ref())?;
        let item = match item {
            Ok(item) => item,
            Err(error) if vanished(&error) => continue,
            Err(source) => return Err(InternalError::Io { source }.into()),
        };
        let key = item.file_name().to_string_lossy().into_owned();
        if !valid_key(&key) {
            continue;
        }
        if records.len() as u64 >= limit / RECEIPT_BYTES {
            return Err(Error::CacheLimit { limit });
        }
        let metadata = match fs::symlink_metadata(item.path()) {
            Ok(metadata) => metadata,
            Err(error) if vanished(&error) => continue,
            Err(_) if entry_faults => {
                records.push(BundleRecord {
                    key,
                    bytes: limit.saturating_add(1),
                    receipt: None,
                });
                continue;
            }
            Err(source) => return Err(InternalError::Io { source }.into()),
        };
        if !metadata.is_dir() || metadata.is_symlink() {
            records.push(BundleRecord {
                key,
                bytes: metadata.len().saturating_add(RECEIPT_BYTES),
                receipt: None,
            });
            continue;
        }
        let mut receipt = match bundle_receipts::read(&item.path()) {
            ReadReceipt::Valid(receipt) => Some(receipt),
            ReadReceipt::Invalid => None,
            ReadReceipt::Unreadable if entry_faults => None,
            ReadReceipt::Unreadable => return Err(Error::UnsafeCache { path: item.path() }),
        };
        let actual = match measure(storage, &item.path(), limit) {
            Ok(Some(bytes)) => bytes,
            Ok(None) => {
                receipt = None;
                limit.saturating_add(1)
            }
            Err(Error::Cancelled) => return Err(Error::Cancelled),
            Err(_) if entry_faults => {
                receipt = None;
                limit.saturating_add(1)
            }
            Err(error) => return Err(error),
        };
        let bytes = receipt
            .as_ref()
            .map_or(actual, |receipt| actual.max(receipt.bytes));
        records.push(BundleRecord {
            key,
            bytes,
            receipt,
        });
    }
    Ok(records)
}

/// Only the root, data directory, one data file, and receipt files are owned.
pub(crate) fn measure(storage: &SystemStorage, entry: &Path, limit: u64) -> Result<Option<u64>> {
    let mut pending = vec![entry.to_owned()];
    let mut nodes = 0;
    let mut data = 0u64;
    let mut receipts = 0u64;
    while let Some(path) = pending.pop() {
        check(storage.cancellation.as_ref())?;
        nodes += 1;
        if nodes > 8 {
            return Ok(None);
        }
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) if vanished(&error) => continue,
            Err(source) => return Err(InternalError::Io { source }.into()),
        };
        if metadata.is_dir()
            && !metadata.is_symlink()
            && (path == entry || path == entry.join("data"))
        {
            let items = match fs::read_dir(&path) {
                Ok(items) => items,
                Err(error) if vanished(&error) => continue,
                Err(source) => return Err(InternalError::Io { source }.into()),
            };
            for item in items {
                if pending.len() + nodes >= 8 {
                    return Ok(None);
                }
                let item = match item {
                    Ok(item) => item,
                    Err(error) if vanished(&error) => continue,
                    Err(source) => return Err(InternalError::Io { source }.into()),
                };
                pending.push(item.path());
            }
        } else if metadata.is_file()
            && (path == entry.join("receipt.json") || path == entry.join("receipt.tmp"))
        {
            receipts = receipts.saturating_add(metadata.len());
        } else if metadata.is_file() && path == entry.join("data").join("bundle.json") {
            data = data.saturating_add(metadata.len());
        } else {
            return Ok(None);
        }
        if data.saturating_add(receipts) > limit {
            return Ok(Some(limit.saturating_add(1)));
        }
    }
    Ok(Some(data.saturating_add(receipts.max(RECEIPT_BYTES))))
}
