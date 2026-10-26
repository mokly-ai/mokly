//! An independent reader of ownership v3 and of a complete upload inventory.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::strict_json;
use crate::upload::{self, Rejection};

/// The file name of the ownership marker.
pub const MARKER: &str = ".mokly-export-artifact";

/// The largest owned file, in bytes.
const MAX_FILE: u64 = 67_108_864;

static SHA256: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[0-9a-f]{64}$").unwrap());

/// One owned file of the ownership marker.
#[derive(Clone, Debug)]
pub struct Owned {
    /// The portable relative path.
    pub path: String,
    /// The lowercase hexadecimal SHA-256 digest.
    pub sha256: String,
    /// The size in bytes.
    pub size: u64,
}

/// The lowercase hexadecimal SHA-256 digest of `bytes`.
pub fn digest(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Read ownership v3, or return the receiver's rejection.
pub fn ownership(bytes: &[u8]) -> Result<Vec<Owned>, Rejection> {
    let root = upload::object(strict_json::decode(bytes))?;
    match root.get("schemaVersion") {
        None => return Err(Rejection::Invalid),
        Some(version) if version != 3 => return Err(Rejection::UnsupportedVersion),
        Some(_) => {}
    }
    let files = upload::field(&root, "files")
        .as_array()
        .ok_or(Rejection::Invalid)?;
    let mut names = BTreeSet::from([MARKER.to_owned()]);
    files.iter().map(|item| owned(item, &mut names)).collect()
}

fn owned(item: &Value, names: &mut BTreeSet<String>) -> Result<Owned, Rejection> {
    let item = item.as_object().ok_or(Rejection::Invalid)?;
    let (Some(path), Some(sha256), Some(size)) = (
        item.get("path").and_then(Value::as_str),
        item.get("sha256").and_then(Value::as_str),
        item.get("size").and_then(Value::as_f64),
    ) else {
        return Err(Rejection::Invalid);
    };
    let integer = size.fract() == 0.0;
    if path.len() > 1024 || (integer && size > MAX_FILE as f64) {
        return Err(Rejection::TooLarge);
    }
    if !integer || size < 0.0 || !upload::portable(path) || !SHA256.is_match(sha256) {
        return Err(Rejection::Invalid);
    }
    let folded = path.to_lowercase();
    if names.iter().any(|name| {
        *name == folded
            || name.starts_with(&format!("{folded}/"))
            || folded.starts_with(&format!("{name}/"))
    }) {
        return Err(Rejection::Invalid);
    }
    names.insert(folded);
    Ok(Owned {
        path: path.to_owned(),
        sha256: sha256.to_owned(),
        size: size as u64,
    })
}

/// Check a complete upload inventory with the receiver's rules.
pub fn verify(entries: &BTreeMap<String, Vec<u8>>) -> Result<Vec<Owned>, Rejection> {
    if entries.len() > 20_000
        || entries
            .iter()
            .any(|(name, bytes)| name.len() > 1024 || bytes.len() as u64 > MAX_FILE)
    {
        return Err(Rejection::TooLarge);
    }
    let marker = entries.get(MARKER).ok_or(Rejection::Invalid)?;
    let owned = ownership(marker)?;
    let required = ["index.html", "404.html", "mokly-upload.json"];
    if entries.len() != owned.len() + 1 || !required.iter().all(|file| entries.contains_key(*file))
    {
        return Err(Rejection::Invalid);
    }
    for entry in &owned {
        let bytes = entries.get(&entry.path).ok_or(Rejection::Invalid)?;
        if bytes.len() as u64 != entry.size || digest(bytes) != entry.sha256 {
            return Err(Rejection::Invalid);
        }
    }
    let metadata = upload::metadata(&entries["mokly-upload.json"])?;
    if metadata["comparisonPath"].is_null()
        && entries
            .keys()
            .any(|name| name.starts_with("mokly-viewer/diffs/"))
    {
        return Err(Rejection::Invalid);
    }
    Ok(owned)
}

#[cfg(test)]
#[path = "_tests_/inventory_tests.rs"]
mod inventory_tests;
