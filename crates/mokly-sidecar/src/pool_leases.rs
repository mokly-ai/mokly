//! Root-aware FIFO waiters preserve affine eligibility and cancel touched returns.

use std::path::Path;
use std::sync::Arc;
use std::sync::PoisonError;

use crate::error::{Error, Result};
use crate::methods::Call;
use crate::pool::Pool;
use crate::pool_affinity;
use crate::pool_claim;
use crate::pool_start::StartLease;
use crate::pool_state::{Slot, Waiting};

impl Pool {
    pub(super) fn acquire(
        &self,
        call: &Call,
        root: Option<&Path>,
        claim: Option<u64>,
    ) -> Result<(usize, Option<Slot>, Option<StartLease>)> {
        let root = root.unwrap_or(&self.launch.repository);
        let mut state = self.lock();
        let ticket = state.ticket;
        state.ticket += 1;
        let context = call.postcss_context().map(str::to_owned);
        state.waiting.insert(
            ticket,
            Waiting {
                context: context.clone(),
                root: root.into(),
                claim,
            },
        );
        state.head.notify();
        self.ready.notify_all();
        loop {
            if state.stopped {
                state.waiting.remove(&ticket);
                return Err(Error::Cancelled);
            }
            if context
                .as_ref()
                .and_then(|context| state.affinity.get(context))
                .is_some_and(|affinity| state.retired.contains(&affinity.index))
            {
                state.waiting.remove(&ticket);
                state.head.notify();
                self.ready.notify_all();
                return Err(Error::Unavailable {
                    part: "PostCSS context worker".into(),
                });
            }
            let admission = self.admission(&state);
            let limit = |claim: Option<u64>| {
                admission.slot_limit
                    + if claim.is_some_and(|id| state.claims.contains_key(&id)) {
                        pool_claim::growth(&state)
                    } else {
                        0
                    }
            };
            let first = state
                .waiting
                .iter()
                .find(|(_, waiting)| {
                    pool_affinity::runnable(
                        &state,
                        waiting.context.as_deref(),
                        limit(waiting.claim),
                    )
                })
                .map(|(ticket, _)| *ticket);
            if first == Some(ticket) {
                let protected = state
                    .head
                    .warm
                    .as_ref()
                    .filter(|warm| {
                        root != self.launch.repository
                            && state.source_roots.get(&warm.index) == Some(&self.launch.repository)
                            && state.controls.get(&warm.index).is_some_and(|control| {
                                warm.control.ptr_eq(&Arc::downgrade(control))
                            })
                    })
                    .map(|warm| warm.index);
                let limit = limit(claim);
                let previous = state.allocated();
                let index = pool_affinity::acquire(&mut state, call, root, limit, protected);
                if let Some(index) = index {
                    let start = (state.allocated() > previous).then(|| {
                        let source_claim = pool_claim::consume(&mut state, claim);
                        StartLease::new(self, index, source_claim)
                    });
                    state.head.candidates.remove(&index);
                    state.waiting.remove(&ticket);
                    state.serving += 1;
                    let slot = state.slots[index].take();
                    state.head.notify();
                    self.ready.notify_all();
                    return Ok((index, slot, start));
                }
            }
            state = self
                .ready
                .wait(state)
                .unwrap_or_else(PoisonError::into_inner);
        }
    }
}
