//! Every worker-mapped CLI code must occur in pinned public CLI evidence.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_store_interface::build_state::{BuildFailure, BuildState};
use serde::Deserialize;

use super::finish;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Fixture {
    mokly_version: String,
    scenarios: Vec<Scenario>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Scenario {
    scenario: String,
    code: String,
    exit_code: i32,
}

#[test]
fn pinned_cli_evidence_covers_every_worker_mapped_code_and_result() {
    let fixture: Fixture = serde_json::from_str(include_str!(
        "../../../../mkc-mokly-contract/fixtures/cli-errors.json"
    ))
    .unwrap();
    let package: serde_json::Value =
        serde_json::from_str(include_str!("../../../../../packages/mokly/package.json")).unwrap();
    assert_eq!(fixture.mokly_version, package["version"]);
    assert_eq!(fixture.scenarios.len(), 2);
    let at = "2026-10-12T00:00:00Z".parse().unwrap();
    for typed in [
        MoklyCliCode::GitUncommitted,
        MoklyCliCode::UploadFailed,
        MoklyCliCode::Unrecognized,
    ] {
        let (scenario, code, expected) = match typed {
            MoklyCliCode::GitUncommitted => (
                "uncommitted-file",
                "git-uncommitted",
                BuildFailure::UncommittedChanges,
            ),
            MoklyCliCode::UploadFailed => (
                "refused-upload",
                "upload-failed",
                BuildFailure::Infrastructure,
            ),
            MoklyCliCode::Unrecognized => continue,
        };
        let rows: Vec<_> = fixture
            .scenarios
            .iter()
            .filter(|row| row.scenario == scenario)
            .collect();
        assert_eq!(
            rows.len(),
            1,
            "missing or duplicate CLI scenario {scenario}"
        );
        let row = rows[0];
        assert_eq!(row.code, code);
        assert_ne!(row.exit_code, 0);
        assert_eq!(MoklyCliCode::parse(&row.code), typed);
        let result = finish(
            &BuildOutcome::StepFailed {
                step: BuildStep::Publish,
                exit_code: Some(row.exit_code),
                cli_error: Some(typed),
            },
            None,
            5,
            at,
        );
        assert_eq!(result.state, BuildState::Failed);
        assert_eq!(result.failure_cause, Some(expected));
        assert_eq!(
            result.exit_code,
            (typed != MoklyCliCode::UploadFailed).then_some(row.exit_code)
        );
    }
}
