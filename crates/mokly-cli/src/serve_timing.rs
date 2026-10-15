//! Readiness measures command setup and closes its span before background work.

use std::time::{Duration, Instant};

use tracing::span::EnteredSpan;

pub(super) struct ServeTiming {
    started: Instant,
    span: Option<EnteredSpan>,
}
impl ServeTiming {
    pub(super) fn new() -> Self {
        Self {
            started: Instant::now(),
            span: Some(tracing::info_span!("serve.ready", status = "error").entered()),
        }
    }
    pub(super) fn elapsed(&self) -> Duration {
        self.started.elapsed()
    }
    pub(super) fn ready(&mut self) {
        if let Some(span) = self.span.take() {
            span.record("status", "ok");
        }
    }
}
