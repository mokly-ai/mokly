//! Request execution, retries, recycling, and release publication.

use crate::error::{Error, FailureKind, ProtocolError, Result};
use crate::methods::Call;
use crate::pool::{Pool, SidecarPool};
use crate::pool_releases::Release;
use crate::wire::MethodResult;

impl SidecarPool for Pool {
    fn release_generation(&self, generation: &str, epoch: u64) {
        self.enqueue_release(Release::Generation {
            id: generation.into(),
            epoch,
        });
    }
    fn release_context(&self, context: &str) {
        self.enqueue_release(Release::Context(context.into()));
    }
    fn cancel_requests(&self) -> Result<()> {
        self.cancel_busy()
    }

    fn request(&self, call: Call) -> Result<MethodResult> {
        if matches!(call, Call::Shutdown(_)) {
            self.shutdown()?;
            return Ok(MethodResult::Empty);
        }
        if matches!(call, Call::Hello(_)) {
            return Err(Error::Protocol(ProtocolError::Handshake));
        }
        let (index, mut slot) = self.acquire(&call)?;
        let deadline = self.options.timeout_ms.unwrap_or_else(|| call.timeout_ms());
        let mut outcome = Err(Error::Crashed);
        for attempt in 0..2 {
            if self.lock()?.stopped {
                outcome = Err(Error::Cancelled);
                break;
            }
            let mut current = match slot.take() {
                Some(slot) => slot,
                None => match self.spawn(index) {
                    Ok(slot) => slot,
                    Err(error) => {
                        let retryable = matches!(error, Error::Crashed | Error::Timeout { .. });
                        outcome = Err(error);
                        if retryable && attempt == 0 {
                            continue;
                        }
                        break;
                    }
                },
            };
            outcome = self.execute(&mut current, &call, deadline);
            let retryable = matches!(&outcome, Err(Error::Crashed | Error::Timeout { .. }));
            let reusable = outcome.is_ok()
                || matches!(
                    &outcome,
                    Err(Error::UnknownGeneration { .. } | Error::GenerationChanged { .. })
                )
                || matches!(&outcome, Err(Error::Remote { code, .. }) if code.reusable())
                || matches!(&outcome, Err(Error::Postcss { .. }));
            if !reusable {
                let killed = current.control.kill();
                if let Err(error) = killed {
                    outcome = Err(error);
                    break;
                }
                if retryable && attempt == 0 {
                    continue;
                }
            } else {
                slot = Some(current);
            }
            break;
        }
        if let Some(current) = slot.as_ref() {
            let memory = current.worker.resident_bytes();
            if current.renders >= 500 || matches!(memory, Ok(bytes) if bytes > 1024 * 1024 * 1024) {
                let drained = current.control.shutdown().and_then(|()| {
                    current
                        .control
                        .finish(self.clock.now_ms().saturating_add(2_000))
                });
                if let Err(error) = drained {
                    tracing::warn!(%error, "sidecar recycle shutdown failed");
                    if let Err(error) = current.control.kill() {
                        tracing::warn!(%error, "sidecar recycle kill failed");
                    }
                }
                slot = None;
            }
        }
        let cancelled = self.lock()?.stopped;
        self.release(index, slot)?;
        if matches!(outcome, Err(Error::Crashed)) {
            let kind = FailureKind::for_call(&call);
            outcome = Err(Error::RequestCrashed {
                kind,
                call: Box::new(call.clone()),
            });
        }
        if let Err(Error::Timeout { deadline_ms }) = outcome {
            outcome = Err(Error::RequestTimeout {
                call: Box::new(call),
                deadline_ms,
            });
        }
        if cancelled {
            Err(Error::Cancelled)
        } else {
            outcome
        }
    }

    fn shutdown(&self) -> Result<()> {
        self.stop(false)
    }
    fn abort(&self) -> Result<()> {
        self.stop(true)
    }
}
