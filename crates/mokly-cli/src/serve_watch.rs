//! Watch candidates bind resource observation before their generation is published.

use std::collections::BTreeSet;
use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

use async_trait::async_trait;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_cli::serve::PreparedServe;
use mokly_server::error::{InternalError, Result, ServerError};
use mokly_source_interface::tree::SourceTree;
use mokly_watch::event::Batch;
use mokly_watch::observer::Observer;
use mokly_watch::plan::Plan;
use tokio::sync::Notify;

use crate::serve_rebuild::RebuildReporter;
use crate::serve_watch_events;
use crate::serve_watch_files::{self, NativeObservers, Observers};
use crate::serve_watch_plan::{PlanInputs, PlanRecord};
use crate::serve_watch_resources::Resources;

/// Owned notification future allows tests to control readiness without clocks.
pub type WatchWait = Pin<Box<dyn Future<Output = ()> + Send>>;

#[cfg_attr(test, unimock::unimock(api = WatchInputsMock))]
#[async_trait]
pub(super) trait WatchInputs: Send + Sync {
    /// Record that a preparation starts now, before it reads any input.
    fn begin(&self);
    /// Build the watch candidate of `prepared`. After a successful rebuild and observer
    /// update, equal plan inputs reuse the adopted plan and observer without attaching.
    fn candidate(&self, prepared: &PreparedServe) -> Result<CandidateWatch>;
    fn recheck(&self, candidate: &mut CandidateWatch, prepared: &PreparedServe) -> Result<()>;
    fn adopt(self: Arc<Self>, candidate: CandidateWatch, prepared: &PreparedServe);
    async fn drain(&self, batch: &mut Batch, reporter: Arc<dyn RebuildReporter>) -> bool;
    fn changed(&self) -> WatchWait;
    async fn stop(&self) -> Result<()>;
    fn failed(&self);
    fn plan(&self) -> Plan;
}

pub(super) struct WatchedInputs {
    factory: Arc<dyn Observers>,
    pub(super) state: Arc<Mutex<State>>,
    pub(super) ready: Arc<Notify>,
}
pub(super) struct State {
    pub(super) plan: Plan,
    pub(super) resources: Option<Arc<Resources>>,
    pub(super) observer: Arc<dyn Observer>,
    pub(super) pending: BTreeSet<String>,
    pub(super) refresh: bool,
    pub(super) failed: bool,
    pub(super) attach_reported: bool,
    pub(super) closed: bool,
    /// When the latest preparation began.
    pub(super) started: SystemTime,
    /// The inputs, plan, and targets of the adopted candidate.
    pub(super) record: Option<Arc<PlanRecord>>,
}
/// Prepared observer state exposed inside this private module for generated mocks.
pub struct CandidateWatch {
    pub(super) observer: Arc<dyn Observer>,
    /// The new roots reach a directory that the active observer did not watch.
    pub(super) recheck: bool,
    /// The plan of the candidate, with the inputs and the targets that a later candidate
    /// with equal inputs reuses.
    pub(super) record: Arc<PlanRecord>,
    /// The bound subscriber remains alive from preparation through adoption.
    pub(super) resources: Arc<Resources>,
}

impl WatchedInputs {
    pub(super) fn new(tree: Arc<dyn SourceTree>, config: &ResolvedConfig) -> Result<Self> {
        let plan = watch_result(Plan::new(config, &[], &[], &BTreeSet::new()))?;
        let factory: Arc<dyn Observers> = Arc::new(NativeObservers(tree));
        let observer = factory.attach(&plan)?;
        let started = factory.now();
        Ok(Self {
            factory,
            state: Arc::new(Mutex::new(State {
                plan,
                observer,
                resources: None,
                pending: BTreeSet::new(),
                refresh: false,
                failed: false,
                attach_reported: false,
                closed: false,
                started,
                record: None,
            })),
            ready: Arc::new(Notify::new()),
        })
    }

    /// Replay a change for each file among `paths` modified since the preparation began.
    fn replay(&self, observer: &Arc<dyn Observer>, paths: &[PathBuf]) {
        if paths.is_empty() {
            return;
        }
        let started = self.state.lock().unwrap_or_else(|e| e.into_inner()).started;
        let events = serve_watch_files::changed(paths, started, self.factory.as_ref());
        if !events.is_empty() {
            observer.replay(events);
        }
    }
}

