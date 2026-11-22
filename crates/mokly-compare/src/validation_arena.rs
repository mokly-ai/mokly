//! Borrowed fact proofs and optional admission never export retained owners.

use std::mem;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_graph::closure::ClosureBuilder;
use mokly_graph::comparison_proof::ContentIdentity;
use mokly_graph::head_validation::{ClosureFacts, DocumentChecks};
use mokly_graph::types::RenderGeneration;

use crate::reuse_budget::Resident;
use crate::reuse_optional::Arena;
use crate::validation_facts::{Fact, Pending, Read, Step, checks_bytes, closure_bytes};

/// The current reads that prove kept facts, shared through the current arena when it exists.
pub(crate) struct Replay<'a> {
    pub(crate) current: Option<&'a Arena>,
    pub(crate) resident: &'a Arc<Resident>,
    pub(crate) generation: &'a dyn RenderGeneration,
}

impl Replay<'_> {
    /// Read one input's current identity, shared with the other views of this attempt.
    pub(crate) fn identity(
        &self,
        read: &Read,
        previous: Option<&Arc<Read>>,
    ) -> Option<ContentIdentity> {
        match self.current {
            Some(current) => current
                .input(
                    self.resident,
                    self.generation,
                    read.kind,
                    &read.route,
                    previous,
                )
                .map(|input| input.identity),
            None => self.generation.validation_identity(read.kind, &read.route),
        }
    }

    /// Replay the walk order and stop at the first read whose identity changed.
    pub(crate) fn closure(&self, fact: &Fact, route: &str, observer: &dyn ClosureBuilder) -> bool {
        fact.steps.iter().all(|step| {
            let read = match step {
                Step::Read(index) => &fact.reads[*index],
                Step::Observe(index) => {
                    observer.observe(route, &fact.closure.replay[*index]);
                    return true;
                }
            };
            self.identity(read, Some(read)) == Some(read.identity)
        })
    }
}

impl Arena {
    /// Borrow the kept fact of a route whose document key and policy are unchanged.
    pub(crate) fn fact(&self, route: &str, key: ContentIdentity) -> Option<Arc<Fact>> {
        let guard = self.data.read().unwrap_or_else(|error| error.into_inner());
        let fact = guard
            .as_ref()?
            .facts
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(route)?
            .clone();
        (fact.key == key).then_some(fact)
    }

    /// Prove a kept closure after the checked read whose current checks the caller passes.
    pub(crate) fn reuse(
        &self,
        replay: &Replay<'_>,
        route: &str,
        key: ContentIdentity,
        observer: &dyn ClosureBuilder,
        checks: Option<&DocumentChecks>,
    ) -> Option<ClosureFacts> {
        let fact = self.fact(route, key)?;
        if fact.checks.is_some() && fact.checks.as_ref() != checks {
            return None;
        }
        if !replay.closure(&fact, route, observer) {
            return None;
        }
        if let Some(current) = replay.current {
            current.keep(route, &fact);
        }
        Some(ClosureFacts {
            files: fact.closure.files.clone(),
            warnings: fact.closure.warnings.clone(),
            replay: Vec::new(),
        })
    }

    pub(crate) fn keep(&self, route: &str, fact: &Arc<Fact>) {
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

    pub(crate) fn finish(
        &self,
        route: &str,
        key: Option<ContentIdentity>,
        closure: &ClosureFacts,
        checks: Option<DocumentChecks>,
    ) {
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
        let bytes = mem::size_of::<Fact>() + 64 + closure_bytes(closure);
        if !pending.charge.grow(bytes + checks_bytes(checks.as_ref())) {
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
            checks,
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
                data.outputs
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
