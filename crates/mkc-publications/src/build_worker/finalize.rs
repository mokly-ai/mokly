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
use super::reason::infrastructure_reason;

pub(super) enum AttemptResult {
    Runner(BuildOutcome),
    RepositoryUnavailable,
    /// The attempt could not reach the runner; the safe reason says why.
    Infrastructure(String),
}

/// Infrastructure ending that this worker committed, for one warning log line.
struct Settled {
    reason: String,
    attempt: i32,
    terminal: bool,
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
            let (value, reason) = if current.publication_id.is_some() {
                (terminal(BuildState::Published, None, None, at), None)
            } else {
                match &result {
                    AttemptResult::Runner(outcome) => {
                        let grant = queries
                            .build_attempt_grant(build.id, current.attempt)
                            .context("read attempt upload outcome")?;
                        let upload = grant.and_then(|value| value.outcome);
                        (
                            finish(outcome, upload, current.attempt, at),
                            infrastructure_reason(outcome, upload),
                        )
                    }
                    AttemptResult::RepositoryUnavailable => (
                        terminal(
                            BuildState::Failed,
                            Some(BuildFailure::RepositoryUnavailable),
                            None,
                            at,
                        ),
                        None,
                    ),
                    AttemptResult::Infrastructure(reason) => {
                        (infrastructure(current.attempt, at), Some(reason.clone()))
                    }
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
            if finished && let Some(reason) = reason {
                settled = Some(Settled {
                    reason,
                    attempt: current.attempt,
                    terminal: value.state != BuildState::Queued,
                });
            }
            Ok(())
        })?;
        if let Some(settled) = settled {
            tracing::warn!(
                build_id = %build.id,
                attempt = settled.attempt,
                terminal = settled.terminal,
                reason = %settled.reason,
                "build attempt ended as infrastructure"
            );
        }
        Ok(())
    }
}
