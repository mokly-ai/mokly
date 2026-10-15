//! Render diagnostics stay separate from public failure response bodies.

use crate::error::ServerError;

/// CLI-owned typed error reporting boundary.
#[cfg_attr(test, unimock::unimock(api = DiagnosticsMock))]
pub trait Diagnostics: Send + Sync {
    /// Report a render failure once through the command's reporter.
    fn failed(&self, error: &ServerError);
}

/// Library consumers can route diagnostics through their tracing subscriber.
pub struct TracingDiagnostics;
impl Diagnostics for TracingDiagnostics {
    fn failed(&self, error: &ServerError) {
        tracing::error!(%error, "catalogue render failed");
    }
}
