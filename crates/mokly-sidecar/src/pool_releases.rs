//! Non-blocking epoch releases and idle-slot cleanup never run in a graph destructor.

#[cfg(test)]
use std::sync::mpsc;
use std::sync::mpsc::Receiver;
use std::sync::{Arc, Condvar, Mutex};

use crate::error::Result;
use crate::pool::Pool;
use crate::pool_cleanup;
use crate::pool_state::State;

pub(super) enum Notice {
    Work,
    #[cfg(test)]
    Barrier(mpsc::SyncSender<()>),
}

pub(super) enum Release {
    Generation { id: String, epoch: u64 },
    Context(String),
}

impl Pool {
    pub(super) fn start_releases(&self, receiver: Receiver<Notice>) {
        let state = Arc::downgrade(&self.state);
        let ready = Arc::downgrade(&self.ready);
        let timeout = self.options.timeout_ms;
        if let Err(error) = std::thread::Builder::new()
            .name("mokly-sidecar-release".into())
            .spawn(move || {
                for notice in receiver {
                    match notice {
                        Notice::Work => {}
                        #[cfg(test)]
                        Notice::Barrier(done) => {
                            let _ = done.send(());
                            continue;
                        }
                    }
                    let (Some(state), Some(ready)) = (state.upgrade(), ready.upgrade()) else {
                        break;
                    };
                    loop {
                        match clean_idle(&state, &ready, timeout) {
                            Ok(true) => continue,
                            Ok(false) => break,
                            Err(error) => {
                                tracing::warn!(%error, "sidecar release failed");
                                break;
                            }
                        }
                    }
                }
            })
        {
            tracing::warn!(%error, "sidecar release thread could not start");
        }
    }

    #[cfg(test)]
    pub(super) fn synchronize_releases(&self) {
        let (done, completed) = mpsc::sync_channel(0);
        self.releases
            .as_ref()
            .unwrap()
            .send(Notice::Barrier(done))
            .unwrap();
        completed.recv().unwrap();
    }

    pub(super) fn enqueue_release(&self, release: Release) {
        if let Err(error) = self.record_release(release) {
            tracing::warn!(%error, "sidecar release could not be recorded");
            return;
        }
        if let Some(sender) = &self.releases {
            let _ = sender.send(Notice::Work);
        }
    }

    fn record_release(&self, release: Release) -> Result<()> {
        let mut state = self.lock()?;
        match release {
            Release::Generation { id, epoch } => {
                let last = state
                    .leases
                    .get_mut(&id)
                    .is_some_and(|leases| leases.remove(&epoch) && leases.is_empty());
                if last {
                    state.leases.remove(&id);
                    state.bundles.remove(&id);
                    state.compiled.remove(&id);
                    state.modules.remove(&id);
                    state.epochs.remove(&id);
                    state.maps.remove(&id);
                    state.bindings.remove(&id);
                }
            }
            Release::Context(id) => {
                state.contexts.remove(&id);
                state.affinity.remove(&id);
            }
        }
        self.ready.notify_all();
        Ok(())
    }
}

fn clean_idle(state: &Mutex<State>, ready: &Condvar, timeout: Option<u64>) -> Result<bool> {
    let slots = {
        let mut state = pool_cleanup::lock(state)?;
        if state.stopped {
            return Ok(false);
        }
        let available = std::mem::take(&mut state.available);
        let mut slots = Vec::new();
        for index in available {
            if state.slots[index]
                .as_ref()
                .is_some_and(|slot| pool_cleanup::pending(&state, slot))
            {
                if let Some(slot) = state.slots[index].take() {
                    slots.push((index, slot));
                }
            } else {
                state.available.push_back(index);
            }
        }
        slots
    };
    let mut pending = false;
    for (index, mut slot) in slots {
        let (slot, changed) = match pool_cleanup::cleanup(state, &mut slot, timeout) {
            Ok(changed) => (Some(slot), changed),
            Err(error) => {
                tracing::warn!(%error, "sidecar cleanup failed");
                let _ = slot.control.kill();
                (None, true)
            }
        };
        let mut state = pool_cleanup::lock(state)?;
        state.slots[index] = if state.stopped { None } else { slot };
        if state.slots[index].is_none() {
            state.controls.remove(&index);
        }
        state.available.push_back(index);
        pending |= changed
            && state.slots[index]
                .as_ref()
                .is_some_and(|slot| pool_cleanup::pending(&state, slot));
        ready.notify_all();
    }
    Ok(pending)
}
