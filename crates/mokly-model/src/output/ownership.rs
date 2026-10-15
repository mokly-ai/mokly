//! Ownership schema 3 validation, including portable path collisions.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::output::error::{FormatError, Result};
use crate::output::json::unique;
use crate::output::validation::{FILE_LIMIT, MARKER, hexadecimal, portable_path};
use crate::versions::EXPORT_OWNERSHIP;

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
    pub schema_version: u32,
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
            return Err(FormatError::TooLarge);
        }
        let value = unique(bytes)?;
        let Some(version) = value
            .as_object()
            .and_then(|object| object.get("schemaVersion"))
        else {
            return Err(FormatError::InvalidBundle);
        };
        if version.as_f64() != Some(f64::from(EXPORT_OWNERSHIP)) {
            return Err(FormatError::UnsupportedVersion);
        }
        let Ok(raw) = serde_json::from_value::<RawOwnership>(value) else {
            return Err(FormatError::InvalidBundle);
        };
        let mut files = Vec::with_capacity(raw.files.len());
        let mut paths = BTreeSet::from([MARKER.to_owned()]);
        for entry in raw.files {
            if !entry.size.is_finite() || entry.size < 0.0 || entry.size.fract() != 0.0 {
                return Err(FormatError::InvalidBundle);
            }
            if entry.size > FILE_LIMIT as f64 || entry.path.len() > 1024 {
                return Err(FormatError::TooLarge);
            }
            portable_path(&entry.path)?;
            if !hexadecimal(&entry.sha256, &[64]) || !paths.insert(entry.path.to_lowercase()) {
                return Err(FormatError::InvalidBundle);
            }
            let size = entry.size as u64;
            files.push(Entry {
                path: entry.path,
                sha256: entry.sha256,
                size,
            });
        }
        for path in &paths {
            for (index, _) in path.match_indices('/') {
                if paths.contains(&path[..index]) {
                    return Err(FormatError::InvalidBundle);
                }
            }
        }
        Ok(Self {
            schema_version: EXPORT_OWNERSHIP,
            files,
        })
    }
}
