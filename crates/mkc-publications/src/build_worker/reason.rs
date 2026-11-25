//! Safe, log-ready reasons for attempts that settle as infrastructure failures.
//!
//! A reason holds only fixed error text, typed field names, exit codes and
//! stored outcome names. It never holds a credential, a request value or
//! provider response text.

use internal_error::InternalError;
use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_github_interface::error::Error as ProviderError;
use mkc_store_interface::build_state::UploadOutcome;

use crate::error::Error;

/// Reason for a runner outcome that `finish` maps to an infrastructure failure.
///
/// Returns `None` for every outcome that `finish` maps to another result.
pub(super) fn infrastructure_reason(
    outcome: &BuildOutcome,
    upload: Option<UploadOutcome>,
) -> Option<String> {
    match outcome {
        BuildOutcome::Completed => Some(format!(
            "runner completed without a publication; upload grant outcome: {}",
            upload.map_or("none", UploadOutcome::as_str)
        )),
        BuildOutcome::Infrastructure(error) => {
            Some(format!("runner infrastructure failure: {}", chain(error)))
        }
        BuildOutcome::StepFailed {
            step: BuildStep::Checkout,
            exit_code,
            ..
        } => Some(format!("checkout step failed {}", exit(*exit_code))),
        BuildOutcome::StepFailed {
            step: BuildStep::Publish,
            exit_code,
            cli_error,
        } => match (upload, cli_error) {
            (Some(grant @ (UploadOutcome::Unavailable | UploadOutcome::Accepted)), _) => {
                Some(format!(
                    "publish step failed {}; upload grant outcome: {}",
                    exit(*exit_code),
                    grant.as_str()
                ))
            }
            (None, Some(MoklyCliCode::UploadFailed)) => Some(format!(
                "publish step failed {}; Mokly CLI code: upload-failed",
                exit(*exit_code)
            )),
            _ => None,
        },
        BuildOutcome::StepFailed {
            step: BuildStep::Install,
            ..
        }
        | BuildOutcome::UnsupportedLockfile
        | BuildOutcome::UnsupportedMoklyVersion
        | BuildOutcome::TimedOut { .. }
        | BuildOutcome::OutputOverflow { .. } => None,
    }
}

/// Reason for a repository credential mint failure, without provider details.
///
/// Handled variants display fixed text. The internal variant's source chain
/// can hold provider transport or response text, so it is never included.
pub(super) fn mint_reason(error: &ProviderError) -> String {
    match error {
        ProviderError::Internal(_) => {
            "repository token mint failed: [mkc-github-interface/error] internal".to_owned()
        }
        handled => format!("repository token mint failed: {handled}"),
    }
}

/// Reason for an invalid build request, naming the field and never its value.
pub(super) fn request_reason(error: &Error) -> String {
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

#[cfg(test)]
#[path = "../_tests_/build_worker/reason_tests.rs"]
mod tests;
