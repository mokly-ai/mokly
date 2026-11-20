//! Bounded segment envelopes verify complete payloads before private document decoding.

use std::io::SeekFrom;

use mokly_graph::document_store::{EntryFault, StoreKey};
use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::bundle_cache_types::BundleInput;

pub(crate) const MAX_BYTES: usize = 2 * 1024 * 1024;
const MAX_HEADER: usize = 32 * 1024;
pub(crate) const MAX_DOCUMENTS: usize = 64;
const PREFIX: usize = 12;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Header {
    pub(crate) payload_digest: String,
    pub(crate) documents: Vec<Position>,
}

#[derive(Deserialize)]
pub(crate) struct Position {
    pub(crate) key: String,
    pub(crate) offset: u64,
    pub(crate) bytes: u64,
    pub(crate) digest: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Version {
    format_version: u8,
    mokly_version: String,
}

pub(crate) fn header(
    input: &mut dyn BundleInput,
    bytes: u64,
    version: &str,
    verify_payload: bool,
) -> Result<(Header, u64, [u8; 32]), EntryFault> {
    if bytes > MAX_BYTES as u64 || bytes < PREFIX as u64 {
        return Err(EntryFault::Damaged);
    }
    let mut prefix = [0; PREFIX];
    input.read_exact(&mut prefix).or(Err(EntryFault::Damaged))?;
    if &prefix[..8] != b"MKSEG001" {
        return Err(EntryFault::Damaged);
    }
    let mut length = [0; 4];
    length.copy_from_slice(&prefix[8..]);
    let length = u32::from_le_bytes(length) as usize;
    if length > MAX_HEADER || length as u64 > bytes - PREFIX as u64 {
        return Err(EntryFault::Damaged);
    }
    let mut first = vec![0; length];
    input.read_exact(&mut first).or(Err(EntryFault::Damaged))?;
    let version_header: Version = serde_json::from_slice(&first).or(Err(EntryFault::Damaged))?;
    if version_header.format_version != 1 || version_header.mokly_version != version {
        return Err(EntryFault::Foreign);
    }
    let header: Header = serde_json::from_slice(&first).or(Err(EntryFault::Damaged))?;
    let start = first.len() as u64 + PREFIX as u64;
    let payload = bytes.checked_sub(start).ok_or(EntryFault::Damaged)?;
    if !valid_key(&header.payload_digest)
        || header.documents.is_empty()
        || header.documents.len() > MAX_DOCUMENTS
    {
        return Err(EntryFault::Damaged);
    }
    let mut offset = 0u64;
    for position in &header.documents {
        if !valid_key(&position.key)
            || !valid_key(&position.digest)
            || position.offset != offset
            || position.bytes < 64
        {
            return Err(EntryFault::Damaged);
        }
        offset = offset
            .checked_add(position.bytes)
            .ok_or(EntryFault::Damaged)?;
        if offset > payload {
            return Err(EntryFault::Damaged);
        }
    }
    if offset != payload {
        return Err(EntryFault::Damaged);
    }
    let header_digest = Sha256::digest(&first).into();
    if !verify_payload {
        return Ok((header, start, header_digest));
    }
    let mut hash = Sha256::new();
    let mut length = 0u64;
    let mut chunk = [0; 64 * 1024];
    loop {
        let count = input.read(&mut chunk).or(Err(EntryFault::Unreadable))?;
        if count == 0 {
            break;
        }
        length = length.saturating_add(count as u64);
        if length > payload {
            return Err(EntryFault::Damaged);
        }
        hash.update(&chunk[..count]);
    }
    if length != payload || hex(&hash.finalize()) != header.payload_digest {
        return Err(EntryFault::Damaged);
    }
    Ok((header, start, header_digest))
}

pub(crate) fn document(
    input: &mut dyn BundleInput,
    header: &Header,
    start: u64,
    key: &StoreKey,
) -> Result<Vec<u8>, EntryFault> {
    let position = header
        .documents
        .iter()
        .find(|position| position.key == key.0)
        .ok_or(EntryFault::Damaged)?;
    input
        .seek(SeekFrom::Start(start + position.offset))
        .or(Err(EntryFault::Unreadable))?;
    let mut bytes = vec![0; position.bytes as usize];
    input
        .read_exact(&mut bytes)
        .or(Err(EntryFault::Unreadable))?;
    if bytes[..64] != *key.0.as_bytes() || hex(&Sha256::digest(&bytes)) != position.digest {
        return Err(EntryFault::Damaged);
    }
    Ok(bytes.split_off(64))
}

pub(crate) fn valid_key(key: &str) -> bool {
    key.len() == 64 && key.bytes().all(|byte| byte.is_ascii_hexdigit())
}

pub(crate) fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
