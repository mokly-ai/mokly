//! One publication returns each untouched base slot under the shared pool bound.

use std::path::Path;
use std::sync::Weak;

use crate::error::{Error, Result};
use crate::pool::{Pool, ReturnWake};
use crate::pool_state::{Slot, State};
use crate::pool_timing::Reason;
use crate::workers::WorkerControl;

impl Pool {
    pub(super) fn schedule_return(&self) {
        let mut state = self.lock();
        if state.stopped || state.head.return_disabled {
            return;
        }
        state.head.pass += 1;
        let pass = state.head.pass;
        state.head.candidates = state
            .source_roots
            .iter()
            .filter(|(index, root)| {
                root.as_path() != self.launch.repository
                    && state.controls.contains_key(index)
                    && !state.retired.contains(index)
            })
            .map(|(index, _)| (*index, pass))
            .collect();
        state.head.notify();
    }

    pub(super) fn observe_return(&self, wake: Weak<dyn ReturnWake>) {
        let mut state = self.lock();
        state.head.wake = Some(wake);
        state.head.notify();
    }

    pub(super) fn maintain_return(&self) -> Result<bool> {
        let Some((index, pass, slot)) = self.claim_return() else {
            return Ok(self.maintain_warmup());
        };
        let outcome = self.return_slot(index, &slot);
        match outcome {
            Ok(slot) => self.complete_return(index, pass, slot)?,
            Err(error) => {
                self.complete_return(index, pass, None)?;
                return Err(error);
            }
        }
        Ok(true)
    }

    fn claim_return(&self) -> Option<(usize, u64, Slot)> {
        let mut state = self.lock();
        if state.stopped
            || state.head.return_disabled
            || state.head.active.is_some()
            || state
                .waiting
                .values()
                .any(|waiting| waiting.root != self.launch.repository)
        {
            return None;
        }
        let (position, index, pass) =
            state
                .available
                .iter()
                .enumerate()
                .find_map(|(position, index)| {
                    let pass = *state.head.candidates.get(index)?;
                    state.slots[*index]
                        .as_ref()
                        .filter(|slot| slot.source_root != self.launch.repository)?;
                    Some((position, *index, pass))
                })?;
        let slot = state.slots[index].take()?;
        state.available.remove(position);
        state.head.active = Some(index);
        Some((index, pass, slot))
    }

    fn return_slot(&self, index: usize, previous: &Slot) -> Result<Option<Slot>> {
        self.retire_return(index, previous.control.as_ref())?;
        {
            let mut state = self.lock();
            state.replacement_reasons.insert(index, Reason::RootSwitch);
            if state.stopped || eligible(&state, index, false, &self.launch.repository) {
                return Ok(None);
            }
        }
        self.forget_other_roots(index, &self.launch.repository);
        let Some(slot) = self.spawn_return(index)? else {
            return Ok(None);
        };
        let retire = {
            let state = self.lock();
            state.stopped || eligible(&state, index, true, &self.launch.repository)
        };
        if retire {
            self.retire_return(index, slot.control.as_ref())?;
            return Ok(None);
        }
        Ok(Some(slot))
    }

    /// A slot stays leased and registered until finish confirms reaping.
    pub(super) fn retire_return(&self, index: usize, control: &dyn WorkerControl) -> Result<()> {
        let span = Reason::RootSwitch.stop();
        let _scope = span.enter();
        let killed = control.kill();
        let now = self.clock.now_ms();
        let deadline = if self.lock().stopped {
            now
        } else {
            now.saturating_add(2_000)
        };
        let finished = control.finish(deadline);
        let reap_failed = finished.is_err();
        if finished.is_ok() {
            let mut state = self.lock();
            state.controls.remove(&index);
            state.source_roots.remove(&index);
        } else {
            let mut state = self.lock();
            state.retired.insert(index);
            state.head.return_disabled = true;
            state.head.candidates.clear();
            state.head.warmups.reset();
            if state.retired.len() == self.options.size.get() {
                state.stopped = true;
                state.recipes.clear();
            }
            self.ready.notify_all();
        }
        if killed.is_ok() && finished.is_ok() {
            span.record("status", "ok");
        }
        match killed.and(finished) {
            Err(source) if reap_failed => Err(Error::HeadReturnDisabled {
                source: Box::new(source),
            }),
            outcome => outcome,
        }
    }

    fn complete_return(&self, index: usize, pass: u64, slot: Option<Slot>) -> Result<()> {
        {
            let mut state = self.lock();
            if !state.stopped || slot.is_none() {
                if state.head.candidates.get(&index) == Some(&pass) {
                    state.head.candidates.remove(&index);
                }
                state.head.active = None;
                if slot.is_some() || !state.controls.contains_key(&index) {
                    if let Some(started) = &slot
                        && state.head.warm.is_some()
                    {
                        state.head.warmups.start(index, &started.control);
                    }
                    state.slots[index] = slot;
                    state.available.push_back(index);
                }
                let resolved = state
                    .head
                    .candidates
                    .keys()
                    .copied()
                    .filter(|index| {
                        state.retired.contains(index)
                            || !state.controls.contains_key(index)
                            || state
                                .source_roots
                                .get(index)
                                .is_some_and(|root| root == &self.launch.repository)
                    })
                    .collect::<Vec<_>>();
                for index in resolved {
                    state.head.candidates.remove(&index);
                }
                state.head.notify();
                self.ready.notify_all();
                return Ok(());
            }
        }
        let retired = match slot {
            Some(current) => self.retire_return(index, current.control.as_ref()),
            None => Ok(()),
        };
        self.complete_return(index, pass, None)?;
        retired
    }
}

fn eligible(state: &State, index: usize, base_only: bool, head: &Path) -> bool {
    state.waiting.values().any(|waiting| {
        (!base_only || waiting.root != head)
            && waiting
                .context
                .as_ref()
                .and_then(|context| state.affinity.get(context))
                .is_none_or(|affinity| affinity.index == index)
    })
}
