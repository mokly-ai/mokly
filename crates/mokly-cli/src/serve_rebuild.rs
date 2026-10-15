//! Serialized manual rebuilds prepare off-thread and publish one complete revision.

use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;

use async_trait::async_trait;
use mokly_cli::build::{BuildError, BuildSummary};
use mokly_cli::grammar::Common;
use mokly_cli::serve::ServePreparation;
use mokly_server::error::{InternalError, Result, ServerError};
use mokly_server::publication::{PublicationWriter, Publications};
use tokio::sync::mpsc;

use crate::serve_candidates::CandidateWork;
use crate::serve_state::ServeStateFactory;

pub(super) trait RebuildReporter: Send + Sync {
    fn completed(&self, summary: &BuildSummary);
    fn catalogue_failure(&self, error: &BuildError);
    fn server_failure(&self, error: &ServerError);
}

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
            let preparation = self.preparation.clone();
            let cwd = self.cwd.clone();
            let options = self.options.clone();
            let mut candidate = tokio::task::spawn_blocking(move || {
                let _candidate = permit;
                preparation.prepare(&cwd, &options)
            });
            let prepared = tokio::select! {
                result = &mut serving => { let _ = candidate.await; return result; },
                result = &mut candidate => result,
            };
            let prepared = match prepared {
                Ok(Ok(prepared)) => prepared,
                Ok(Err(error)) => {
                    self.reporter.catalogue_failure(&error);
                    continue;
                }
                Err(source) => {
                    self.reporter
                        .server_failure(&ServerError::Internal(InternalError::Task { source }));
                    continue;
                }
            };
            if !self.candidates.active() {
                continue;
            }
            let Some(revision) = self.publications.current().index.revision.checked_add(1) else {
                continue;
            };
            match self.states.create(&prepared, revision) {
                Ok(snapshot) => {
                    if self.writer.replace(snapshot) {
                        self.reporter.completed(&prepared.summary);
                    }
                }
                Err(error) => self.reporter.server_failure(&error),
            }
        }
    }
}
