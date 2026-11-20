//! Query failures independent of authentication, policy and HTTP transport.

use std::result;

use internal_error::InternalError;
use thiserror::Error;

/// Failures produced by persistence operations.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// A current or historical slug claim belongs to another subject.
    #[error("[mkc-store-interface/error] slug taken")]
    SlugTaken,
    /// Preserved database, pool or decoding failure.
    #[error("[mkc-store-interface/error] internal: {0:?}")]
    Internal(#[from] InternalError),
}

/// Query operation result.
pub type Result<T> = result::Result<T, Error>;
