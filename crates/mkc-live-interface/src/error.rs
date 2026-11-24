//! Errors shared by the live hub and relay adapters.

use std::result;

use internal_error::InternalError;
use thiserror::Error;

/// A live channel operation failed.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// The client sent more bytes than a frame can hold.
    #[error("[mkc-live] client frame exceeds the size limit: {bytes} bytes")]
    FrameTooLarge {
        /// The length of the frame in bytes.
        bytes: usize,
    },
    /// The hub has started shutdown.
    #[error("[mkc-live] hub has stopped")]
    HubStopped,
    /// The replica exhausted its connection identifiers.
    #[error("[mkc-live] connection identifiers exhausted")]
    ConnectionIdsExhausted,
    /// An internal hub or relay operation failed.
    #[error("[mkc-live] internal: {0:?}")]
    Internal(#[from] InternalError),
}

/// The result of a live channel operation.
pub type Result<T> = result::Result<T, Error>;
