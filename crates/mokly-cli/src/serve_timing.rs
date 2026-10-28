//! Readiness measures command setup and closes its span before background work.

use std::sync::Arc;
use std::time::{Duration, Instant};

use mokly_cli::codes::Code;
use mokly_cli::grammar::Common;
use mokly_cli::output::Style;
use mokly_cli::redaction::Redactor;
use mokly_graph::cache::RenderCache;
use mokly_server::entropy::Entropy;
use tracing::span::EnteredSpan;

use crate::serve_trace;
use crate::terminal::Terminal;

pub(super) struct ServeTiming {
    started: Instant,
    span: Option<EnteredSpan>,
}
impl ServeTiming {
    /// Install requested timings over the command's render cache, then open readiness.
    /// A timing layer that cannot start is reported, and Serve stops before any work.
    pub(super) fn start(
        common: &Common,
        style: &Style,
        redactor: &Arc<Redactor>,
        terminal: &Arc<dyn Terminal>,
        entropy: &dyn Entropy,
        cache: Arc<dyn RenderCache>,
    ) -> Option<Self> {
        if common.debug_timings
            && !serve_trace::install(terminal.clone(), entropy.secret(), redactor.clone(), cache)
        {
            terminal.stderr(&style.error(
                Code::ServerFailed,
                "Timing diagnostics could not start.",
                redactor,
            ));
            return None;
        }
        Some(Self {
            started: Instant::now(),
            span: Some(tracing::info_span!("serve.ready", status = "error").entered()),
        })
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
