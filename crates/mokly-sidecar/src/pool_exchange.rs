//! Request execution, retries, recycling, and release publication.

use crate::error::{Error, FailureKind, ProtocolError, Result};
use crate::methods::Call;
use crate::pool::{Pool, SidecarPool};
use crate::pool_releases::Release;
use crate::pool_timing::Reason;
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
        let source_root = self.source_root(&call)?;
        let (index, mut slot) = self.acquire(&call, source_root.as_deref())?;
        if let Err(error) = self.isolate(index, &mut slot, source_root.as_deref()) {
            self.release(index, slot)?;
            return Err(error);
        }
        let deadline = self.options.timeout_ms.unwrap_or_else(|| call.timeout_ms());
        let mut outcome = Err(Error::Crashed);
        for attempt in 0..2 {
            if self.lock()?.stopped {
                outcome = Err(Error::Cancelled);
                break;
            }
            let mut current = match slot.take() {
                Some(slot) => slot,
                None => match self.spawn(
                    index,
                    source_root.as_deref().unwrap_or(&self.launch.repository),
                ) {
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
                let stopped = {
                    let mut state = self.lock()?;
                    state.replacement_reasons.insert(index, Reason::Replacement);
                    state.stopped
                };
                let killed = if stopped {
                    current.control.kill()
                } else {
                    Reason::Replacement.kill(current.control.as_ref())
                };
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
        self.recycle(index, &mut slot)?;
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
