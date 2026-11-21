//! A walk recorder resolves inputs only while borrowing its optional arena.

use std::sync::Arc;

use mokly_graph::comparison_proof::ContentIdentity;
use mokly_graph::head_validation::{ValidationRead, ValidationRecorder};
use mokly_graph::types::RenderGeneration;

use crate::reuse_budget::Resident;

pub(crate) struct Recording<'a> {
    pub(crate) resident: &'a Arc<Resident>,
    pub(crate) arena: Option<usize>,
    pub(crate) generation: &'a dyn RenderGeneration,
    pub(crate) route: &'a str,
}

impl ValidationRecorder for Recording<'_> {
    fn content(&self, kind: ValidationRead, route: &str, identity: Option<ContentIdentity>) {
        self.resident.with_optional([self.arena, None], |arenas| {
            if let Some(arena) = arenas[0] {
                let read = arena.actual(self.resident, kind, route, identity);
                arena.record(self.route, read);
            }
        });
    }
    fn input(&self, kind: ValidationRead, route: &str) {
        self.resident.with_optional([self.arena, None], |arenas| {
            if let Some(arena) = arenas[0] {
                let read = arena.input(self.resident, self.generation, kind, route, None);
                arena.record(self.route, read);
            }
        });
    }
    fn observe(&self, path: &str) {
        self.resident.with_optional([self.arena, None], |arenas| {
            if let Some(arena) = arenas[0] {
                arena.observe(self.route, path);
            }
        });
    }
    fn unknown(&self) {
        self.resident.with_optional([self.arena, None], |arenas| {
            if let Some(arena) = arenas[0] {
                arena.pending(self.route, |pending| pending.complete = false);
            }
        });
    }
}
