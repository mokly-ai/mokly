//! One bounded batch joins all tasks before ordered consumption takes its slots.

use std::sync::Mutex;

use mokly_graph::types::RenderGeneration;
use mokly_graph::workers::ComparisonTask;

use crate::comparison_error::CompareResult;
use crate::comparison_preparation::{ViewInput, ViewPreparation};
use crate::comparison_types::ViewKey;
use crate::error::{InternalError, Result};

pub(crate) struct ViewRoutes {
    pub(crate) key: ViewKey,
    pub(crate) before: Option<String>,
    pub(crate) after: Option<String>,
}

pub(crate) struct Batch<'a> {
    preparation: &'a dyn ViewPreparation,
    routes: &'a [ViewRoutes],
    moved: bool,
    before: &'a dyn RenderGeneration,
    after: &'a dyn RenderGeneration,
    slots: Vec<Mutex<Result<ViewInput>>>,
}

impl<'a> Batch<'a> {
    pub(crate) fn new(
        preparation: &'a dyn ViewPreparation,
        routes: &'a [ViewRoutes],
        moved: bool,
        before: &'a dyn RenderGeneration,
        after: &'a dyn RenderGeneration,
    ) -> Self {
        Self {
            preparation,
            routes,
            moved,
            before,
            after,
            slots: routes
                .iter()
                .map(|_| Mutex::new(Err(InternalError::Worker.into())))
                .collect(),
        }
    }

    /// Taking each slot releases its prepared inputs after that view's Phase B.
    pub(crate) fn results(self) -> impl Iterator<Item = Result<ViewInput>> {
        self.slots
            .into_iter()
            .map(|slot| slot.into_inner().unwrap_or_else(|error| error.into_inner()))
    }
}

impl ComparisonTask for Batch<'_> {
    fn run(&self, index: usize) {
        let routes = &self.routes[index];
        let result = (|| {
            self.before.check_cancelled().compare()?;
            self.after.check_cancelled().compare()?;
            self.preparation.retained(
                routes.before.as_deref(),
                routes.after.as_deref(),
                self.moved,
            )
        })();
        *self.slots[index]
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = result;
    }
}
