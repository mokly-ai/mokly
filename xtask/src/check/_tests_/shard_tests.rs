//! Shard parsing and the shard forwarding of the viewer and browser suites.

use std::str::FromStr;

use crate::error::Error;

use super::commands::commands_for;
use super::request::{CheckRequest, DependencyAudit, Shard, VerificationSuite};

#[test]
fn malformed_and_out_of_range_shards_fail() {
    for value in [
        "",
        "1",
        "1/",
        "/4",
        "0/4",
        "5/4",
        "1/0",
        "1/2/3",
        "1/9007199254740992",
        "9007199254740992/9007199254740992",
    ] {
        assert!(
            matches!(Shard::from_str(value), Err(Error::InvalidShard { shard }) if shard == value),
            "{value:?} should fail",
        );
    }
    assert!(Shard::from_str("1/9007199254740991").is_ok());
}

#[test]
fn shard_requires_a_supported_selected_suite() {
    let shard = Shard::from_str("1/4").expect("valid shard");
    assert!(matches!(
        CheckRequest::new(None, Some(shard), None),
        Err(Error::ShardRequiresSuite)
    ));
    assert!(matches!(
        CheckRequest::new(Some(VerificationSuite::Repository), Some(shard), None),
        Err(Error::UnsupportedShard { .. })
    ));
}

#[test]
fn browser_selection_builds_and_forwards_only_validated_shards() {
    let shard = Shard::from_str("2/4").expect("valid shard");
    CheckRequest::new(Some(VerificationSuite::Browser), Some(shard), None)
        .expect("browser supports shards");
    let commands = commands_for(
        VerificationSuite::Browser,
        Some(shard),
        DependencyAudit::Baseline,
    );
    assert_eq!(
        commands
            .iter()
            .map(|command| command.display())
            .collect::<Vec<_>>(),
        [
            "npm run build",
            "npm run test:browser:prepared -- --shard 2/4"
        ]
    );
}

#[test]
fn viewer_shards_forward_the_shard_and_type_check_only_on_shard_one() {
    for (shard, expected) in [
        (
            "1/2",
            vec![
                "npm run build",
                "npm run typecheck:ci",
                "npm run test:viewer:prepared -- --shard 1/2",
            ],
        ),
        (
            "2/2",
            vec![
                "npm run build",
                "npm run test:viewer:prepared -- --shard 2/2",
            ],
        ),
    ] {
        let shard = Shard::from_str(shard).expect("valid shard");
        CheckRequest::new(Some(VerificationSuite::Viewer), Some(shard), None)
            .expect("viewer supports shards");
        let commands = commands_for(
            VerificationSuite::Viewer,
            Some(shard),
            DependencyAudit::Baseline,
        );
        assert_eq!(
            commands
                .iter()
                .map(|command| command.display())
                .collect::<Vec<_>>(),
            expected,
            "{shard}"
        );
    }
}
