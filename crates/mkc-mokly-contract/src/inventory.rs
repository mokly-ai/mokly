//! Public export ownership v3: every owned file with its declared content identity.

use serde::Deserialize;
use serde_json::Number;
use serde_json::value::RawValue;

use crate::error::{ArtifactKind, Error, Limit, Rejection, Result, invalid};
use crate::json::{self, SchemaVersion};
use crate::limits::Limits;
use crate::paths::{self, Namespace};

/// The marker path, owned by the export and never listed in its own inventory.
pub const MARKER_PATH: &str = ".mokly-export-artifact";

/// One owned regular file and the identity a receiver verifies before storing it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InventoryFile {
    /// Safe export-relative path.
    pub path: String,
    /// Lowercase hexadecimal SHA-256 of the exact file bytes.
    pub sha256: String,
    /// Exact byte length.
    pub size: u64,
}

/// Complete owned regular-file inventory, excluding the marker itself.
#[derive(Clone, Debug)]
pub struct Inventory {
    /// Every owned file; order is insignificant to readers.
    pub files: Vec<InventoryFile>,
}

#[derive(Deserialize)]
struct Document<'a> {
    #[serde(borrow)]
    files: Vec<&'a RawValue>,
}

#[derive(Deserialize)]
struct RawFile {
    path: String,
    sha256: String,
    size: Number,
}

enum Size {
    Integer(u64),
    TooLarge,
    Negative,
    Malformed,
}

impl Inventory {
    /// Decode and validate a schema 3 marker in the released classification order.
    ///
    /// A present version other than the number 3 is unsupported before any entry
    /// is read. Each entry checks primitive/integer types, its limits and then
    /// grammar in source order. Namespace collisions are checked after all entries.
    pub fn parse(bytes: &[u8], limits: Limits) -> Result<Self> {
        limits.check_file(bytes.len() as u64, Some(ArtifactKind::Inventory))?;
        match json::schema_version(bytes, 3)? {
            SchemaVersion::Missing => return Err(invalid(Rejection::Inventory)),
            SchemaVersion::Unsupported(version) => {
                return Err(Error::UnsupportedVersion {
                    artifact: ArtifactKind::Inventory,
                    version,
                });
            }
            SchemaVersion::Supported => {}
        }
        let document: Document = json::decode(bytes)?;
        if document.files.len() >= limits.files() {
            return Err(Error::TooLarge {
                limit: Limit::FileCount,
            });
        }
        let mut files = Vec::with_capacity(document.files.len());
        for raw in document.files {
            let file: RawFile = json::decode(raw.get().as_bytes())?;
            let size = classify(&file.size);
            if matches!(size, Size::Malformed) {
                return Err(invalid(Rejection::Inventory));
            }
            if file.path.len() > limits.path() {
                return Err(Error::TooLarge { limit: Limit::Path });
            }
            if file.path.split('/').count() > limits.path_segments() {
                return Err(Error::TooLarge {
                    limit: Limit::PathSegments,
                });
            }
            if matches!(size, Size::TooLarge)
                || matches!(size, Size::Integer(value) if value > limits.file())
            {
                return Err(Error::TooLarge { limit: Limit::File });
            }
            let Size::Integer(size) = size else {
                return Err(invalid(Rejection::Inventory));
            };
            if file.path == MARKER_PATH || !is_digest(&file.sha256) {
                return Err(invalid(Rejection::Inventory));
            }
            paths::validate(&file.path, limits)?;
            files.push(InventoryFile {
                path: file.path,
                sha256: file.sha256,
                size,
            });
        }
        let mut namespace = Namespace::new(limits);
        namespace.insert(MARKER_PATH, false)?;
        for file in &files {
            namespace.insert(&file.path, false)?;
        }
        Ok(Self { files })
    }

    /// Declared entry for an exact path, if owned.
    pub fn entry(&self, path: &str) -> Option<&InventoryFile> {
        self.files.iter().find(|file| file.path == path)
    }
}

fn classify(number: &Number) -> Size {
    if let Some(value) = number.as_u64() {
        return Size::Integer(value);
    }
    if number.as_i64().is_some() {
        return Size::Negative;
    }
    match number.as_f64() {
        Some(value) if value.is_finite() && value.fract() == 0.0 => {
            if value < 0.0 {
                Size::Negative
            } else if value >= u64::MAX as f64 {
                Size::TooLarge
            } else {
                Size::Integer(value as u64)
            }
        }
        _ => Size::Malformed,
    }
}

pub(crate) fn is_digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

#[cfg(test)]
#[path = "_tests_/inventory_tests.rs"]
mod inventory_tests;
