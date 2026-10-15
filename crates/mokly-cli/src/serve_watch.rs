//! Watch candidates attach before adoption and keep resource targets current.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_cli::serve::PreparedServe;
use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::RenderGeneration;
use mokly_server::error::{InternalError, Result, ServerError};
use mokly_server::shutdown::Lifecycle;
use mokly_source_interface::tree::SourceTree;
use mokly_watch::event::{Batch, Kind};
use mokly_watch::native::NativeObserver;
use mokly_watch::observer::Observer;
use mokly_watch::plan::Plan;

use crate::serve_rebuild::RebuildReporter;

#[async_trait]
pub(super) trait WatchInputs: Lifecycle + ResourceObserver {
    fn candidate(&self, prepared: &PreparedServe) -> Result<CandidateWatch>;
    fn recheck(&self, candidate: &mut CandidateWatch, prepared: &PreparedServe) -> Result<()>;
    fn adopt(self: Arc<Self>, candidate: CandidateWatch, prepared: &PreparedServe);
    fn drain(&self, batch: &mut Batch, reporter: &dyn RebuildReporter) -> bool;
    async fn changed(&self);
    fn plan(&self) -> Plan;
}

pub(super) struct WatchedInputs {
    tree: Arc<dyn SourceTree>,
    state: Mutex<State>,
}
struct State {
    plan: Plan,
    generation: Option<Arc<dyn RenderGeneration>>,
    observer: Arc<dyn Observer>,
    closed: bool,
}
pub(super) struct CandidateWatch {
    plan: Plan,
    observer: Arc<dyn Observer>,
    pub(super) recheck: bool,
}

impl WatchedInputs {
    pub(super) fn new(tree: Arc<dyn SourceTree>, config: &ResolvedConfig) -> Result<Self> {
        let plan = watch_result(Plan::new(config, &[], &[], &BTreeSet::new()))?;
        let observer = Arc::new(watch_result(NativeObserver::new(tree.clone(), &plan))?);
        Ok(Self {
            tree,
            state: Mutex::new(State {
                plan,
                observer,
                generation: None,
                closed: false,
            }),
        })
    }
}

#[async_trait]
impl WatchInputs for WatchedInputs {
    fn candidate(&self, prepared: &PreparedServe) -> Result<CandidateWatch> {
        let plan = plan(prepared)?;
        let current = self.state.lock().unwrap_or_else(|e| e.into_inner());
        let recheck = current.plan.targets() != plan.targets();
        let observer = if recheck {
            Arc::new(watch_result(NativeObserver::new(self.tree.clone(), &plan))?)
                as Arc<dyn Observer>
        } else {
            current.observer.clone()
        };
        Ok(CandidateWatch {
            plan,
            observer,
            recheck,
        })
    }

    fn recheck(&self, candidate: &mut CandidateWatch, prepared: &PreparedServe) -> Result<()> {
        candidate.plan = plan(prepared)?;
        watch_result(candidate.observer.replace(&candidate.plan))
    }

    fn adopt(self: Arc<Self>, candidate: CandidateWatch, prepared: &PreparedServe) {
        let old = {
            let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
            if state.closed {
                return;
            }
            let old = (!Arc::ptr_eq(&state.observer, &candidate.observer))
                .then(|| state.observer.clone());
            if let Some(old) = &old {
                candidate.observer.replay(old.take());
            }
            state.plan = candidate.plan;
            state.plan.resources(&prepared.generation.watch_files());
            if let Err(error) = candidate.observer.replace(&state.plan) {
                tracing::warn!(%error, "resource watcher could not attach");
            }
            state.observer = candidate.observer;
            state.generation = Some(prepared.generation.clone());
            old
        };
        if let Some(old) = old {
            old.close();
        }
        let observer: Arc<dyn ResourceObserver> = self.clone();
        prepared
            .generation
            .observe_resources(Arc::downgrade(&observer));
    }

    fn drain(&self, batch: &mut Batch, reporter: &dyn RebuildReporter) -> bool {
        let state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        let mut directories = false;
        let mut accepted = false;
        for event in state.observer.take() {
            match event {
                Ok(event) => {
                    directories |= event.kind == Kind::Directory
                        || state.plan.ancestors.contains_key(&event.path)
                        || state.plan.roots.contains(&event.path);
                    if let Some(action) = state.plan.classify(&event) {
                        accepted = true;
                        batch.insert(event, action);
                    }
                }
                Err(error) => reporter.server_failure(&failure(error)),
            }
        }
        if directories && let Err(error) = state.observer.rescan(&state.plan) {
            reporter.server_failure(&failure(error));
        }
        accepted
    }
    async fn changed(&self) {
        let observer = self
            .state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .observer
            .clone();
        observer.changed().await;
    }
    fn plan(&self) -> Plan {
        self.state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .plan
            .clone()
    }
}

fn plan(prepared: &PreparedServe) -> Result<Plan> {
    watch_result(Plan::new(
        &prepared.config,
        &prepared.generation.catalogue().model.sources,
        prepared.generation.stylesheet_directories(),
        &prepared.generation.watch_files(),
    ))
}
fn failure(source: mokly_watch::error::Error) -> ServerError {
    ServerError::Internal(InternalError::Provider {
        source: Box::new(source),
    })
}
fn watch_result<T>(result: mokly_watch::error::Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(failure(source)),
    }
}

#[async_trait]
impl Lifecycle for WatchedInputs {
    async fn stop_watcher(&self) -> Result<()> {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        state.closed = true;
        state.observer.close();
        state.generation = None;
        Ok(())
    }
    async fn cancel_renders(&self) -> Result<()> {
        Ok(())
    }
    async fn cancel_git(&self) -> Result<()> {
        Ok(())
    }
    async fn shutdown_sidecars(&self) -> Result<()> {
        Ok(())
    }
    async fn release(&self) -> Result<()> {
        Ok(())
    }
}

impl ResourceObserver for WatchedInputs {
    fn observe(&self, generation: &str, path: &str) {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if state.closed
            || state
                .generation
                .as_ref()
                .is_none_or(|active| active.generation_key() != generation)
        {
            return;
        }
        state.plan.resources(&BTreeSet::from([path.into()]));
        if let Err(error) = state.observer.replace(&state.plan) {
            tracing::warn!(%error, "resource watcher could not attach");
        }
    }
}
