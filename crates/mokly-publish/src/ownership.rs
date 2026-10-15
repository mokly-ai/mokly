//! Ownership schema 3 validation, including portable path collisions.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::json::unique;
use crate::validation::{FILE_COUNT_LIMIT, FILE_LIMIT, MARKER, hexadecimal, portable_path};

/// A regular file's finalized content address.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct Entry {
    /// Portable root-relative file path.
    pub path: String,
    /// Lowercase SHA-256 of the exact final bytes.
    pub sha256: String,
    /// Exact byte length.
    pub size: u64,
}

/// Validated public inventory. Its marker is deliberately absent from entries.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ownership {
    /// Independent ownership format version, always 3.
    pub schema_version: u8,
    /// Every regular file other than the marker.
    pub files: Vec<Entry>,
}

#[derive(Deserialize)]
struct RawOwnership {
    files: Vec<RawEntry>,
}

#[derive(Deserialize)]
struct RawEntry {
    path: String,
    sha256: String,
    size: f64,
}

impl Ownership {
    /// Decode a bounded marker. Version classification precedes entry shape.
    pub fn parse(bytes: &[u8]) -> Result<Self> {
        if bytes.len() > FILE_LIMIT {
            return Err(Error::TooLarge);
        }
        let value = unique(bytes)?;
        let Some(version) = value
            .as_object()
            .and_then(|object| object.get("schemaVersion"))
        else {
            return Err(Error::InvalidBundle);
        };
        if version.as_f64() != Some(3.0) {
            return Err(Error::UnsupportedVersion);
        }
        let Ok(raw) = serde_json::from_value::<RawOwnership>(value) else {
            return Err(Error::InvalidBundle);
        };
        if raw.files.len() >= FILE_COUNT_LIMIT {
            return Err(Error::TooLarge);
        }
        let mut files = Vec::with_capacity(raw.files.len());
        let mut paths = BTreeSet::from([MARKER.to_owned()]);
        let mut sizes = BTreeMap::new();
        for entry in raw.files {
            if !entry.size.is_finite() || entry.size < 0.0 || entry.size.fract() != 0.0 {
                return Err(Error::InvalidBundle);
            }
            if entry.size > FILE_LIMIT as f64 || entry.path.len() > 1024 {
                return Err(Error::TooLarge);
            }
            portable_path(&entry.path)?;
            if !hexadecimal(&entry.sha256, &[64]) || !paths.insert(entry.path.to_lowercase()) {
                return Err(Error::InvalidBundle);
            }
            let size = entry.size as u64;
            if sizes
                .insert(entry.sha256.clone(), size)
                .is_some_and(|old| old != size)
            {
                return Err(Error::InvalidBundle);
            }
            files.push(Entry {
                path: entry.path,
                sha256: entry.sha256,
                size,
            });
        }
        for path in &paths {
            for (index, _) in path.match_indices('/') {
                if paths.contains(&path[..index]) {
                    return Err(Error::InvalidBundle);
                }
            }
        }
        Ok(Self {
            schema_version: 3,
            files,
        })
    }
}
