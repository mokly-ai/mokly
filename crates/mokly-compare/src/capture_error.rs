//! Internal failures of process-memory comparison input encoding.

use std::io;

use mokly_graph::document_error::{self, CodecError};
use mokly_graph::error::{GraphError, InternalError};
use thiserror::Error;

pub(crate) type Result<T> = std::result::Result<T, CaptureError>;

#[derive(Debug, Error)]
pub(crate) enum CaptureError {
    #[error("[mokly-compare/capture] {0}")]
    Internal(#[from] CaptureInternalError),
}

#[derive(Debug, Error)]
pub(crate) enum CaptureInternalError {
    #[error("document codec failed: {source}")]
    Document { source: CodecError },
    #[error("input compression failed: {source}")]
    Io { source: io::Error },
}

pub(crate) trait CaptureResult<T> {
    fn capture(self) -> Result<T>;
}

impl<T> CaptureResult<T> for io::Result<T> {
    fn capture(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(CaptureInternalError::Io { source }.into()),
        }
    }
}

impl<T> CaptureResult<T> for document_error::Result<T> {
    fn capture(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(CaptureInternalError::Document { source }.into()),
        }
    }
}

pub(crate) fn graph<T>(result: Result<T>) -> mokly_graph::error::Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(GraphError::Internal(InternalError::Provider {
            source: Box::new(source),
        })),
    }
}
