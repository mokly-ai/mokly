//! Serialized manual rebuilds prepare off-thread and publish one complete revision.

use std::future::{Future, pending};
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use mokly_catalogue::diagnostic::Warning;
use mokly_cli::build::{BuildError, BuildSummary};
use mokly_cli::grammar::Common;
use mokly_cli::serve::ServePreparation;
use mokly_server::error::{InternalError, Result, ServerError};
use mokly_server::publication::{PublicationWriter, Publications};
use mokly_watch::event::Batch;
use tokio::sync::mpsc;

use crate::serve_candidates::CandidateWork;
use crate::serve_debounce;
use crate::serve_state::ServeStateFactory;
use crate::serve_watch::WatchInputs;

#[cfg_attr(test, unimock::unimock(api = RebuildReporterMock))]
/// Terminal boundary for manual and watched action results.
pub trait RebuildReporter: Send + Sync {
    /// Report native event loss once while keeping the accepted catalogue available.
    fn watcher_rescan(&self);
    /// Report a completed manual action without observation.
    fn completed(&self, summary: &BuildSummary, elapsed: Duration);
    /// Report a completed watched action with its coalesced paths.
    fn watched(
        &self,
        batch: &Batch,
        repository: &Path,
        summary: Option<&BuildSummary>,
        elapsed: Duration,
    );
    /// Flush attempt warnings before the watched catalogue failure.
    fn watched_catalogue_failure(&self, batch: &Batch, repository: &Path, error: &BuildError) {
        self.watched(batch, repository, None, Duration::ZERO);
        self.catalogue_failure(error);
    }
    /// Report attachment or projection failure with the watched action line.
    fn watched_server_failure(
        &self,
        batch: &Batch,
        repository: &Path,
        _warnings: &[Warning],
        error: &ServerError,
    ) {
        self.watched(batch, repository, None, Duration::ZERO);
        self.server_failure(error);
    }
    /// Report a failed preparation while retaining the accepted state.
    fn catalogue_failure(&self, error: &BuildError);
    /// Report a transport or observer failure.
    fn server_failure(&self, error: &ServerError);
}

#[derive(Clone)]
pub(super) struct ManualRebuilds {
    pub(super) watching: Option<Arc<dyn WatchInputs>>,
    pub(super) candidates: Arc<dyn CandidateWork>,
    pub(super) preparation: Arc<dyn ServePreparation>,
    pub(super) states: Arc<dyn ServeStateFactory>,
    pub(super) publications: Arc<dyn Publications>,
    pub(super) writer: Arc<dyn PublicationWriter>,
    pub(super) reporter: Arc<dyn RebuildReporter>,
    pub(super) cwd: PathBuf,
    pub(super) options: Common,
}

pub(super) type Serving<'a> = Pin<Box<dyn Future<Output = Result<()>> + Send + 'a>>;

