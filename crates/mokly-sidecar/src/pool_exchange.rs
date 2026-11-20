//! Request execution, retries, recycling, and release publication.

use std::path::Path;
use std::sync::Weak;

use crate::error::{Error, FailureKind, Result};
use crate::methods::Call;
use crate::pool::{Pool, ReturnWake, SidecarPool};
use crate::pool_bundle_cache::BundleAttempt;
use crate::pool_claim::CallClaim;
use crate::pool_releases::Release;
use crate::wire::MethodResult;

impl SidecarPool for Pool {
    fn record_served_render(&self, source_root: &Path, call: Call) {
        self.record_stored_render(source_root, call);
    }
    fn served_generation(&self, generation: &str, epoch: u64) {
        self.served(generation, epoch);
    }
    fn schedule_head_return(&self) {
        self.schedule_return();
    }
    fn maintain_head_return(&self) -> Result<bool> {
        self.maintain_return()
    }
    fn observe_head_return(&self, wake: Weak<dyn ReturnWake>) {
        self.observe_return(wake);
    }
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
        self.request_call(call, None)
    }

    fn request_claimed(&self, call: Call, claim: &CallClaim) -> Result<MethodResult> {
        self.request_call(call, Some(claim))
    }

    fn shutdown(&self) -> Result<()> {
        self.stop(false)
    }
    fn abort(&self) -> Result<()> {
        self.stop(true)
    }
}

impl Pool {
    fn request_call(&self, call: Call, claim: Option<&CallClaim>) -> Result<MethodResult> {
        if matches!(call, Call::Shutdown(_)) {
            self.shutdown()?;
            return Ok(MethodResult::Empty);
        }
        let source_root = self.source_root(&call);
        let claim = claim.and_then(|claim| claim.id(&self.state));
        let (index, mut slot, mut start) = self.acquire(&call, source_root.as_deref(), claim)?;
        if let Err(error) = self.isolate(index, &mut slot, source_root.as_deref()) {
            self.release(index, slot, start);
            return Err(error);
        }
        let deadline = self.options.timeout_ms.unwrap_or_else(|| call.timeout_ms());
        let mut outcome = Err(Error::Crashed);
        let mut bundle_attempt = BundleAttempt::default();
        for attempt in 0..2 {
            if self.lock().stopped {
                outcome = Err(Error::Cancelled);
                break;
            }
            let mut current = match slot.take() {
                Some(slot) => slot,
                None => match self.spawn(
                    index,
                    source_root.as_deref().unwrap_or(&self.launch.repository),
                    &mut start,
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
            outcome = self.execute(&mut current, &call, deadline, &mut bundle_attempt);
            if let Ok(result) = &outcome {
                self.record_head(index, &current, &call, result);
            }
            let retryable = matches!(&outcome, Err(Error::Crashed | Error::Timeout { .. }));
            if outcome.as_ref().is_err_and(|error| !reusable(error)) {
                if let Err(error) = self.replace(index, current.control.as_ref()) {
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
        self.recycle(index, &mut slot);
        let cancelled = self.lock().stopped;
        self.release(index, slot, start);
        if matches!(outcome, Err(Error::Crashed)) {
            let kind = FailureKind::for_call(&call);
            outcome = Err(Error::RequestCrashed {
                kind,
                call: Box::new(call.clone()),
            });
        }
        if let Err(Error::Timeout { deadline_ms, phase }) = outcome {
            outcome = Err(Error::RequestTimeout {
                call: Box::new(call),
                deadline_ms,
                phase,
            });
        }
        if cancelled {
            Err(Error::Cancelled)
        } else {
            outcome
        }
    }
}

/// A valid remote error reply or a PostCSS failure leaves the process usable.
pub(super) fn reusable(error: &Error) -> bool {
    matches!(error, Error::Remote { code, .. } if code.reusable())
        || matches!(error, Error::Postcss { .. })
}
