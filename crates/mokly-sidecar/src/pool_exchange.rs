//! Request execution, retries, recycling, and release publication.

use std::sync::Weak;

use crate::early_lease::{EarlyLease, EarlyRetry};
use crate::error::{Error, FailureKind, Result};
use crate::methods::Call;
use crate::pool::{Pool, ReturnWake, SidecarPool};
use crate::pool_bundle_cache::BundleAttempt;
use crate::pool_releases::Release;
use crate::pool_state::Slot;
use crate::pool_timing::Reason;
use crate::wire::MethodResult;

impl SidecarPool for Pool {
    fn served_generation(&self, generation: &str, epoch: u64) {
        self.served(generation, epoch);
    }
    fn try_early(&self, call: &Call) -> Result<Option<Box<dyn EarlyLease>>> {
        self.claim_early(call)
    }
    fn observe_available(&self, wake: Weak<dyn ReturnWake>) {
        self.observe_capacity(wake);
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
        self.request_attempts(call, 2, BundleAttempt::default())
    }
    fn retry(&self, call: Call, failure: EarlyRetry) -> Result<MethodResult> {
        if let Call::ProcessCss(params) = &call {
            let state = self.lock();
            if state
                .affinity
                .get(&params.context)
                .is_some_and(|affinity| state.retired.contains(&affinity.index))
            {
                return Err(failure.failure);
            }
        }
        self.request_attempts(call, 1, failure.bundle)
    }

    fn shutdown(&self) -> Result<()> {
        self.stop(false)
    }
    fn abort(&self) -> Result<()> {
        self.stop(true)
    }
}

pub(super) struct Exchange {
    pub(super) result: Result<MethodResult>,
    pub(super) retry: bool,
}

impl Pool {
    fn request_attempts(
        &self,
        call: Call,
        attempts: usize,
        mut bundle_attempt: BundleAttempt,
    ) -> Result<MethodResult> {
        if matches!(call, Call::Shutdown(_)) {
            self.shutdown()?;
            return Ok(MethodResult::Empty);
        }
        let source_root = self.source_root(&call);
        let (index, mut slot) = self.acquire(&call, source_root.as_deref())?;
        let exchanged = self.exchange(
            index,
            &mut slot,
            &call,
            false,
            attempts,
            &mut bundle_attempt,
        );
        self.release(index, slot);
        exchanged.result
    }

    pub(super) fn exchange(
        &self,
        index: usize,
        slot: &mut Option<Slot>,
        call: &Call,
        early: bool,
        attempts: usize,
        bundle_attempt: &mut BundleAttempt,
    ) -> Exchange {
        let source_root = self.source_root(call);
        if !early && let Err(error) = self.isolate(index, slot, source_root.as_deref()) {
            return Exchange {
                result: Err(error),
                retry: false,
            };
        }
        let deadline = self.options.timeout_ms.unwrap_or_else(|| call.timeout_ms());
        let mut outcome = Err(Error::Crashed);
        let mut retry = false;
        for attempt in 0..attempts {
            if self.lock().stopped {
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
                        if retryable && attempt + 1 < attempts {
                            if self.lock().retired.contains(&index) {
                                retry = early;
                            } else {
                                continue;
                            }
                        }
                        break;
                    }
                },
            };
            outcome = self.execute(&mut current, call, deadline, bundle_attempt);
            if let Ok(result) = &outcome {
                self.record_head(index, call, result);
            }
            let retryable = matches!(&outcome, Err(Error::Crashed | Error::Timeout { .. }));
            let reusable = outcome.is_ok()
                || matches!(&outcome, Err(Error::Remote { code, .. }) if code.reusable())
                || matches!(&outcome, Err(Error::Postcss { .. }));
            if !reusable {
                let stopped = {
                    let mut state = self.lock();
                    state.replacement_reasons.insert(index, Reason::Replacement);
                    state.stopped
                };
                if early && !self.reap_early(index, &current) {
                    retry = retryable && attempt + 1 < attempts;
                    break;
                }
                let killed = if early {
                    Ok(())
                } else if stopped {
                    current.control.kill()
                } else {
                    Reason::Replacement.kill(current.control.as_ref())
                };
                if let Err(error) = killed {
                    outcome = Err(error);
                    break;
                }
                if retryable && attempt + 1 < attempts {
                    continue;
                }
            } else {
                *slot = Some(current);
            }
            break;
        }
        if let Err(error) = self.recycle(index, slot) {
            outcome = Err(error);
        }
        let cancelled = self.lock().stopped;
        if matches!(outcome, Err(Error::Crashed)) {
            let kind = FailureKind::for_call(call);
            outcome = Err(Error::RequestCrashed {
                kind,
                call: Box::new(call.clone()),
            });
        }
        if let Err(Error::Timeout { deadline_ms, phase }) = outcome {
            outcome = Err(Error::RequestTimeout {
                call: Box::new(call.clone()),
                deadline_ms,
                phase,
            });
        }
        Exchange {
            result: if cancelled {
                Err(Error::Cancelled)
            } else {
                outcome
            },
            retry,
        }
    }
}
