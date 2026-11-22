//! Walk-local writes and current identities stay inside reclaimable arenas.

use std::mem;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_graph::comparison_proof::ContentIdentity;
use mokly_graph::head_validation::ValidationRead;
use mokly_graph::types::RenderGeneration;

use crate::reuse_budget::Resident;
use crate::reuse_optional::Arena;
use crate::validation_facts::{Pending, Read, Step};

enum Input<'a> {
    Current(&'a dyn RenderGeneration),
    Actual(Option<ContentIdentity>),
}

impl Arena {
    pub(crate) fn input(
        &self,
        resident: &Arc<Resident>,
        generation: &dyn RenderGeneration,
        kind: ValidationRead,
        route: &str,
        previous: Option<&Arc<Read>>,
    ) -> Option<Arc<Read>> {
        self.value(resident, kind, route, previous, Input::Current(generation))
    }
    pub(crate) fn actual(
        &self,
        resident: &Arc<Resident>,
        kind: ValidationRead,
        route: &str,
        identity: Option<ContentIdentity>,
    ) -> Option<Arc<Read>> {
        self.value(resident, kind, route, None, Input::Actual(identity))
    }
    fn value(
        &self,
        resident: &Arc<Resident>,
        kind: ValidationRead,
        route: &str,
        previous: Option<&Arc<Read>>,
        input: Input<'_>,
    ) -> Option<Arc<Read>> {
        let guard = self.data.read().unwrap_or_else(|error| error.into_inner());
        let data = guard.as_ref()?;
        let mut inputs = data
            .inputs
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let key = (kind, Arc::from(route));
        if let Some(value) = inputs.get(&key) {
            if let Input::Actual(identity) = input
                && value.as_ref().map(|read| read.identity) != identity
            {
                if identity.is_some() && value.is_some() {
                    data.consistent.store(false, Ordering::Relaxed);
                }
                return None;
            }
            return value.clone();
        }
        let index_bytes = mem::size_of_val(&key) + 320 + route.len();
        if !data
            .charge
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .grow(index_bytes)
        {
            return None;
        }
        data.input_bytes.fetch_add(index_bytes, Ordering::Relaxed);
        let identity = match input {
            Input::Current(generation) => generation.validation_identity(kind, route),
            Input::Actual(identity) => identity,
        };
        let read = identity.and_then(|identity| {
            if let Some(previous) = previous
                && previous.identity == identity
            {
                return Some(previous.clone());
            }
            let charge = resident.reserve_optional(mem::size_of::<Read>() + route.len() + 64)?;
            Some(Arc::new(Read {
                kind,
                route: Arc::from(route),
                identity,
                _charge: charge,
            }))
        });
        inputs.insert(key, read.clone());
        read
    }

    pub(crate) fn begin(&self, resident: &Arc<Resident>, route: &str) {
        let guard = self.data.read().unwrap_or_else(|error| error.into_inner());
        let Some(data) = &*guard else {
            return;
        };
        let Some(charge) = resident.reserve_optional(mem::size_of::<Pending>() + route.len() + 320)
        else {
            return;
        };
        data.pending
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(
                route.into(),
                Pending {
                    reads: vec![],
                    observed: vec![],
                    complete: true,
                    charge,
                    steps: vec![],
                },
            );
    }

    pub(crate) fn record(&self, route: &str, read: Option<Arc<Read>>) {
        self.pending(route, |pending| {
            let Some(read) = read else {
                pending.complete = false;
                return;
            };
            if pending
                .reads
                .iter()
                .any(|value| value.kind == read.kind && value.route == read.route)
            {
                return;
            }
            let growth = if pending.reads.len() == pending.reads.capacity() {
                pending.reads.capacity().max(4)
            } else {
                0
            };
            if !pending.charge.grow(growth * mem::size_of::<Arc<Read>>()) {
                pending.complete = false;
                return;
            }
            pending.reads.reserve_exact(growth);
            pending.step(Step::Read(pending.reads.len()));
            pending.reads.push(read);
        });
    }

    pub(crate) fn observe(&self, route: &str, path: &str) {
        self.pending(route, |pending| {
            let growth = if pending.observed.len() == pending.observed.capacity() {
                pending.observed.capacity().max(4)
            } else {
                0
            };
            if !pending
                .charge
                .grow(growth * mem::size_of::<String>() + path.len())
            {
                pending.complete = false;
                return;
            }
            pending.observed.reserve_exact(growth);
            pending.step(Step::Observe(pending.observed.len()));
            pending.observed.push(path.into());
        });
    }

    pub(crate) fn pending(&self, route: &str, run: impl FnOnce(&mut Pending)) {
        let guard = self.data.read().unwrap_or_else(|error| error.into_inner());
        if let Some(data) = &*guard {
            let mut pending = data
                .pending
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            if let Some(pending) = pending.get_mut(route) {
                run(pending);
            }
        }
    }
}

pub(crate) fn arena_bytes() -> usize {
    mem::size_of::<Arena>() + 384
}
