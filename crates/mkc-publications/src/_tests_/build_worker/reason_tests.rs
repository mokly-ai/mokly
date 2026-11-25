//! Safe infrastructure reasons for every infrastructure ending and none for others.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::error::{Error as BuildInterfaceError, RequestField};
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use mkc_github_interface::error::Error as ProviderError;
use mkc_store_interface::build_state::UploadOutcome;

use crate::error::ErrorResultExt;

use super::{infrastructure_reason, mint_reason, request_reason};

#[derive(Debug, thiserror::Error)]
#[error("provider body ghs_secret_token")]
struct ProviderBody;

fn credential() -> BuildOutcome {
    BuildOutcome::Infrastructure(
        BuildInterfaceError::InvalidRequest {
            field: RequestField::Credential,
        }
        .into_internal(),
    )
}

fn step(step: BuildStep, exit_code: Option<i32>, cli_error: Option<MoklyCliCode>) -> BuildOutcome {
    BuildOutcome::StepFailed {
        step,
        exit_code,
        cli_error,
    }
}

#[test]
fn infrastructure_endings_name_their_safe_reason() {
    for (outcome, upload, reason) in [
        (
            credential(),
            None,
            "runner infrastructure failure: [mkc-build-interface/error] invalid request field: Credential",
        ),
        (
            BuildOutcome::Completed,
            None,
            "runner completed without a publication; upload grant outcome: none",
        ),
        (
            BuildOutcome::Completed,
            Some(UploadOutcome::Accepted),
            "runner completed without a publication; upload grant outcome: accepted",
        ),
        (
            step(BuildStep::Checkout, Some(128), None),
            None,
            "checkout step failed with exit code 128",
        ),
        (
            step(BuildStep::Checkout, None, None),
            None,
            "checkout step failed without an exit code",
        ),
        (
            step(BuildStep::Publish, Some(6), None),
            Some(UploadOutcome::Unavailable),
            "publish step failed with exit code 6; upload grant outcome: unavailable",
        ),
        (
            step(BuildStep::Publish, None, Some(MoklyCliCode::UploadFailed)),
            None,
            "publish step failed without an exit code; Mokly CLI code: upload-failed",
        ),
    ] {
        assert_eq!(
            infrastructure_reason(&outcome, upload).as_deref(),
            Some(reason),
            "{outcome:?}"
        );
    }
}

#[test]
fn other_endings_have_no_infrastructure_reason() {
    for (outcome, upload) in [
        (step(BuildStep::Install, Some(2), None), None),
        (
            step(
                BuildStep::Publish,
                Some(4),
                Some(MoklyCliCode::UploadFailed),
            ),
            Some(UploadOutcome::Rejected),
        ),
        (
            step(
                BuildStep::Publish,
                Some(3),
                Some(MoklyCliCode::GitUncommitted),
            ),
            None,
        ),
        (BuildOutcome::UnsupportedLockfile, None),
        (
            BuildOutcome::TimedOut {
                step: BuildStep::Install,
                budget: BuildBudget::Deadline,
            },
            None,
        ),
    ] {
        assert_eq!(infrastructure_reason(&outcome, upload), None, "{outcome:?}");
    }
}

#[test]
fn mint_reasons_keep_fixed_provider_text_and_drop_internal_sources() {
    for (error, reason) in [
        (
            ProviderError::Unavailable,
            "repository token mint failed: [mkc-github-interface/error] unavailable",
        ),
        (
            ProviderError::Http { status: 502 },
            "repository token mint failed: [mkc-github-interface/error] HTTP 502",
        ),
        (
            ProviderError::internal(ProviderBody),
            "repository token mint failed: [mkc-github-interface/error] internal",
        ),
    ] {
        assert_eq!(mint_reason(&error), reason);
    }
}

#[test]
fn request_reason_names_the_invalid_field() {
    let error = Err::<(), _>(BuildInterfaceError::InvalidRequest {
        field: RequestField::Branch,
    })
    .context("validate build branch")
    .unwrap_err();
    assert_eq!(
        request_reason(&error),
        "build request invalid: [mkc-build-interface/error] invalid request field: Branch"
    );
}
