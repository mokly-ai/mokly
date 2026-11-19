//! Errors from the private in-process document encoding.

use std::io;
use std::result;

use thiserror::Error;

/// A document encoding or restoration result.
pub type Result<T> = result::Result<T, CodecError>;

/// An encoded document could not be written or restored.
#[derive(Debug, Error)]
pub enum CodecError {
    /// Internal serialization or compression failure.
    #[error("[mokly-graph/document-codec] {0}")]
    Internal(#[from] CodecInternalError),
}

/// Internal failures retain the original error type.
#[derive(Debug, Error)]
pub enum CodecInternalError {
    /// The flat tree records could not be serialized or decoded.
    #[error("document serialization failed: {source}")]
    Binary {
        /// Original serialization failure.
        source: postcard::Error,
    },
    /// The encoded tree length and restored stream differ.
    #[error("document tree length differs from its encoded bound")]
    InvalidLength,
    /// The compressed bytes could not be written or read.
    #[error("document compression failed: {source}")]
    Io {
        /// Original compression failure.
        source: io::Error,
    },
    /// A flat record asks for more children than the payload contains.
    #[error("document tree has an invalid child count")]
    InvalidTree,
}

/// Preserve typed compression and serialization failures.
pub(crate) trait CodecResult<T> {
    /// Convert a codec operation into its module error contract.
    fn codec(self) -> Result<T>;
}

impl<T> CodecResult<T> for postcard::Result<T> {
    fn codec(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(CodecInternalError::Binary { source }.into()),
        }
    }
}

impl<T> CodecResult<T> for io::Result<T> {
    fn codec(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(CodecInternalError::Io { source }.into()),
        }
    }
}
