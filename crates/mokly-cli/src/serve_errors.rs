//! Typed Serve failures use user diagnostics and matching recovery guidance.

use mokly_model::error::ModelError;
use mokly_model::readers::ReadError;
use mokly_server::error::{InternalError, ServerError};

use crate::codes::Code;
use crate::output::Style;
use crate::redaction::Redactor;
use crate::{build_output, changes_diagnostics};

const METADATA_TOO_LARGE: &str = "Comparison data exceeds the 64 MiB limit.";

/// Format a server failure without library-specific error wrappers.
pub fn failure(style: &Style, error: &ServerError, redactor: &Redactor) -> String {
    let (code, message) = match error {
        ServerError::Render { source } => {
            return build_output::render_diagnostics(style, source, redactor);
        }
        ServerError::InvalidAssets => (
            Code::ViewerUnavailable,
            "The matching viewer assets are missing or invalid.".into(),
        ),
        ServerError::PreviewCapacity => (
            Code::BuildInvalid,
            "Temporary preview capacity is full. Try again shortly.".into(),
        ),
        ServerError::Deadline => (
            Code::BuildInvalid,
            "The temporary render exceeded its ten-second deadline.".into(),
        ),
        ServerError::PreviewResource => (
            Code::BuildInvalid,
            "A preview resource is no longer available. Retry the render.".into(),
        ),
        ServerError::Bind { port, source } => (
            Code::ServerFailed,
            format!("Could not listen on 127.0.0.1 starting at port {port}: {source}"),
        ),
        ServerError::ChangesUnavailable => (
            Code::BuildInvalid,
            "Changes evidence is not ready. Try again.".into(),
        ),
        ServerError::ChangesReplaced => (
            Code::BuildInvalid,
            "Comparison inputs were replaced. Try again.".into(),
        ),
        ServerError::ComparisonCapacity => (
            Code::BuildInvalid,
            "Comparison capacity is full. Try again shortly.".into(),
        ),
        ServerError::ComparisonMetadataTooLarge => (Code::BuildInvalid, METADATA_TOO_LARGE.into()),
        ServerError::Comparison { source } => (
            changes_diagnostics::failure_code(source),
            changes_diagnostics::failure_detail(source),
        ),
        ServerError::Internal(source) => (Code::ServerFailed, internal(source)),
    };
    style.error(code, &message, redactor)
}

fn internal(error: &InternalError) -> String {
    match error {
        InternalError::Provider { source } => source.to_string(),
        InternalError::Io { source } => source.to_string(),
        InternalError::Json { source } => source.to_string(),
        InternalError::Task { .. } => "A server worker did not finish. Restart Serve.".into(),
        InternalError::Model { source } => match source {
            ModelError::Schema(diagnostic) | ModelError::Props(diagnostic) => {
                diagnostic.to_string()
            }
            ModelError::Internal(source) => source.to_string(),
        },
        InternalError::Read { source } => match source {
            ReadError::Version {
                boundary,
                expected,
                received,
            } => format!("{boundary} requires schemaVersion {expected}; received {received:?}"),
            ReadError::Invalid { boundary, source } => format!("Invalid {boundary}: {source}"),
            ReadError::Contract { boundary, message } => format!("Invalid {boundary}: {message}"),
        },
    }
}

#[cfg(test)]
#[path = "_tests_/serve_errors_tests.rs"]
mod serve_errors_tests;

/// Retain the historical commit and authored diagnostics in a Changes status reason.
pub fn changes_reason(error: &ServerError) -> String {
    match error {
        ServerError::ComparisonMetadataTooLarge => METADATA_TOO_LARGE.into(),
        ServerError::Comparison { source } => changes_diagnostics::failure_detail(source),
        _ => error.to_string(),
    }
}
