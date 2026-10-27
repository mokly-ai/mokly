//! The pure parts of the fingerprint: the value format, the Git path
//! listing, and the record hash.

use std::collections::BTreeSet;
use std::fmt;

use sha2::{Digest, Sha256};

use super::error::{Error, Result};

/// The algorithm prefix of every fingerprint.
const PREFIX: &str = "sha256:";

/// A fingerprint with the exact format: `sha256:` and 64 lowercase hex
/// digits.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct SourceFingerprint(String);

impl SourceFingerprint {
    /// Accept exactly `sha256:` followed by 64 lowercase hex digits.
    pub(crate) fn parse(value: &str) -> Result<Self> {
        let valid = value
            .strip_prefix(PREFIX)
            .is_some_and(|digest| lowercase_hex(digest, 64));
        if valid {
            Ok(Self(value.to_owned()))
        } else {
            Err(Error::Format)
        }
    }
}

impl fmt::Display for SourceFingerprint {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

/// The Git mode of one record.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Mode {
    /// A regular file without an executable permission bit.
    Regular,
    /// A regular file with any executable permission bit.
    Executable,
    /// A symbolic link, hashed by its target bytes.
    Symlink,
}

impl Mode {
    /// The ASCII Git mode.
    fn code(self) -> &'static str {
        match self {
            Self::Regular => "100644",
            Self::Executable => "100755",
            Self::Symlink => "120000",
        }
    }
}

/// One path of the fingerprint with its mode and content digest.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct Record {
    /// The Git mode.
    pub(crate) mode: Mode,
    /// The raw repository-relative path bytes.
    pub(crate) path: Vec<u8>,
    /// The lowercase SHA-256 hex digest of the content.
    pub(crate) digest: String,
}

impl Record {
    /// A record whose digest is the SHA-256 of `contents`.
    pub(crate) fn new(mode: Mode, path: Vec<u8>, contents: &[u8]) -> Self {
        Self {
            mode,
            path,
            digest: hex(&Sha256::digest(contents)),
        }
    }
}

/// The NUL-delimited Git paths without duplicates, in unsigned byte order,
/// with their bytes unchanged.
pub(crate) fn source_paths(listing: &[u8]) -> Vec<Vec<u8>> {
    listing
        .split(|byte| *byte == 0)
        .filter(|name| !name.is_empty())
        .map(<[u8]>::to_vec)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

/// Hash the records in path byte order, each as the mode, NUL, the path,
/// NUL, the digest, and NUL.
pub(crate) fn fingerprint_records(records: &[Record]) -> SourceFingerprint {
    let mut sorted: Vec<&Record> = records.iter().collect();
    sorted.sort_by(|first, second| first.path.cmp(&second.path));
    let mut hash = Sha256::new();
    for record in sorted {
        hash.update(record.mode.code().as_bytes());
        hash.update([0]);
        hash.update(&record.path);
        hash.update([0]);
        hash.update(record.digest.as_bytes());
        hash.update([0]);
    }
    SourceFingerprint(format!("{PREFIX}{}", hex(&hash.finalize())))
}

/// Whether `value` holds exactly `length` lowercase hex digits.
pub(crate) fn lowercase_hex(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
#[path = "_tests_/records_tests.rs"]
mod records_tests;
