//! An early preparation owns one strict non-warm slot until its process is reaped.

use std::sync::{Arc, Mutex, Weak};

use crate::early_lease::{EarlyCall, EarlyLease, EarlyRetry};
use crate::error::{Error, Result};
use crate::methods::Call;
use crate::pool::{Pool, ReturnWake};
use crate::pool_bundle_cache::BundleAttempt;
use crate::pool_state::{Affinity, Slot};
use crate::pool_timing::Reason;
use crate::workers::WorkerControl;

impl Pool {
    pub(super) fn claim_early(&self, call: &Call) -> Result<Option<Box<dyn EarlyLease>>> {
        let mut state = self.lock();
        if state.stopped {
            return Err(Error::Cancelled);
        }
        if self.options.size.get() == 1
            || state.head.return_disabled
            || state.early.is_some()
            || state.head.active.is_some()
            || state
                .waiting
                .values()
                .any(|waiting| waiting.root == self.launch.repository)
        {
            return Ok(None);
        }
        let protected = state
            .head
            .warm
            .as_ref()
            .filter(|warm| {
                state.source_roots.get(&warm.index) == Some(&self.launch.repository)
                    && state
                        .controls
                        .get(&warm.index)
                        .is_some_and(|control| warm.control.ptr_eq(&Arc::downgrade(control)))
            })
            .map(|warm| warm.index);
        let affinity = match call {
            Call::ProcessCss(params) => state
                .affinity
                .get(&params.context)
                .map(|affinity| affinity.index),
            _ => None,
        };
        if affinity.is_some_and(|index| state.retired.contains(&index)) {
            return Err(Error::Unavailable {
                part: "PostCSS context worker".into(),
            });
        }
        let index = if let Some(position) = state.available.iter().position(|index| {
            Some(*index) != protected && affinity.is_none_or(|affinity| *index == affinity)
        }) {
            state.available.remove(position)
        } else if affinity.is_none() && state.slots.len() < self.options.size.get() {
            state.slots.push(None);
            Some(state.slots.len() - 1)
        } else {
            None
        };
        let Some(index) = index else {
            return Ok(None);
        };
        state.early = Some(index);
        state.head.candidates.remove(&index);
        let slot = state.slots[index].take();
        Ok(Some(Box::new(Lease {
            pool: self.clone(),
            owned: Mutex::new(Some(Owned { index, slot })),
        })))
    }

    pub(super) fn observe_capacity(&self, wake: Weak<dyn ReturnWake>) {
        self.lock().head.available_wake = Some(wake);
    }

    pub(super) fn reap_early(&self, index: usize, slot: &Slot) -> bool {
        self.reap_early_control(index, slot.control.as_ref())
    }

    pub(super) fn reap_early_control(&self, index: usize, control: &dyn WorkerControl) -> bool {
        if self.lock().retired.contains(&index) {
            return false;
        }
        let reaped = self.retire_background(index, control, Reason::EarlyPreparation);
        if !self.lock().controls.contains_key(&index) {
            self.lock()
                .replacement_reasons
                .insert(index, Reason::EarlyPreparation);
        }
        match reaped {
            Ok(()) => true,
            Err(error) => {
                self.lock().early_failure.get_or_insert(error);
                false
            }
        }
    }
}

struct Owned {
    index: usize,
    slot: Option<Slot>,
}

struct Lease {
    pool: Pool,
    owned: Mutex<Option<Owned>>,
}

impl EarlyLease for Lease {
    fn request(&self, call: Call) -> EarlyCall {
        let mut owned = self.owned.lock().unwrap_or_else(|error| error.into_inner());
        let Some(owned) = owned.as_mut() else {
            return EarlyCall::Complete(Err(Error::Cancelled));
        };
        if self.pool.lock().retired.contains(&owned.index) {
            return EarlyCall::Deferred;
        }
        if let Call::ProcessCss(params) = &call
            && self
                .pool
                .lock()
                .affinity
                .get(&params.context)
                .is_some_and(|affinity| affinity.index != owned.index)
        {
            return EarlyCall::Deferred;
        }
        let root = self.pool.source_root(&call);
        if !self
            .pool
            .isolate_early(owned.index, &mut owned.slot, root.as_deref())
        {
            owned.slot = None;
            return EarlyCall::Deferred;
        }
        if let Call::ProcessCss(params) = &call {
            self.pool.lock().affinity.insert(
                params.context.clone(),
                Affinity {
                    index: owned.index,
                    source_root: params.source_root.clone().into(),
                },
            );
        }
        let mut bundle_attempt = BundleAttempt::default();
        let exchanged = self.pool.exchange(
            owned.index,
            &mut owned.slot,
            &call,
            true,
            2,
            &mut bundle_attempt,
        );
        if self.pool.lock().retired.contains(&owned.index) {
            owned.slot = None;
        }
        if exchanged.retry {
            match exchanged.result {
                Err(failure) => EarlyCall::Retry(EarlyRetry {
                    failure,
                    bundle: bundle_attempt,
                }),
                Ok(result) => EarlyCall::Complete(Ok(result)),
            }
        } else {
            EarlyCall::Complete(exchanged.result)
        }
    }

    fn finish(&self) -> Result<()> {
        let Some(owned) = self
            .owned
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take()
        else {
            return Ok(());
        };
        if let Some(slot) = owned.slot {
            self.pool.reap_early(owned.index, &slot);
        }
        let (retired, failure) = {
            let mut state = self.pool.lock();
            state.early = None;
            state.head.candidates.remove(&owned.index);
            (
                state.retired.contains(&owned.index),
                state.early_failure.take(),
            )
        };
        if !retired {
            self.pool.release(owned.index, None);
        }
        failure.map_or(Ok(()), Err)
    }
}

impl Drop for Lease {
    fn drop(&mut self) {
        if let Err(error) = self.finish() {
            tracing::warn!(%error, "early sidecar lease cleanup failed");
        }
    }
}
