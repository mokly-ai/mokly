//! Per-view ownership of prepared-root completion and admitted fragment bytes.

use std::fmt;
use std::sync::Arc;

use crate::cache::Artifact;
use crate::error::Result;

/// One ordinary worker lookup, completed in place or deferred after its real miss.
#[derive(Debug)]
pub enum BackgroundRead {
    /// The worker restored and validated the complete document.
    Complete(Arc<Artifact>),
    /// Only the captured recipe metadata crosses into batch admission.
    Miss(Box<dyn BackgroundMiss>),
}

/// Single-use continuation after one counted cache read and persistent outcome.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BackgroundMissMock))]
pub trait BackgroundMiss: Send + Sync {
    /// Whether immutable route metadata permits an owned root handoff.
    fn root_eligible(&self) -> bool;
    /// Compose the captured miss without another lookup or identity sample.
    fn complete(self: Box<Self>, completion: Option<Arc<dyn Completion>>) -> Result<Arc<Artifact>>;
}

impl fmt::Debug for dyn BackgroundMiss + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("BackgroundMiss")
    }
}

/// An ordinary document lookup scheduled on an existing render worker.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BackgroundWorkerMock))]
pub trait BackgroundWorker: Send + Sync {
    /// Finish a hit on this worker or return only the miss continuation.
    fn read(&self, route: &str) -> Result<BackgroundRead>;
}

impl fmt::Debug for dyn BackgroundWorker + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("BackgroundWorker")
    }
}

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
