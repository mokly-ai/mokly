//! Validated content identities and immutable storage incarnations.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use uuid::Uuid;

/// Lowercase SHA-256 identity, independent of a file's name or MIME type.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct BlobHash(String);

/// Invalid content identity.
#[derive(Debug, Error)]
pub enum Error {
    /// Digests require exactly 64 lowercase hexadecimal characters.
    #[error("[mkc-domain/blob] invalid SHA-256 digest")]
    InvalidHash,
}

impl BlobHash {
    /// Compute the identity of exact unmodified bytes.
    pub fn digest(bytes: &[u8]) -> Self {
        Self(
            Sha256::digest(bytes)
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect(),
        )
    }

    /// Borrow the validated hexadecimal representation.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl FromStr for BlobHash {
    type Err = Error;

    fn from_str(value: &str) -> Result<Self, Error> {
        if value.len() != 64
            || !value
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(Error::InvalidHash);
        }
        Ok(Self(value.to_owned()))
    }
}

impl TryFrom<String> for BlobHash {
    type Error = Error;

    fn try_from(value: String) -> Result<Self, Error> {
        value.parse()
    }
}

impl From<BlobHash> for String {
    fn from(value: BlobHash) -> Self {
        value.0
    }
}

impl fmt::Display for BlobHash {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(formatter)
    }
}

/// A content identity plus a fence separating independent object lifetimes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlobKey {
    /// Identity shared by all concurrent publication references.
    pub hash: BlobHash,
    /// New UUID whenever a collected hash is stored again.
    pub incarnation: Uuid,
}

impl BlobKey {
    /// Canonical private object name used by every file-store adapter.
    pub fn object_name(&self) -> String {
        format!("sha256/{}/{}", self.hash, self.incarnation)
    }

    /// Recognize only exact canonical object names during orphan collection.
    pub fn from_object_name(name: &str) -> Option<Self> {
        let (hash, incarnation) = name.strip_prefix("sha256/")?.split_once('/')?;
        let key = Self {
            hash: hash.parse().ok()?,
            incarnation: incarnation.parse().ok()?,
        };
        (key.object_name() == name).then_some(key)
    }
}