#[async_trait]
impl WatchInputs for WatchedInputs {
    fn begin(&self) {
        let started = self.factory.now();
        self.state.lock().unwrap_or_else(|e| e.into_inner()).started = started;
    }
    fn candidate(&self, prepared: &PreparedServe) -> Result<CandidateWatch> {
        let (recorded, active) = {
            let current = self.state.lock().unwrap_or_else(|e| e.into_inner());
            let settled = !current.failed && !current.attach_reported;
            (
                current.record.clone().filter(|_| settled),
                current.observer.clone(),
            )
        };
        let inputs = PlanInputs::of(prepared);
        if let Some(record) = recorded.filter(|record| record.matches(&inputs)) {
            self.replay(&active, &record.unobserved(active.as_ref()));
            return Ok(self.subscribe(record, active, false, prepared));
        }
        let record = Arc::new(PlanRecord::new(inputs)?);
        let (changed, old) = {
            let current = self.state.lock().unwrap_or_else(|e| e.into_inner());
            (
                current.plan.roots != record.plan.roots,
                current.observer.clone(),
            )
        };
        let unobserved = record.unobserved(old.as_ref());
        if changed {
            let observer = self.factory.attach(&record.plan)?;
            let recheck = !old.covers(&record.plan);
            if !recheck {
                self.replay(&observer, &unobserved);
            }
            return Ok(self.subscribe(record, observer, recheck, prepared));
        }
        let mut attachment = record.plan.clone();
        {
            let state = self.state.lock().unwrap_or_else(|e| e.into_inner());
            attachment.extend_required(&state.plan);
            watch_result(old.replace(&attachment))?;
        }
        self.replay(&old, &unobserved);
        Ok(self.subscribe(record, old, false, prepared))
    }
    fn recheck(&self, candidate: &mut CandidateWatch, prepared: &PreparedServe) -> Result<()> {
        let record = Arc::new(PlanRecord::new(PlanInputs::of(prepared))?);
        let unobserved = record.unobserved(candidate.observer.as_ref());
        {
            let state = self.state.lock().unwrap_or_else(|e| e.into_inner());
            let mut plan = record.plan.clone();
            if Arc::ptr_eq(&state.observer, &candidate.observer) {
                plan.extend_required(&state.plan);
            }
            watch_result(candidate.observer.replace(&plan))?;
        }
        self.replay(&candidate.observer, &unobserved);
        candidate.record = record;
        candidate.resources = self.bind(candidate.observer.clone(), &candidate.record, prepared);
        Ok(())
    }
    fn adopt(self: Arc<Self>, candidate: CandidateWatch, prepared: &PreparedServe) {
        let files = prepared.generation.watch_files();
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
            state.plan = candidate.record.plan.clone();
            state.plan.resources(&candidate.resources.take());
            state.observer = candidate.observer;
            state.record = Some(candidate.record);
            state.resources = Some(candidate.resources);
            state.failed = false;
            state.attach_reported = false;
            state.refresh = true;
            state.pending.extend(files);
            old
        };
        if let Some(old) = old {
            old.close();
        }
        self.ready.notify_one();
    }
    async fn drain(&self, batch: &mut Batch, reporter: Arc<dyn RebuildReporter>) -> bool {
        let state = self.state.clone();
        let result = tokio::task::spawn_blocking(move || serve_watch_events::drain(state)).await;
        let (accepted, errors, rescan) = match result {
            Ok(result) => result,
            Err(source) => {
                reporter
                    .server_failure(&[], &ServerError::Internal(InternalError::Task { source }));
                return false;
            }
        };
        if rescan {
            reporter.watcher_rescan();
        }
        let changed = !accepted.is_empty();
        for (event, action) in accepted {
            batch.insert(event, action);
        }
        for error in errors {
            reporter.server_failure(&[], &error);
        }
        changed
    }
    fn changed(&self) -> WatchWait {
        let state = self.state.clone();
        let notifier = self.ready.clone();
        Box::pin(async move {
            let ready = notifier.notified();
            let observer = {
                let state = state.lock().unwrap_or_else(|e| e.into_inner());
                if !state.pending.is_empty() || state.refresh {
                    return;
                }
                state.observer.clone()
            };
            tokio::select! { () = ready => {}, () = observer.changed() => {} }
        })
    }
    async fn stop(&self) -> Result<()> {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        state.closed = true;
        state.observer.close();
        state.resources = None;
        state.pending.clear();
        Ok(())
    }
    fn failed(&self) {
        self.state.lock().unwrap_or_else(|e| e.into_inner()).failed = true;
    }
    fn plan(&self) -> Plan {
        self.state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .plan
            .clone()
    }
}

pub(super) fn failure(source: mokly_watch::error::Error) -> ServerError {
    ServerError::Internal(InternalError::Provider {
        source: Box::new(source),
    })
}
pub(super) fn watch_result<T>(result: mokly_watch::error::Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(failure(source)),
    }
}

#[cfg(test)]
#[path = "_tests_/serve_watch_tests.rs"]
mod serve_watch_tests;

#[cfg(test)]
#[path = "_tests_/serve_watch_coverage_tests.rs"]
mod serve_watch_coverage_tests;

#[cfg(test)]
#[path = "_tests_/serve_watch_stale_tests.rs"]
mod serve_watch_stale_tests;

#[cfg(test)]
#[path = "_tests_/serve_resource_tests.rs"]
mod serve_resource_tests;

#[cfg(test)]
#[path = "_tests_/serve_watch_adoption_tests.rs"]
mod serve_watch_adoption_tests;
