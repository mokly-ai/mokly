//! Preserve static output diagnostics for the shared admission failures.

use mokly_model::output::error::AdmissionError;

use crate::error::{Error, Result};

pub(crate) trait AdmissionResult<T> {
    fn admit(self) -> Result<T>;
}

impl<T> AdmissionResult<T> for std::result::Result<T, AdmissionError> {
    fn admit(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(AdmissionError::Portable { path }) => Err(Error::Portable { path }),
            Err(AdmissionError::Collision { path, other }) => Err(Error::Collision { path, other }),
            Err(AdmissionError::TooLarge { path }) => Err(Error::TooLarge { path }),
        }
    }
}
