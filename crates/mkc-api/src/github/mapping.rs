//! Translate handled provider outcomes at the API boundary.

use mkc_github_interface::error::Error;

use crate::error::ApiError;

impl From<Error> for ApiError {
    fn from(error: Error) -> Self {
        match error {
            Error::InvalidRequest => Self::ValidationFailed,
            Error::InvalidCode => Self::GITHUB_AUTH_INVALID,
            Error::Unauthorized => Self::Unavailable,
            Error::Forbidden => Self::PermissionDenied,
            Error::NotFound => Self::NotFound,
            Error::RateLimited { retry_after } => {
                Self::RateLimited(retry_after.min(i64::MAX as u64) as i64)
            }
            Error::Unavailable => Self::Unavailable,
            Error::Internal(source) => Self::Internal(source),
            error @ Error::Http { .. } => Self::internal(error),
        }
    }
}
