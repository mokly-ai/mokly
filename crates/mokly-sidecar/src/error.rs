//! Fail-closed sidecar error categories.

use std::io;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

use crate::diagnostics::DefinitionCode;

/// Sidecar client operation result.
pub type Result<T> = std::result::Result<T, Error>;

/// Sidecar failures presented by the CLI as build-invalid.
#[derive(Debug, Error)]
pub enum Error {
    /// Node or the sidecar entry could not start.
    #[error("[mokly-sidecar/sidecar-unavailable] {part} is unavailable")]
    Unavailable {
        /// Missing program or sidecar entry.
        part: String,
    },
    /// Hello reported another package version.
    #[error("[mokly-sidecar/sidecar-version] expected {expected}, received {actual}")]
    Version {
        /// Binary package version.
        expected: String,
        /// Sidecar package version.
        actual: String,
    },
    /// A malformed or unsupported frame was received.
    #[error("[mokly-sidecar/sidecar-protocol] {0}")]
    Protocol(ProtocolError),
    /// The process exited during a request.
    #[error("[mokly-sidecar/sidecar-crashed] sidecar exited during a request")]
    Crashed,
    /// A request failed in the sidecar.
    #[error("[mokly-sidecar/remote] {code}: {message}")]
    Remote {
        /// Typed remote category.
        code: RemoteCode,
        /// Diagnostic detail returned by the sidecar.
        message: String,
    },
    /// The request exceeded its retry deadline.
    #[error("[mokly-sidecar/render-timeout] request exceeded {deadline_ms}ms")]
    Timeout {
        /// Applied deadline.
        deadline_ms: u64,
    },
    /// The transport implementation failed.
    #[error("[mokly-sidecar/internal] {0}")]
    Internal(#[from] InternalError),
}

/// Malformed protocol reasons; each requires replacing the sidecar.
#[derive(Debug, Error)]
pub enum ProtocolError {
    /// A frame exceeds the byte limit.
    #[error("frame exceeds {limit} bytes")]
    Oversized {
        /// Maximum frame bytes excluding LF.
        limit: usize,
    },
    /// JSON, UTF-8, envelope or payload decoding failed.
    #[error("invalid JSON frame: {source}")]
    Json {
        /// Original parser error.
        source: serde_json::Error,
    },
    /// EOF occurred inside a frame.
    #[error("unterminated frame at end of stream")]
    Truncated,
    /// A malformed exchange or shutdown closed this session.
    #[error("session is closed; replace the sidecar")]
    SessionClosed,
    /// The first response was not the hello response.
    #[error("hello must complete before other traffic")]
    Handshake,
    /// A response did not match the outstanding request.
    #[error("response id {actual} does not match request id {expected}")]
    ResponseId {
        /// Outstanding request id.
        expected: u64,
        /// Received response id.
        actual: u64,
    },
}

/// Remote failure categories; authoring diagnostics retain their own code.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, Error, TS)]
#[serde(untagged)]
pub enum RemoteCode {
    /// Request execution or framing failure.
    #[error("{0}")]
    Request(RequestCode),
    /// Source-attributed authoring failure.
    #[error("{0}")]
    Definition(DefinitionCode),
}

impl RemoteCode {
    /// Whether a valid error reply leaves this session reusable.
    pub fn reusable(self) -> bool {
        !matches!(self, Self::Request(RequestCode::SidecarProtocol))
    }
}

/// Execution errors a Node sidecar may send; deadlines belong to the binary.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, Error, TS)]
#[serde(rename_all = "kebab-case")]
pub enum RequestCode {
    /// Bundling or module evaluation failed.
    #[error("bundle-failed")]
    BundleFailed,
    /// A render failed.
    #[error("render-failed")]
    RenderFailed,
    /// The peer rejected the protocol.
    #[error("sidecar-protocol")]
    SidecarProtocol,
}

/// Transport source failures.
#[derive(Debug, Error)]
pub enum InternalError {
    /// An I/O operation failed.
    #[error("transport I/O failed: {source}")]
    Io {
        /// Original error.
        source: io::Error,
    },
}
