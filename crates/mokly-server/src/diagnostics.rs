//! Render diagnostics stay separate from public failure response bodies.

use std::io;

use crate::error::ServerError;

/// CLI-owned typed error reporting boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DiagnosticsMock))]
pub trait Diagnostics: Send + Sync {
    /// Report a render failure once through the command's reporter.
    fn failed(&self, error: &ServerError);
    /// Report the first resource failure of one accept backoff period.
    fn accept_failed(&self, error: &io::Error);
    /// Report successful acceptance after a backoff period.
    fn accept_recovered(&self);
}

/// Library consumers can route diagnostics through their tracing subscriber.
pub struct TracingDiagnostics;
impl Diagnostics for TracingDiagnostics {
    fn failed(&self, error: &ServerError) {
        tracing::error!(%error, "catalogue render failed");
    }
    fn accept_failed(&self, error: &io::Error) {
        tracing::warn!(%error, "listener cannot accept connections; retrying");
    }
    fn accept_recovered(&self) {
        tracing::info!("listener can accept connections again");
    }
}
