//! Internal failures of process-memory comparison input encoding.

use std::io;

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
    #[error("input encoding failed: {source}")]
    Json { source: serde_json::Error },
    #[error("input decoding failed: {source}")]
    DecodeJson { source: serde_json::Error },
    #[error("input decompression failed: {source}")]
    DecodeIo { source: io::Error },
    #[error("input compression failed: {source}")]
    Io { source: io::Error },
    #[error("encoded tree has an invalid child count")]
    Tree,
}

pub(crate) trait CaptureResult<T> {
    fn capture(self) -> Result<T>;
}

impl<T> CaptureResult<T> for serde_json::Result<T> {
    fn capture(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(CaptureInternalError::Json { source }.into()),
        }
    }
}

impl<T> CaptureResult<T> for io::Result<T> {
    fn capture(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(CaptureInternalError::Io { source }.into()),
        }
    }
}

pub(crate) trait CaptureDecode<T> {
    fn decode(self) -> Result<T>;
}

impl<T> CaptureDecode<T> for serde_json::Result<T> {
    fn decode(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) if source.is_io() => Err(CaptureInternalError::DecodeIo {
                source: source.into(),
            }
            .into()),
            Err(source) => Err(CaptureInternalError::DecodeJson { source }.into()),
        }
    }
}

impl<T> CaptureDecode<T> for io::Result<T> {
    fn decode(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(CaptureInternalError::DecodeIo { source }.into()),
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
