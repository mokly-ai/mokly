//! Serialized manual rebuilds prepare off-thread and publish one complete revision.

use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use mokly_cli::build::{BuildError, BuildSummary};
use mokly_cli::grammar::Common;
use mokly_cli::serve::ServePreparation;
use mokly_server::error::{InternalError, Result, ServerError};
use mokly_server::publication::{PublicationWriter, Publications};
use tokio::sync::mpsc;

use crate::serve_candidates::CandidateWork;
use crate::serve_state::ServeStateFactory;

#[cfg_attr(test, unimock::unimock(api = RebuildReporterMock))]
pub(super) trait RebuildReporter: Send + Sync {
    fn completed(&self, summary: &BuildSummary, elapsed: Duration);
    fn catalogue_failure(&self, error: &BuildError);
    fn server_failure(&self, error: &ServerError);
}

#[derive(Clone)]
pub(super) struct ManualRebuilds {
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
            tokio::select! {
                result = &mut serving => return result,
                Some(()) = requests.recv() => {},
            }
            let Some(permit) = self.candidates.enter() else {
                continue;
            };
            let started = Instant::now();
            let action = self.clone();
            let mut candidate = tokio::task::spawn_blocking(move || {
                let _candidate = permit;
                action.rebuild()
            });
            let result = tokio::select! {
                result = &mut serving => { let _ = candidate.await; return result; },
                result = &mut candidate => result,
            };
            match result {
                Ok(Some(summary)) => self.reporter.completed(&summary, started.elapsed()),
                Ok(None) => {}
                Err(source) => self
                    .reporter
                    .server_failure(&ServerError::Internal(InternalError::Task { source })),
            }
        }
    }
}

impl ManualRebuilds {
    fn rebuild(&self) -> Option<BuildSummary> {
        let prepared = match self.preparation.prepare(&self.cwd, &self.options) {
            Ok(prepared) => prepared,
            Err(error) => {
                self.reporter.catalogue_failure(&error);
                return None;
            }
        };
        if !self.candidates.active() {
            return None;
        }
        let revision = self.publications.current().index.revision.checked_add(1)?;
        let mut snapshot = match self.states.create(&prepared, revision) {
            Ok(snapshot) => snapshot,
            Err(error) => {
                self.reporter.server_failure(&error);
                return None;
            }
        };
        while self.candidates.active() {
            if self.writer.replace(snapshot.clone()) {
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
