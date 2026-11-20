//! Fenced finalization; a committed publication always wins over runner failure.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_build_interface::outcome::BuildOutcome;
use mkc_store_interface::build::Build;
use mkc_store_interface::build_state::{BuildFailure, BuildState};
use mkc_store_interface::publication::PublicationFailure;

use crate::error::{ErrorResultExt, Result};
use crate::transaction::Transactions;

use super::outcome::{finish, infrastructure, terminal};

pub(super) enum AttemptResult {
    Runner(BuildOutcome),
    RepositoryUnavailable,
    Infrastructure,
}

pub(super) trait AttemptFinalizer: Send + Sync {
    fn finish(&self, build: &Build, result: AttemptResult) -> Result<()>;
}

pub(super) struct Finalizer {
    pub(super) transactions: Arc<dyn Transactions>,
    pub(super) runtime: Arc<dyn Runtime>,
}

impl AttemptFinalizer for Finalizer {
    fn finish(&self, build: &Build, result: AttemptResult) -> Result<()> {
        let at = self.runtime.now();
        self.transactions.run(false, &mut |queries| {
            let Some(current) = queries
                .build(build.project_id, build.id)
                .context("read build finalization fence")?
            else {
                return Ok(());
            };
            if current.state != BuildState::Running || current.lease_token != build.lease_token {
                return Ok(());
            }
            let value = if current.publication_id.is_some() {
                terminal(BuildState::Published, None, None, at)
            } else {
                match &result {
                    AttemptResult::Runner(outcome) => {
                        let grant = queries
                            .build_attempt_grant(build.id, current.attempt)
                            .context("read attempt upload outcome")?;
                        finish(
                            outcome,
                            grant.and_then(|value| value.outcome),
                            current.attempt,
                            at,
                        )
                    }
                    AttemptResult::RepositoryUnavailable => terminal(
                        BuildState::Failed,
                        Some(BuildFailure::RepositoryUnavailable),
                        None,
                        at,
                    ),
                    AttemptResult::Infrastructure => infrastructure(current.attempt, at),
                }
            };
            let finished = queries
                .finish_build(current.id, build.lease_token, &value)
                .context("finalize owned build attempt")?;
            if finished && let Some(started) = current.started_at {
                queries
                    .fail_build_uploads(current.id, started, PublicationFailure::Expired, at)
                    .context("expire finalized build uploads")?;
            }
            Ok(())
        })
    }
}
