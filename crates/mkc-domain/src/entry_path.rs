//! Validated entry-path values for API selection and screen-observation boundaries.

use std::fmt;
use std::result;
use std::str::FromStr;

use serde::{Deserialize, Deserializer, Serialize};
use thiserror::Error;
#[cfg(feature = "openapi")]
use utoipa::ToSchema;

/// Authored-case entry path with portable segments and no generated-root prefix.
///
/// Callers apply their own byte and segment quotas after this grammar check.
pub fn entry_path(value: &str) -> bool {
    !value
        .split('/')
        .next()
        .is_some_and(|part| part.eq_ignore_ascii_case("mokly-generated"))
        && value.split('/').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
                && !device_name(part)
        })
}

fn device_name(value: &str) -> bool {
    let value = value.to_ascii_lowercase();
    matches!(value.as_str(), "aux" | "con" | "nul" | "prn")
        || ["com", "lpt"].iter().any(|prefix| {
            value.strip_prefix(prefix).is_some_and(|digit| {
                matches!(digit, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
            })
        })
}

/// Maximum UTF-8 byte length for a cloud screen selection.
pub const MAX_ENTRY_PATH_BYTES: usize = 2048;

/// A path outside the cloud selection grammar or byte limit.
#[derive(Clone, Copy, Debug, Error, PartialEq, Eq)]
pub enum Error {
    /// The path cannot be selected in a cloud URL.
    #[error("[mkc-domain/entry_path] invalid entry path")]
    Invalid,
}

/// Entry-path validation result.
pub type Result<T> = result::Result<T, Error>;

/// Authored-case entry path validated with the released grammar and cloud limit.
///
/// The private field prevents unchecked values at a typed boundary.
///
/// ```compile_fail
/// use mkc_domain::entry_path::EntryPath;
/// let unchecked = EntryPath("a//b".to_owned());
/// ```
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
#[serde(transparent)]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
#[cfg_attr(
    feature = "openapi",
    schema(
        description = "An entry path with portable segments. Server checks also exclude Windows device names and a first segment of mokly-generated.",
        min_length = 1,
        max_length = 2048,
        pattern = "^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*$"
    )
)]
pub struct EntryPath(String);

impl EntryPath {
    /// Whether the input meets the released grammar and cloud selection limit.
    pub fn is_valid(value: &str) -> bool {
        value.len() <= MAX_ENTRY_PATH_BYTES && entry_path(value)
    }

    /// Read the validated path without changing authored case.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Consume the validated value at a string storage or wire boundary.
    pub fn into_string(self) -> String {
        self.0
    }
}

impl FromStr for EntryPath {
    type Err = Error;

    fn from_str(value: &str) -> Result<Self> {
        if Self::is_valid(value) {
            Ok(Self(value.to_owned()))
        } else {
            Err(Error::Invalid)
        }
    }
}

impl TryFrom<String> for EntryPath {
    type Error = Error;

    fn try_from(value: String) -> Result<Self> {
        if Self::is_valid(&value) {
            Ok(Self(value))
        } else {
            Err(Error::Invalid)
        }
    }
}

impl fmt::Display for EntryPath {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for EntryPath {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> result::Result<Self, D::Error> {
        match Self::try_from(String::deserialize(deserializer)?) {
            Ok(path) => Ok(path),
            Err(error) => Err(serde::de::Error::custom(error)),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/entry_path_tests.rs"]
mod entry_path_tests;
