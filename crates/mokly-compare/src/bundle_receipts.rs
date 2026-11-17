//! Bounded bundle receipts preserve a publication nonce during access updates.

use std::fs;
use std::io::{Read, Write};
use std::path::Path;

use mokly_sidecar::bundle_store::RecordToken;
use serde::{Deserialize, Serialize};

use crate::bundle_cache_types::{BundleReceipt, CAPACITY, RECEIPT_BYTES};
use crate::durability::{rename, sync_directory};
use crate::error::{Error, InternalError, IoResult, Result};
use crate::storage_tree::vanished;

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct StoredReceipt {
    schema_version: u8,
    bytes: u64,
    used: u64,
    publication: String,
}

pub(crate) enum ReadReceipt {
    Valid(BundleReceipt),
    Invalid,
    Unreadable,
}

pub(crate) fn read(entry: &Path) -> ReadReceipt {
    let path = entry.join("receipt.json");
    let metadata = match fs::symlink_metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if vanished(&error) => return ReadReceipt::Invalid,
        Err(_) => return ReadReceipt::Unreadable,
    };
    if !metadata.is_file() || metadata.len() > RECEIPT_BYTES {
        return ReadReceipt::Invalid;
    }
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(_) => return ReadReceipt::Unreadable,
    };
    let mut bytes = Vec::new();
    if file
        .take(RECEIPT_BYTES + 1)
        .read_to_end(&mut bytes)
        .is_err()
    {
        return ReadReceipt::Unreadable;
    }
    if bytes.len() as u64 > RECEIPT_BYTES {
        return ReadReceipt::Invalid;
    }
    let receipt = match serde_json::from_slice::<StoredReceipt>(&bytes) {
        Ok(receipt) => receipt,
        Err(_) => return ReadReceipt::Invalid,
    };
    let Some(publication) = RecordToken::parse(&receipt.publication) else {
        return ReadReceipt::Invalid;
    };
    if receipt.schema_version != 1 || receipt.used == 0 || receipt.bytes > CAPACITY {
        return ReadReceipt::Invalid;
    }
    ReadReceipt::Valid(BundleReceipt {
        bytes: receipt.bytes,
        used: receipt.used,
        publication,
    })
}

pub(crate) fn publish(entry: &Path, receipt: &BundleReceipt, durable: bool) -> Result<()> {
    let stored = StoredReceipt {
        schema_version: 1,
        bytes: receipt.bytes,
        used: receipt.used,
        publication: receipt.publication.hex(),
    };
    let bytes = match serde_json::to_vec(&stored) {
        Ok(bytes) => bytes,
        Err(source) => return Err(InternalError::Json { source }.into()),
    };
    if bytes.len() as u64 > RECEIPT_BYTES {
        return Err(Error::CacheLimit {
            limit: RECEIPT_BYTES,
        });
    }
    let temporary = entry.join("receipt.tmp");
    match fs::remove_file(&temporary) {
        Ok(()) => {}
        Err(error) if vanished(&error) => {}
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
        fs::rename(temporary, entry.join("receipt.json")).base()
    }
}