#[async_trait]
pub(super) trait ServeActions: Send + Sync {
    async fn run(&self, serving: Serving<'_>, requests: mpsc::Receiver<()>) -> Result<()>;
}

#[async_trait]
impl ServeActions for ManualRebuilds {
    async fn run(&self, mut serving: Serving<'_>, mut requests: mpsc::Receiver<()>) -> Result<()> {
        loop {
            let mut batch = Batch::default();
            while batch.action.is_none() {
                tokio::select! {
                    result = &mut serving => return result,
                    Some(()) = requests.recv() => batch.rebuild(),
                    () = async { match &self.watching { Some(watch) => watch.changed().await, None => pending().await } } => {
                        if let Some(watch) = &self.watching { watch.drain(&mut batch, self.reporter.clone()).await; }
                    }
                }
            }
            if let Some(watch) = &self.watching
                && let Some(result) = serve_debounce::settle(
                    watch.clone(),
                    &mut batch,
                    self.reporter.clone(),
                    &mut requests,
                    &mut serving,
                )
                .await
            {
                return result;
            }
            let Some(permit) = self.candidates.enter() else {
                continue;
            };
            let started = Instant::now();
            let action = self.clone();
            let action_batch = batch.clone();
            let mut candidate = tokio::task::spawn_blocking(move || {
                let _candidate = permit;
                let span = tracing::info_span!(
                    "watch.action",
                    action = action_batch
                        .action
                        .map_or("rebuild", |action| action.label()),
                    status = "ok"
                );
                span.in_scope(|| {
                    let result = action.rebuild(&action_batch);
                    if result.is_none() {
                        tracing::Span::current().record("status", "error");
                    }
                    result
                })
            });
            let result = tokio::select! {
                result = &mut serving => { let _ = candidate.await; return result; },
                result = &mut candidate => result,
            };
            match result {
                Ok(Some(summary)) => {
                    if let Some(watch) = &self.watching {
                        self.reporter.watched(
                            &batch,
                            &watch.plan().repository,
                            Some(&summary),
                            started.elapsed(),
                        );
                    } else {
                        self.reporter.completed(&summary, started.elapsed());
                    }
                }
                Ok(None) => {}
                Err(source) => self.failed_server(
                    &batch,
                    &[],
                    &ServerError::Internal(InternalError::Task { source }),
                ),
            }
        }
    }
}

impl ManualRebuilds {
    fn failed_catalogue(&self, batch: &Batch, error: &BuildError) {
        if let Some(watch) = &self.watching {
            watch.failed();
            self.reporter
                .watched_catalogue_failure(batch, &watch.plan().repository, error);
        } else {
            self.reporter.catalogue_failure(error);
        }
    }
    fn failed_server(&self, batch: &Batch, warnings: &[Warning], error: &ServerError) {
        if let Some(watch) = &self.watching {
            watch.failed();
            self.reporter
                .watched_server_failure(batch, &watch.plan().repository, warnings, error);
        } else {
            self.reporter.server_failure(error);
        }
    }
    fn rebuild(&self, batch: &Batch) -> Option<BuildSummary> {
        let mut prepared = match self.preparation.prepare(&self.cwd, &self.options) {
            Ok(prepared) => prepared,
            Err(error) => {
                tracing::Span::current().record("status", "error");
                self.failed_catalogue(batch, &error);
                return None;
            }
        };
        if !self.candidates.active() {
            return None;
        }
        let mut candidate = if let Some(watch) = &self.watching {
            match watch.candidate(&prepared) {
                Ok(candidate) => Some(candidate),
                Err(error) => {
                    self.failed_server(batch, &prepared.summary.warnings, &error);
                    return None;
                }
            }
        } else {
            None
        };
        if let Some(candidate) = &mut candidate
            && candidate.recheck
        {
            prepared = match self.preparation.prepare(&self.cwd, &self.options) {
                Ok(prepared) => prepared,
                Err(error) => {
                    self.failed_catalogue(batch, &error);
                    return None;
                }
            };
            if let Some(watch) = &self.watching
                && let Err(error) = watch.recheck(candidate, &prepared)
            {
                self.failed_server(batch, &prepared.summary.warnings, &error);
                return None;
            }
        }
        let previous = self.publications.current();
        let revision = previous.index.revision.checked_add(1)?;
        let mut snapshot = match self.states.replace(&prepared, revision, &previous) {
            Ok(snapshot) => snapshot,
            Err(error) => {
                self.failed_server(batch, &prepared.summary.warnings, &error);
                return None;
            }
        };
        while self.candidates.active() {
            if self.writer.replace(snapshot.clone()) {
                if let (Some(watch), Some(candidate)) = (&self.watching, candidate.take()) {
                    watch.clone().adopt(candidate, &prepared);
                }
                return Some(prepared.summary);
            }
            let revision = self.publications.current().index.revision.checked_add(1)?;
            if revision <= snapshot.index.revision {
                return None;
            }
            snapshot = snapshot.at_revision(revision);
        }
        None
    }
}

#[cfg(test)]
#[path = "_tests_/serve_rebuild_tests.rs"]
mod serve_rebuild_tests;

#[cfg(test)]
#[path = "_tests_/serve_burst_tests.rs"]
mod serve_burst_tests;

#[cfg(test)]
#[path = "_tests_/serve_watch_burst_tests.rs"]
mod serve_watch_burst_tests;
