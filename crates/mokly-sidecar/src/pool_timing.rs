//! Closed retirement causes join stop and replacement diagnostics without retaining spans.

use tracing::Span;

use crate::error::Result;
use crate::workers::WorkerControl;

#[derive(Clone, Copy)]
pub(super) enum Reason {
    Recycle,
    Replacement,
    Retry,
    RootSwitch,
}

impl Reason {
    fn label(self) -> &'static str {
        match self {
            Self::Recycle => "recycle",
            Self::Replacement => "replacement",
            Self::Retry => "retry",
            Self::RootSwitch => "root-switch",
        }
    }

    pub(super) fn replacement(self) -> Span {
        tracing::info_span!("sidecar.recycle", reason = self.label(), status = "error")
    }

    pub(super) fn stop(self) -> Span {
        tracing::info_span!("sidecar.stop", reason = self.label(), status = "error")
    }

    pub(super) fn kill(self, control: &dyn WorkerControl) -> Result<()> {
        let span = self.stop();
        let _scope = span.enter();
        control.kill()?;
        span.record("status", "ok");
        Ok(())
    }
}
