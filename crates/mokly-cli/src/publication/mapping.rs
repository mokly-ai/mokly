//! Pure mapping preserves cancellation, warning policy, and transaction recovery errors.

use crate::build::BuildError;
use crate::publication::error::{Error, Result};

/// Adapt a native build failure without inferring cancellation from a cleanup cause.
pub fn build_result<T>(result: std::result::Result<T, BuildError>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(BuildError::Warnings) => Err(Error::BuildWarnings),
        Err(failure) => Err(Error::Build {
            failure: Box::new(failure),
        }),
    }
}

#[cfg(test)]
#[path = "_tests_/mapping_tests.rs"]
mod mapping_tests;
