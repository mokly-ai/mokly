//! Typed run identities and deterministic JSON over validated fields.

use std::fmt;

use crate::remote::error::{Error, Result};
use crate::remote::git_identity::{BaseCommit, CommitSha};
use crate::remote::parse::fingerprint_value;

/// A run name that cannot escape a run-specific path or JSON string.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RunId(String);

impl RunId {
    /// Combine the injected UTC stamp and process ID after validating the stamp.
    pub(crate) fn new(stamp: &str, pid: u32) -> Result<Self> {
        let bytes = stamp.as_bytes();
        if bytes.len() != 16
            || bytes[8] != b'T'
            || bytes[15] != b'Z'
            || !bytes
                .iter()
                .enumerate()
                .all(|(index, byte)| matches!(index, 8 | 15) || byte.is_ascii_digit())
        {
            return Err(Error::InvalidRunId);
        }
        Ok(Self(format!("{stamp}-{pid}")))
    }

    /// Borrow the safe shared directory name.
    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for RunId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(formatter)
    }
}

/// Checkout and box evidence identities for one remote verification run.
#[derive(Clone, Debug)]
pub(crate) struct RunIdentity {
    /// Validated shared run name.
    run: RunId,
    /// Validated checkout HEAD.
    head: CommitSha,
    /// Validated pushed ancestor and ahead count.
    base: BaseCommit,
    /// Validated checkout content digest.
    fingerprint: String,
}

impl RunIdentity {
    /// Validate the fingerprint once before producing output or evidence bytes.
    pub(crate) fn new(
        run: RunId,
        head: CommitSha,
        base: BaseCommit,
        fingerprint: &str,
    ) -> Result<Self> {
        Ok(Self {
            run,
            head,
            base,
            fingerprint: fingerprint_value(fingerprint)?,
        })
    }

    /// Borrow the directory identity.
    pub(crate) fn run(&self) -> &RunId {
        &self.run
    }

    /// Borrow the checkout commit identity.
    pub(crate) fn head(&self) -> &CommitSha {
        &self.head
    }

    /// Borrow the box commit identity and checkout ahead count.
    pub(crate) fn base(&self) -> &BaseCommit {
        &self.base
    }

    /// Borrow the source identity used by every probe and suite.
    pub(crate) fn fingerprint(&self) -> &str {
        &self.fingerprint
    }

    /// Format the fixed five-field schema with exact indentation and final newline.
    pub(crate) fn json(&self) -> String {
        format!(
            "{{\n  \"run\": \"{}\",\n  \"head\": \"{}\",\n  \"base\": \"{}\",\n  \"ahead\": {},\n  \"fingerprint\": \"{}\"\n}}\n",
            self.run, self.head, self.base.sha, self.base.ahead, self.fingerprint
        )
    }
}

#[cfg(test)]
#[path = "_tests_/identity_tests.rs"]
mod identity_tests;
