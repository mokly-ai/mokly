//! Fail-closed sidecar error categories.

use std::fmt::{self, Display, Formatter};
use std::io;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

use crate::diagnostics::DefinitionCode;
use crate::methods::Call;
use crate::postcss_failure::PostcssFailure;

/// Sidecar client operation result.
pub type Result<T> = std::result::Result<T, Error>;

/// Sidecar failures presented by the CLI as build-invalid.
#[derive(Debug, Error)]
pub enum Error {
    /// The consumer processor reported a catalogued configuration or plugin failure.
    #[error("[mokly-sidecar/postcss] {source}")]
    Postcss {
        /// Structured processor failure.
        source: PostcssFailure,
    },
    /// A request's process crashed on both attempts.
    #[error("[mokly-sidecar/{kind}] sidecar exited twice during {call}")]
    RequestCrashed {
        /// Request's own error category.
        kind: FailureKind,
        /// Complete source and view attribution.
        call: Box<Call>,
    },
    /// A generation was disposed or never bundled in this pool.
    #[error("[mokly-sidecar/bundle-failed] unknown generation {generation}")]
    UnknownGeneration {
        /// Requested immutable generation.
        generation: String,
    },
    /// Source bytes changed before a recycled process could reload them.
    #[error("[mokly-sidecar/bundle-failed] generation {generation} changed while reloading")]
    GenerationChanged {
        /// Expected immutable generation.
        generation: String,
    },
    /// The command cancelled its pending and queued sidecar work.
    #[error("[mokly-sidecar/cancelled] sidecar pool is shut down")]
    Cancelled,
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
    /// A request exceeded the deadline on both attempts.
    #[error("[mokly-sidecar/render-timeout] {call} exceeded {deadline_ms}ms")]
    RequestTimeout {
        /// Complete source and view attribution.
        call: Box<Call>,
        /// Applied deadline.
        deadline_ms: u64,
    },
    /// A single process exchange exceeded its deadline.
    #[error("[mokly-sidecar/render-timeout] request exceeded {deadline_ms}ms")]
    Timeout {
        /// Applied deadline.
        deadline_ms: u64,
    },
    /// The transport implementation failed.
    #[error("[mokly-sidecar/internal] {0}")]
    Internal(#[from] InternalError),
}

/// Error category retained after a sidecar crashes twice.
#[derive(Debug)]
pub enum FailureKind {
    /// Bundling, evaluation, or PostCSS request.
    Bundle,
    /// Component, screen, story, or page request.
    Render,
}

impl FailureKind {
    pub(crate) fn for_call(call: &Call) -> Self {
        match call {
            Call::Bundle(_)
            | Call::RestoreGeneration(_)
            | Call::Describe(_)
            | Call::ProcessCss(_)
            | Call::CssModules(_)
            | Call::Bindings(_)
            | Call::Dispose(_)
            | Call::DisposeContext(_) => Self::Bundle,
            _ => Self::Render,
        }
    }
}

impl Display for FailureKind {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Bundle => "bundle-failed",
            Self::Render => "render-failed",
        })
    }
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
    /// A process-group operation failed.
    #[error("process ownership failed: {source}")]
    Platform {
        /// Original platform error.
        source: mokly_platform::error::Error,
    },
    /// A pipe worker or pool state is no longer available.
    #[error("sidecar synchronization failed")]
    Synchronization,
}
