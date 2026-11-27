//! Safe warning reasons for every runner outcome that ends as infrastructure.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::error::{Error as BuildInterfaceError, RequestField};
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_store_interface::build_state::UploadOutcome;

use super::finish;
use super::reason::InfrastructureWarning;

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
    let at = "2026-11-25T00:00:00Z".parse().unwrap();
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
        let (_, warning) = finish(&outcome, upload, at).resolve(2, at);
        assert_eq!(
            warning,
            Some(InfrastructureWarning {
                attempt: 2,
                terminal: false,
                reason: reason.to_owned(),
            }),
            "{outcome:?}"
        );
    }
}
