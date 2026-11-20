//! Bounded transaction retries independent of database and sleeping implementations.

use std::time::Duration;

use diesel::result::{DatabaseErrorKind, Error as DieselError};
use mkc_store_interface::error::{Error, Result};

use crate::runtime::Runtime;

#[unimock::unimock(api = AttemptMock)]
pub(crate) trait Attempt {
    fn run(&mut self) -> Result<()>;
}

pub(crate) trait Retry {
    fn execute(&self, attempt: &mut dyn Attempt) -> Result<()>;
}

/// Eight attempts on serialization and uniqueness failures. The base delays
/// between attempts are 5, 10, 20, 40, 80, 160 and 250 ms, each plus uniform
/// jitter from zero through the delay; nonretryable errors return at once.
pub(crate) struct Backoff<'a> {
    pub(crate) runtime: &'a dyn Runtime,
}

impl Retry for Backoff<'_> {
    fn execute(&self, attempt: &mut dyn Attempt) -> Result<()> {
        for index in 0..8 {
            match attempt.run() {
                Ok(()) => return Ok(()),
                Err(error) if index == 7 || !retryable(&error) => return Err(error),
                Err(_) => {
                    let base = Duration::from_millis((5_u64 << index).min(250));
                    self.runtime.sleep(base + self.runtime.jitter(base)?);
                }
            }
        }
        Ok(())
    }
}

fn retryable(error: &Error) -> bool {
    let Error::Internal(error) = error else {
        return false;
    };
    error.source_chain().any(|source| {
        matches!(
            source.downcast_ref::<DieselError>(),
            Some(DieselError::DatabaseError(
                DatabaseErrorKind::SerializationFailure | DatabaseErrorKind::UniqueViolation,
                _
            ))
        )
    })
}

#[cfg(test)]
#[path = "_tests_/retry_tests.rs"]
mod tests;
