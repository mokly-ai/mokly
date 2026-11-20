//! Error contract shared by object-store adapters.

use std::result;

use internal_error::InternalError;
use thiserror::Error;

/// Object-store failures; missing reads use `Option` instead of errors.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// Unhandled provider, filesystem or content-integrity failure.
    #[error("[mkc-file-store-interface/error] internal: {0:?}")]
    Internal(#[from] InternalError),
}

/// Object-store operation result.
pub type Result<T> = result::Result<T, Error>;

/// One operation consumed or started without any remaining storage budget.
#[derive(Debug, Error)]
#[error("[mkc-file-store-interface/error] storage operation deadline exceeded")]
pub struct OperationDeadlineExceeded;

/// Integrity violations that must never be exposed as catalogue bytes.
#[derive(Debug, Error)]
pub enum IntegrityError {
    /// A caller or stored object supplied different bytes for an identity.
    #[error("[mkc-file-store-interface/error] blob digest mismatch")]
    DigestMismatch,
    /// A backend returned more bytes than a valid upload file can contain.
    #[error("[mkc-file-store-interface/error] blob exceeds file ceiling")]
    TooLarge,
    /// Stored bytes or provider metadata disagree with the expected length.
    #[error("[mkc-file-store-interface/error] blob length mismatch")]
    LengthMismatch,
    /// A local store contains a symlink or an unexpected file kind.
    #[error("[mkc-file-store-interface/error] unsafe filesystem entry")]
    UnsafeEntry,
}
