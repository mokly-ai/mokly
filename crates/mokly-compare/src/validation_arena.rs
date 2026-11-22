//! Borrowed fact proofs and optional admission never export retained owners.

use std::mem;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_graph::closure::ClosureBuilder;
use mokly_graph::comparison_proof::ContentIdentity;
use mokly_graph::error::Result;
use mokly_graph::head_validation::ClosureFacts;
use mokly_graph::types::RenderGeneration;

use crate::reuse_budget::Resident;
use crate::reuse_optional::Arena;
use crate::validation_facts::{Fact, Pending, Step, closure_bytes};

impl Arena {
    pub(crate) fn reuse(
        &self,
        current: Option<&Arena>,
        resident: &Arc<Resident>,
        generation: &dyn RenderGeneration,
        route: &str,
        key: ContentIdentity,
        observer: &dyn ClosureBuilder,
    ) -> Result<Option<ClosureFacts>> {
        let guard = self.data.read().unwrap_or_else(|error| error.into_inner());
        let Some(data) = guard.as_ref() else {
            return Ok(None);
        };
        let Some(fact) = data
            .facts
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(route)
            .cloned()
        else {
            return Ok(None);
        };
        if fact.key != key {
            return Ok(None);
        }
        for step in &fact.steps {
            let read = match step {
                Step::Read(index) => &fact.reads[*index],
                Step::Observe(index) => {
                    observer.observe(route, &fact.closure.replay[*index])?;
                    continue;
                }
            };
            let identity = match current {
                Some(current) => current
                    .input(resident, generation, read.kind, &read.route, Some(read))
                    .map(|input| input.identity),
                None => generation.validation_identity(read.kind, &read.route),
            };
            if identity != Some(read.identity) {
                return Ok(None);
            }
        }
        if let Some(current) = current {
            current.keep(route, &fact);
        }
        Ok(Some(ClosureFacts {
            files: fact.closure.files.clone(),
            warnings: fact.closure.warnings.clone(),
            replay: Vec::new(),
        }))
    }

    fn keep(&self, route: &str, fact: &Arc<Fact>) {
        let guard = self.data.read().unwrap_or_else(|error| error.into_inner());
        let Some(data) = &*guard else {
            return;
        };
        if data
            .charge
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .grow(mem::size_of::<(Arc<str>, Arc<Fact>)>() + route.len() + 320)
        {
            data.facts
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .insert(Arc::from(route), fact.clone());
        }
    }

    pub(crate) fn finish(&self, route: &str, key: Option<ContentIdentity>, closure: &ClosureFacts) {
        let guard = self.data.read().unwrap_or_else(|error| error.into_inner());
        let Some(data) = &*guard else {
            return;
        };
        let Some(mut pending) = data
            .pending
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .remove(route)
        else {
            return;
        };
        let Some(key) = key.filter(|_| pending.complete) else {
            return;
        };
        pending.charge.shrink(mem::size_of::<Pending>());
        if !pending
            .charge
            .grow(mem::size_of::<Fact>() + 64 + closure_bytes(closure))
        {
            return;
        }
        let fact = Arc::new(Fact {
            key,
            closure: ClosureFacts {
                files: closure.files.clone(),
                warnings: closure.warnings.clone(),
                replay: pending.observed,
            },
            reads: pending.reads,
            steps: pending.steps,
            _charge: pending.charge,
        });
        data.facts
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(Arc::from(route), fact);
    }

    pub(crate) fn finish_inputs(&self) {
        let guard = self.data.read().unwrap_or_else(|error| error.into_inner());
        if let Some(data) = &*guard {
            let mut inputs = data
                .inputs
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            *inputs = Default::default();
            data.charge
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .shrink(data.input_bytes.swap(0, Ordering::Relaxed));
            data.pending
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .clear();
            if !data.consistent.load(Ordering::Relaxed) {
                data.facts
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .clear();
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/validation_replay_tests.rs"]
mod validation_replay_tests;
