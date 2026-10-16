//! Startup repeats discovery after new watch targets attach, before readiness.

use std::path::Path;
use std::sync::Arc;

use mokly_cli::build::BuildError;
use mokly_cli::grammar::Common;
use mokly_cli::serve::{PreparedServe, ServePreparation};
use mokly_server::error::{InternalError, Result, ServerError};

use crate::serve_warnings::AttemptWarnings;
use crate::serve_watch::WatchInputs;

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
            let mut prepared = match preparation.prepare(&cwd, &options) {
                Ok(prepared) => prepared,
                Err(error) => return Ok(Err(error)),
            };
            attempt.report(&prepared.summary.warnings, false);
            if let Some(watch) = watching {
                let mut candidate = watch.candidate(&prepared)?;
                if candidate.recheck {
                    prepared = match preparation.prepare(&cwd, &options) {
                        Ok(prepared) => prepared,
                        Err(error) => return Ok(Err(error)),
                    };
                    attempt.report(&prepared.summary.warnings, false);
                    watch.recheck(&mut candidate, &prepared)?;
                }
                watch.clone().adopt(candidate, &prepared);
            }
            Ok(Ok(prepared))
        })
    })
    .await
    {
        Ok(result) => result,
        Err(source) => Err(ServerError::Internal(InternalError::Task { source })),
    }
}
