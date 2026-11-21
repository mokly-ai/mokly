//! Eager admission reserves its exact empty or base-root slot with its capacity claim.

use crate::error::{Error, Result};
use crate::methods::Call;
use crate::pool::Pool;
use crate::pool_claim::{self, CallClaim};
use crate::pool_start::StartLease;
use crate::pool_state::{Affinity, EagerSlot, Slot};

impl Pool {
    pub(super) fn eager_claim(&self, call: &Call) -> Result<Option<CallClaim>> {
        let Some(root) = self.source_root(call) else {
            return Ok(None);
        };
        let mut state = self.lock();
        if state.stopped {
            return Err(Error::Cancelled);
        }
        let admission = self.admission(&state);
        if root == self.launch.repository
            || admission.capacity == 1
            || !state.eager.is_empty()
            || state.claims.len() >= admission.capacity
        {
            return Ok(None);
        }
        let affinity = match call {
            Call::ProcessCss(params) => state.affinity.get(&params.context).map(|item| item.index),
            _ => None,
        };
        let eligible = state.available.iter().position(|index| {
            affinity.is_none_or(|affinity| affinity == *index)
                && state.slots[*index]
                    .as_ref()
                    .is_none_or(|slot| slot.source_root == root)
        });
        if eligible.is_none() && (affinity.is_some() || state.allocated() >= admission.slot_limit) {
            return Ok(None);
        }
        let id = state.next_claim;
        let claim = self.claim(&mut state);
        let fresh = eligible.is_none();
        let index = match eligible.and_then(|position| state.available.remove(position)) {
            Some(index) => index,
            None => state.free.pop_first().unwrap_or_else(|| {
                state.slots.push(None);
                state.slots.len() - 1
            }),
        };
        let source_claim = fresh
            .then(|| pool_claim::consume(&mut state, Some(id)))
            .flatten();
        state.eager.insert(
            id,
            EagerSlot {
                index,
                fresh,
                source_claim,
                taken: false,
            },
        );
        Ok(Some(claim))
    }

    pub(super) fn take_eager(
        &self,
        call: &Call,
        claim: u64,
    ) -> Option<(usize, Option<Slot>, Option<StartLease>)> {
        let mut state = self.lock();
        let reservation = state.eager.get_mut(&claim)?;
        if reservation.taken {
            return None;
        }
        reservation.taken = true;
        let index = reservation.index;
        let start = reservation
            .fresh
            .then(|| StartLease::new(self, index, reservation.source_claim));
        if let Call::ProcessCss(params) = call {
            state.affinity.insert(
                params.context.clone(),
                Affinity {
                    index,
                    source_root: params.source_root.clone().into(),
                },
            );
        }
        state.head.candidates.remove(&index);
        let slot = state.slots[index].take();
        state.head.notify();
        self.ready.notify_all();
        Some((index, slot, start))
    }
}
