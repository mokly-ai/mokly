//! One cancellation boundary before installation; cleanup failures are never reclassified.

use mokly_git::error;
use mokly_static::error::Error;

use crate::build::BuildError;
use crate::cancellation::Cancellation;

/// Drain delivered notifications before settling a configuration, Git, render, or stage step.
/// The caller invokes this only before capture/install and before transaction cleanup.
pub fn settle<T>(
    result: Result<T, BuildError>,
    cancellation: &dyn Cancellation,
) -> Result<T, BuildError> {
    cancellation.drain();
    if cancellation.requested() {
        return match result {
            Ok(_) => Err(BuildError::Cancelled),
            Err(error) if cancelled(&error) => Err(error),
            Err(source) => Err(BuildError::Interrupted {
                source: Box::new(source),
            }),
        };
    }
    match result {
        Err(BuildError::Git {
            source: error::Error::Cancelled,
            ..
        }) => Err(BuildError::Cancelled),
        result => result,
    }
}

/// Explicit cancellation classification survives an independent render shutdown failure.
/// Transaction cleanup and recovery always retain their own failure category.
pub fn cancelled(error: &BuildError) -> bool {
    match error {
        BuildError::Cancelled
        | BuildError::Interrupted { .. }
        | BuildError::Static {
            source: Error::Cancelled,
        }
        | BuildError::Git {
            source: error::Error::Cancelled,
            ..
        } => true,
        BuildError::Shutdown { primary, .. } => cancelled(primary),
        _ => false,
    }
}

#[cfg(test)]
#[path = "_tests_/pre_installation_tests.rs"]
mod pre_installation_tests;
