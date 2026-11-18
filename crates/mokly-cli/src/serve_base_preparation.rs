//! Early outcomes record dependency choices independently from retention evidence.

use std::sync::{Arc, Mutex};

use mokly_compare::base_render::PreparationCheckpoint;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::error::{Error, Result};
use mokly_render::dependency_usage::DependencyUsage;
use mokly_server::changes::ChangeCancellation;
use mokly_server::usage_completion::UsageCompletion;

use crate::serve_early_pool::PreparingPool;
use crate::serve_preparation_control::PreparationControl;

struct Selection {
    sidecar: bool,
    directories: Vec<String>,
    unmapped: Vec<String>,
}

pub(super) struct Preparation {
    pub(super) usage: Arc<dyn UsageCompletion>,
    pub(super) cancel: Arc<dyn ChangeCancellation>,
    pub(super) pool: Arc<dyn PreparingPool>,
    pub(super) dependencies: Arc<dyn DependencyUsage>,
    selection: Mutex<Option<Selection>>,
}

impl Preparation {
    pub(super) fn new(
        usage: Arc<dyn UsageCompletion>,
        cancel: Arc<dyn ChangeCancellation>,
        pool: Arc<dyn PreparingPool>,
        dependencies: Arc<dyn DependencyUsage>,
    ) -> Self {
        Self {
            usage,
            cancel,
            pool,
            dependencies,
            selection: Mutex::new(None),
        }
    }
}

impl PreparationControl for Preparation {
    fn selected(&self, sidecar: bool, directories: Vec<String>, unmapped: Vec<String>) {
        *self
            .selection
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(Selection {
            sidecar,
            directories,
            unmapped,
        });
    }
    fn wait(&self) -> Result<()> {
        if self.usage.wait(self.cancel.as_ref()) {
            Ok(())
        } else {
            Err(Error::Cancelled)
        }
    }
    fn checkpoint(
        &self,
        request: &BaseRetentionRequest<'_>,
        checkpoint: PreparationCheckpoint,
    ) -> Result<bool> {
        self.pool.finish();
        let sidecar = self
            .selection
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
            .is_some_and(|selection| selection.sidecar);
        if checkpoint == PreparationCheckpoint::Capture && !sidecar {
            return Ok(true);
        }
        self.wait()?;
        let selected = self
            .selection
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let Some(selected) = &*selected else {
            return Ok(true);
        };
        let (directories, unmapped) = if selected.sidecar {
            (
                self.dependencies.directories(),
                self.dependencies.unmapped_directories(),
            )
        } else {
            (
                request
                    .head
                    .catalogue()
                    .dependency_directories
                    .iter()
                    .cloned()
                    .collect(),
                Vec::new(),
            )
        };
        Ok(selected.directories == directories && selected.unmapped == unmapped)
    }
    fn restarting(&self) {
        *self
            .selection
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = None;
    }
}
