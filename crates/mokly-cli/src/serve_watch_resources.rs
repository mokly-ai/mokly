//! Candidate-bound attachment runs before graph reads and shares watch mutation ordering.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, Weak};

use mokly_cli::serve::PreparedServe;
use mokly_graph::error::{InternalError, Result};
use mokly_graph::resource_inputs::ResourceObserver;
use mokly_watch::observer::Observer;
use tokio::sync::Notify;

use crate::serve_watch::{CandidateWatch, State, WatchedInputs};
use crate::serve_watch_plan::PlanRecord;

/// One candidate's attachment capability, retained without retaining its graph.
pub(super) struct Resources {
    observer: Arc<dyn Observer>,
    repository: PathBuf,
    pending: Mutex<BTreeSet<String>>,
    state: Weak<Mutex<State>>,
    ready: Arc<Notify>,
}

impl Resources {
    /// Construct one subscriber with its candidate observer and weak runtime state.
    pub(super) fn new(
        observer: Arc<dyn Observer>,
        repository: PathBuf,
        state: Weak<Mutex<State>>,
        ready: Arc<Notify>,
    ) -> Self {
        Self {
            observer,
            repository,
            pending: Mutex::default(),
            state,
            ready,
        }
    }

    /// Drain paths discovered before this subscriber became active.
    pub(super) fn take(&self) -> BTreeSet<String> {
        std::mem::take(&mut *self.pending.lock().unwrap_or_else(|e| e.into_inner()))
    }
}

impl WatchedInputs {
    /// Bind the candidate before a publisher can render its generation.
    pub(super) fn subscribe(
        &self,
        record: Arc<PlanRecord>,
        observer: Arc<dyn Observer>,
        recheck: bool,
        prepared: &PreparedServe,
    ) -> CandidateWatch {
        let resources = self.bind(observer.clone(), &record, prepared);
        CandidateWatch {
            observer,
            recheck,
            record,
            resources,
        }
    }

    /// Replace the subscriber after a candidate's second preparation.
    pub(super) fn bind(
        &self,
        observer: Arc<dyn Observer>,
        record: &PlanRecord,
        prepared: &PreparedServe,
    ) -> Arc<Resources> {
        let resources = Arc::new(Resources::new(
            observer,
            record.plan.repository.clone(),
            Arc::downgrade(&self.state),
            self.ready.clone(),
        ));
        let observer: Arc<dyn ResourceObserver> = resources.clone();
        prepared
            .generation
            .observe_resources(Arc::downgrade(&observer));
        resources
    }
}

impl ResourceObserver for Resources {
    fn observe(&self, _generation: &str, path: &str) -> Result<()> {
        let Some(state) = self.state.upgrade() else {
            return Ok(());
        };
        let mut state = state.lock().unwrap_or_else(|e| e.into_inner());
        if state.closed {
            return Ok(());
        }
        let active = state
            .resources
            .as_ref()
            .is_some_and(|active| std::ptr::eq(self, active.as_ref()));
        if !active {
            self.pending
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .insert(path.into());
        }
        if Arc::ptr_eq(&self.observer, &state.observer) {
            state.plan.resource(path);
        }
        if let Err(source) = self.observer.resource(&self.repository.join(path)) {
            state.refresh = true;
            self.ready.notify_one();
            return Err(InternalError::Provider {
                source: Box::new(source),
            }
            .into());
        }
        Ok(())
    }
}
