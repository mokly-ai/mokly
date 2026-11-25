//! Safe reasons and the warning line for attempts that end as infrastructure.
//!
//! A reason holds only fixed error text, typed field names, exit codes, HTTP
//! status codes, step names and stored outcome names. It never holds a
//! credential, a request value or provider response text.

use internal_error::InternalError;
use mkc_domain::ids::BuildId;
use mkc_github_interface::error::Error as ProviderError;
use mkc_store_interface::build_state::{BuildStep, UploadOutcome};

use crate::error::Error;

/// Facts of one committed infrastructure retry or exhaustion.
#[derive(Debug, Eq, PartialEq)]
pub(super) struct InfrastructureWarning {
    pub(super) attempt: i32,
    pub(super) terminal: bool,
    pub(super) reason: String,
}

/// Write the one warning line for a committed infrastructure ending.
pub(super) fn log(build: BuildId, warning: &InfrastructureWarning) {
    tracing::warn!(
        build_id = %build,
        attempt = warning.attempt,
        terminal = warning.terminal,
        reason = %warning.reason,
        "build attempt ended as infrastructure"
    );
}

pub(super) fn completed(upload: Option<UploadOutcome>) -> String {
    format!(
        "runner completed without a publication; upload grant outcome: {}",
        upload.map_or("none", UploadOutcome::as_str)
    )
}

pub(super) fn runner(error: &InternalError) -> String {
    format!("runner infrastructure failure: {}", chain(error))
}

pub(super) fn checkout(exit_code: Option<i32>) -> String {
    format!("checkout step failed {}", exit(exit_code))
}

pub(super) fn publish_grant(exit_code: Option<i32>, grant: UploadOutcome) -> String {
    format!(
        "publish step failed {}; upload grant outcome: {}",
        exit(exit_code),
        grant.as_str()
    )
}

pub(super) fn publish_upload_failed(exit_code: Option<i32>) -> String {
    format!(
        "publish step failed {}; Mokly CLI code: upload-failed",
        exit(exit_code)
    )
}

/// Reason for lease recovery of an attempt that no worker finalized.
pub(super) fn lease_expired(step: Option<BuildStep>) -> String {
    match step {
        Some(step) => format!("attempt lease expired during the {} step", step.as_str()),
        None => "attempt lease expired before any step started".to_owned(),
    }
}

/// Reason for a repository credential mint failure, without provider details.
///
/// Every variant is named, so a new one needs its own choice of text. The
/// rate-limit delay comes from a response header and the internal source
/// chain can hold provider text, so neither is included.
pub(super) fn mint(error: &ProviderError) -> String {
    match error {
        ProviderError::InvalidRequest
        | ProviderError::Unauthorized
        | ProviderError::Forbidden
        | ProviderError::NotFound
        | ProviderError::InvalidCode
        | ProviderError::Unavailable
        | ProviderError::Http { .. } => format!("repository token mint failed: {error}"),
        ProviderError::RateLimited { .. } => {
            "repository token mint failed: [mkc-github-interface/error] rate limited".to_owned()
        }
        ProviderError::Internal(_) => {
            "repository token mint failed: [mkc-github-interface/error] internal".to_owned()
        }
    }
}

/// Reason for an invalid build request, naming the field and never its value.
pub(super) fn request(error: &Error) -> String {
    match error {
        Error::Internal(internal) => format!("build request invalid: {}", chain(internal)),
        handled => format!("build request invalid: {handled}"),
    }
}

fn exit(code: Option<i32>) -> String {
    match code {
        Some(code) => format!("with exit code {code}"),
        None => "without an exit code".to_owned(),
    }
}

fn chain(error: &InternalError) -> String {
    error
        .source_chain()
        .map(ToString::to_string)
        .collect::<Vec<_>>()
        .join(": ")
}
