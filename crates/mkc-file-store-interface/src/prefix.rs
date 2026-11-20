//! Validated physical object namespaces shared by configuration and adapters.

use std::str::FromStr;

use thiserror::Error;

/// One namespace segment: 1–63 lowercase ASCII letters, digits or hyphens.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ObjectPrefix(String);

/// Object namespace validation failures.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum Error {
    /// The value is empty, too long or contains a disallowed character.
    #[error("[mkc-file-store-interface/prefix] invalid object prefix")]
    Invalid,
}

impl ObjectPrefix {
    /// Borrow the exact validated segment without a trailing slash.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl FromStr for ObjectPrefix {
    type Err = Error;

    fn from_str(value: &str) -> Result<Self, Error> {
        if !(1..=63).contains(&value.len())
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        {
            return Err(Error::Invalid);
        }
        Ok(Self(value.to_owned()))
    }
}

#[cfg(test)]
#[path = "_tests_/prefix_tests.rs"]
mod tests;
