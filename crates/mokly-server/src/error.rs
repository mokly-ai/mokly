//! Typed startup and internal delivery failures.

use std::io;

use mokly_graph::error::GraphError;
use mokly_model::error::ModelError;
use mokly_model::readers::ReadError;
use thiserror::Error;

/// Server operation result.
pub type Result<T> = std::result::Result<T, ServerError>;

/// Errors callers classify without inspecting text.
#[derive(Debug, Error)]
pub enum ServerError {
    /// No local port could be reserved.
    #[error("[mokly-server/bind] cannot bind 127.0.0.1 starting at port {port}: {source}")]
    Bind {
        /// Requested starting port.
        port: u16,
        /// Original socket error.
        source: io::Error,
    },
    /// A document render failed.
    #[error("[mokly-server/render] {source}")]
    Render {
        /// Original typed graph error.
        source: GraphError,
    },
    /// A temporary render passed its admission-to-completion deadline.
    #[error("[mokly-server/render] temporary render exceeded the ten-second deadline")]
    Deadline,
    /// A built viewer inventory or public state is invalid.
    #[error("[mokly-server/assets] viewer assets or catalogue state are invalid")]
    InvalidAssets,
    /// A previously reached preview resource no longer passes its live read check.
    #[error("[mokly-server/render] preview resource is unavailable")]
    PreviewResource,
    /// A temporary bundle exceeds the existing preview-store byte budget.
    #[error("[mokly-server/render] preview capacity is full")]
    PreviewCapacity,
    /// No accepted comparison can satisfy this selection.
    #[error("[mokly-server/changes] Changes evidence is not ready")]
    ChangesUnavailable,
    /// A source replacement fenced pending comparison work.
    #[error("[mokly-server/changes] comparison inputs were replaced")]
    ChangesReplaced,
    /// Retained comparisons fill their count or byte bound.
    #[error("[mokly-server/changes] comparison capacity is full")]
    ComparisonCapacity,
    /// The native comparison failed with its original diagnostic.
    #[error("[mokly-server/changes] {source}")]
    Comparison {
        /// Typed comparison failure.
        source: Box<mokly_compare::error::Error>,
    },
    /// Internal IO, task, and serialization failures.
    #[error("[mokly-server/internal] {0}")]
    Internal(#[from] InternalError),
}

/// Original source types retained across the internal boundary.
#[derive(Debug, Error)]
pub enum InternalError {
    /// An injected runtime provider failed.
    #[error("runtime provider failed: {source}")]
    Provider {
        /// Original typed provider error.
        source: Box<dyn std::error::Error + Send + Sync>,
    },
    /// Filesystem or socket operation failed.
    #[error("IO failed: {source}")]
    Io {
        /// Original failure.
        source: io::Error,
    },
    /// Model encoding failed.
    #[error("model encoding failed: {source}")]
    Model {
        /// Original failure.
        source: ModelError,
    },
    /// JSON decoding failed.
    #[error("JSON failed: {source}")]
    Json {
        /// Original failure.
        source: serde_json::Error,
    },
    /// A projected record is invalid.
    #[error("public state failed validation: {source}")]
    Read {
        /// Original failure.
        source: ReadError,
    },
    /// A worker did not finish normally.
    #[error("worker failed: {source}")]
    Task {
        /// Original failure.
        source: tokio::task::JoinError,
    },
}
