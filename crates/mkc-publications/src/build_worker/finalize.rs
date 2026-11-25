//! Fenced finalization; a committed publication always wins over runner failure.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_build_interface::outcome::BuildOutcome;
use mkc_store_interface::build::Build;
use mkc_store_interface::build_state::{BuildFailure, BuildState};
use mkc_store_interface::publication::PublicationFailure;

use crate::error::{ErrorResultExt, Result};
use crate::transaction::Transactions;

use super::outcome::{Ending, finish, terminal};
use super::reason::InfrastructureWarning;

pub(super) enum AttemptResult {
    Runner(BuildOutcome),
    RepositoryUnavailable,
    /// The attempt could not reach the runner; the safe reason says why.
    Infrastructure(String),
}

pub(super) trait AttemptFinalizer: Send + Sync {
    /// Commit the attempt's ending; returns the warning of a committed infrastructure ending.
    fn finish(&self, build: &Build, result: AttemptResult)
    -> Result<Option<InfrastructureWarning>>;
}

pub(super) struct Finalizer {
    pub(super) transactions: Arc<dyn Transactions>,
    pub(super) runtime: Arc<dyn Runtime>,
}

impl AttemptFinalizer for Finalizer {
    fn finish(
        &self,
        build: &Build,
        result: AttemptResult,
    ) -> Result<Option<InfrastructureWarning>> {
        let at = self.runtime.now();
        let mut settled = None;
        self.transactions.run(false, &mut |queries| {
            settled = None;
            let Some(current) = queries
                .build(build.project_id, build.id)
                .context("read build finalization fence")?
            else {
                return Ok(());
            };
            if current.state != BuildState::Running || current.lease_token != build.lease_token {
                return Ok(());
            }
            let ending = if current.publication_id.is_some() {
                Ending::Settled(terminal(BuildState::Published, None, None, at))
            } else {
                match &result {
                    AttemptResult::Runner(outcome) => {
                        let grant = queries
                            .build_attempt_grant(build.id, current.attempt)
                            .context("read attempt upload outcome")?;
                        finish(outcome, grant.and_then(|value| value.outcome), at)
                    }
                    AttemptResult::RepositoryUnavailable => Ending::Settled(terminal(
                        BuildState::Failed,
                        Some(BuildFailure::RepositoryUnavailable),
                        None,
                        at,
                    )),
                    AttemptResult::Infrastructure(reason) => Ending::Infrastructure(reason.clone()),
                }
            };
            let (value, warning) = ending.resolve(current.attempt, at);
            let finished = queries
                .finish_build(current.id, build.lease_token, &value)
                .context("finalize owned build attempt")?;
            if finished && let Some(started) = current.started_at {
                queries
                    .fail_build_uploads(current.id, started, PublicationFailure::Expired, at)
                    .context("expire finalized build uploads")?;
            }
            if finished {
                settled = warning;
            }
            Ok(())
        })?;
        Ok(settled)
    }
}
