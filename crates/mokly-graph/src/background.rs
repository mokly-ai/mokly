//! Per-view ownership of prepared-root completion and admitted fragment bytes.

use std::fmt;

/// A prepared background root's completion place and optional dispatch release.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CompletionMock))]
pub trait Completion: Send + Sync {
    /// Enter completion and release dispatch after a successful charged root.
    fn handoff(&self, bytes: usize);
    /// Retained scheduler and queue metadata that the root charge must include.
    fn metadata_bytes(&self) -> usize;
}

impl fmt::Debug for dyn Completion + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Completion")
    }
}

#[cfg(test)]
#[path = "_tests_/background_defaults_tests.rs"]
mod background_defaults_tests;
