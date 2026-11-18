//! Comparison-owned ring slots live only until their ordered consumption.

use std::sync::Arc;
use std::sync::Mutex;

use mokly_graph::types::RenderGeneration;
use mokly_graph::workers::ComparisonTask;
use mokly_model::usage::CatalogueUsage;

use crate::comparison_error::CompareResult;
use crate::comparison_preparation::{ViewInput, ViewPreparation};
use crate::comparison_routes::ViewRoutes;
use crate::error::{InternalError, Result};
use crate::reuse_collection::SavedView;
use crate::reuse_probes::Probes;

pub(crate) struct Slot {
    pub(crate) reused: Option<Arc<SavedView>>,
    pub(crate) usage: Option<CatalogueUsage>,
    candidate: Option<Arc<SavedView>>,
    pub(crate) key: Option<[u8; 32]>,
    pub(crate) routes: ViewRoutes,
    pub(crate) input: Result<ViewInput>,
}

pub(crate) struct Slots<'a> {
    preparation: &'a dyn ViewPreparation,
    before: &'a dyn RenderGeneration,
    after: &'a dyn RenderGeneration,
    probes: Option<&'a Probes>,
    slots: Vec<Mutex<Option<Slot>>>,
}

impl<'a> Slots<'a> {
    pub(crate) fn new(
        preparation: &'a dyn ViewPreparation,
        before: &'a dyn RenderGeneration,
        after: &'a dyn RenderGeneration,
        capacity: usize,
        probes: Option<&'a Probes>,
    ) -> Self {
        Self {
            preparation,
            before,
            after,
            probes,
            slots: (0..capacity.max(1)).map(|_| Mutex::new(None)).collect(),
        }
    }

    pub(crate) fn admit(&self, index: usize, routes: ViewRoutes) {
        *self.slots[index % self.slots.len()]
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(Slot {
            reused: None,
            candidate: None,
            usage: None,
            key: None,
            routes,
            input: Err(InternalError::Worker.into()),
        });
    }

    pub(crate) fn admit_reuse(
        &self,
        index: usize,
        routes: ViewRoutes,
        key: Option<[u8; 32]>,
        reused: Option<Arc<SavedView>>,
    ) {
        self.admit(index, routes);
        let mut slot = self.slots[index % self.slots.len()]
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(slot) = slot.as_mut() {
            slot.key = key;
            slot.candidate = reused;
        }
    }

    /// Removing the slot lets Phase B release it before the graph refills it.
    pub(crate) fn take(&self, index: usize) -> Result<Slot> {
        self.slots[index % self.slots.len()]
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take()
            .ok_or_else(|| InternalError::Worker.into())
    }
}

impl ComparisonTask for Slots<'_> {
    fn run(&self, index: usize) {
        let mut slot = self.slots[index % self.slots.len()]
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(slot) = slot.as_mut() {
            slot.input = (|| {
                self.before.check_cancelled().compare()?;
                self.after.check_cancelled().compare()?;
                if let (Some(probes), Some(candidate)) = (self.probes, &slot.candidate)
                    && let Some(usage) = candidate.reads.valid(
                        self.before,
                        self.after,
                        probes,
                        slot.routes.after.as_deref(),
                    )
                {
                    slot.usage = usage;
                    slot.reused = slot.candidate.take();
                    return Ok(ViewInput::Deferred(None));
                }
                self.preparation.retained(
                    slot.routes.before.as_deref(),
                    slot.routes.after.as_deref(),
                    slot.routes.moved,
                )
            })();
        }
    }
}
