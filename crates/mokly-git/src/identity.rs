//! Stable Git object and repository-relative path identities.

use std::fmt;

use crate::error::{Error, Result};

/// A full SHA-1 or SHA-256 Git object id, safe in arguments and stdin.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct ObjectId(String);

impl ObjectId {
    /// Validate a complete hexadecimal object id.
    pub fn parse(value: &str) -> Result<Self> {
        if !matches!(value.len(), 40 | 64) || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(Error::InvalidObjectId);
        }
        Ok(Self(value.to_ascii_lowercase()))
    }

    /// Full lowercase object id.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for ObjectId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

/// A lexical POSIX path confined to a Git repository, with case preserved.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct RepoPath(String);

impl RepoPath {
    /// Reject absolute POSIX paths, traversal, empty segments and NUL.
    pub fn parse(value: &str) -> Result<Self> {
        if value.is_empty()
            || value.contains('\0')
            || value
                .split('/')
                .any(|part| part.is_empty() || matches!(part, "." | ".."))
        {
            return Err(Error::InvalidPath {
                path: value.to_owned(),
            });
        }
        Ok(Self(value.to_owned()))
    }

    /// Exact repository-relative spelling, without case folding.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Whether this path lies in a root, including a file root itself.
    pub fn under(&self, root: &Self) -> bool {
        self == root
            || self
                .0
                .strip_prefix(&root.0)
                .is_some_and(|rest| rest.starts_with('/'))
    }
}

impl fmt::Display for RepoPath {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}
