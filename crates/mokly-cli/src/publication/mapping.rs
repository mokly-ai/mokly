//! Pure mapping preserves cancellation, strict failures, and transaction recovery errors.

use mokly_publish::{error, runtime::Cancellation};

use crate::build::BuildError;
use crate::publication::error::{Error, Result};

/// Recheck delivered signals when a pre-build checkout step settles.
pub fn checkout_result<T>(result: error::Result<T>, cancellation: &dyn Cancellation) -> Result<T> {
    match (result, cancellation.is_cancelled()) {
        (Ok(_), true) => Err(Error::Exchange {
            source: error::Error::Cancelled,
        }),
        (Err(source), true) => Err(Error::Interrupted { source }),
        (Ok(value), false) => Ok(value),
        (Err(source), false) => Err(Error::Exchange { source }),
    }
}

/// Adapt a native build failure without inferring cancellation from a cleanup cause.
pub fn build_result<T>(result: std::result::Result<T, BuildError>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(failure) => Err(Error::Build {
            failure: Box::new(failure),
        }),
    }
}

#[cfg(test)]
#[path = "_tests_/mapping_tests.rs"]
mod mapping_tests;
