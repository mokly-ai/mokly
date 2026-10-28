//! Startup prepares again before readiness when new watch roots reach unwatched directories.
//! Each preparation first records its start, so files that change while it reads replay.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_cli::build::{BuildError, BuildSummary};
use mokly_cli::grammar::Common;
use mokly_cli::serve::{PreparedServe, ServePreparation};
use mokly_server::error::{InternalError, Result, ServerError};

use crate::serve_warnings::AttemptWarnings;
use crate::serve_watch::WatchInputs;

/// Consume preparation so startup keeps only terminal metadata after publication.
pub(super) fn summary(prepared: PreparedServe) -> (String, BuildSummary) {
    (
        relative(&prepared.config.file, &prepared.config.repo_root),
        prepared.summary,
    )
}

pub(super) async fn initial(
    preparation: Arc<dyn ServePreparation>,
    watching: Option<Arc<dyn WatchInputs>>,
    attempt: Arc<dyn AttemptWarnings>,
    cwd: &Path,
    options: &Common,
) -> Result<std::result::Result<PreparedServe, BuildError>> {
    let cwd = cwd.to_owned();
    let options = options.clone();
    let parent = tracing::Span::current();
    match tokio::task::spawn_blocking(move || {
        parent.in_scope(|| {
            if let Some(watch) = &watching {
                watch.begin();
            }
            let mut prepared = match preparation.prepare(&cwd, &options) {
                Ok(prepared) => prepared,
                Err(error) => return Ok(Err(error)),
            };
            if let Some(watch) = watching {
                let mut candidate = match watch.candidate(&prepared) {
                    Ok(candidate) => candidate,
                    Err(error) => {
                        attempt.report(&prepared.summary.warnings, false);
                        return Err(error);
                    }
                };
                if candidate.recheck {
                    let first_warnings = prepared.summary.warnings.clone();
                    watch.begin();
                    prepared = match preparation.prepare(&cwd, &options) {
                        Ok(prepared) => prepared,
                        Err(error) => {
                            attempt.report(&first_warnings, false);
                            return Ok(Err(error));
                        }
                    };
                    if let Err(error) = watch.recheck(&mut candidate, &prepared) {
                        attempt.report(&first_warnings, false);
                        attempt.report(&prepared.summary.warnings, false);
                        return Err(error);
                    }
                }
                watch.clone().adopt(candidate, &prepared);
            }
            attempt.report(&prepared.summary.warnings, false);
            Ok(Ok(prepared))
        })
    })
    .await
    {
        Ok(result) => result,
        Err(source) => Err(ServerError::Internal(InternalError::Task { source })),
    }
}

#[cfg(test)]
#[path = "_tests_/preparation_warning_tests.rs"]
mod preparation_warning_tests;
