//! Validated Git object identities and typed pushed-base lookup results.

use std::fmt;

use crate::remote::error::{Error, Result};

/// A full lowercase SHA-1 object name read from Git output.
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub(crate) struct CommitSha(String);

impl CommitSha {
    /// Validate a single full Git object identity before using it in requests.
    pub(crate) fn read(output: &str) -> Result<Self> {
        let value = output.trim();
        if value.len() != 40
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return Err(Error::InvalidGitSha);
        }
        Ok(Self(value.to_owned()))
    }

    /// Borrow the validated object name for a separate process argument.
    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for CommitSha {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(formatter)
    }
}

/// A pushed ancestor together with its distance from checkout HEAD.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct BaseCommit {
    /// Validated pushed object identity.
    pub(crate) sha: CommitSha,
    /// Number of commits reachable from HEAD but not this base.
    pub(crate) ahead: u64,
}

/// The complete result of searching local origin history.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum BaseLookup {
    /// At least one origin ref shares history with HEAD.
    Found(BaseCommit),
    /// No local origin ref shares history with HEAD.
    NoBase,
}
