//! Operator recovery parsing does not require a pre-existing GitHub check.

use clap::Parser;

use crate::cli::Cli;

#[test]
fn maintenance_commands_need_no_serving_arguments() {
    assert!(Cli::try_parse_from(["mkc-api", "prune"]).is_ok());
    assert!(Cli::try_parse_from(["mkc-api", "prune-github"]).is_ok());
    assert!(Cli::try_parse_from(["mkc-api", "maintain-publications"]).is_ok());
    assert!(Cli::try_parse_from(["mkc-api", "prune", "--all"]).is_err());
    assert!(Cli::try_parse_from(["mkc-api", "prune-github", "--all"]).is_err());
    assert!(Cli::try_parse_from(["mkc-api", "maintain-publications", "--all"]).is_err());
}

#[test]
fn requeue_accepts_an_event_uuid_and_rejects_missing_or_malformed_ids() {
    assert!(
        Cli::try_parse_from([
            "mkc-api",
            "requeue-publication-check",
            "--event",
            "00000000-0000-0000-0000-000000000001"
        ])
        .is_ok()
    );
    assert!(Cli::try_parse_from(["mkc-api", "requeue-publication-check"]).is_err());
    assert!(
        Cli::try_parse_from(["mkc-api", "requeue-publication-check", "--event", "invalid"])
            .is_err()
    );
}

#[test]
fn billing_recovery_commands_parse_without_serving_configuration() {
    assert!(Cli::try_parse_from(["mkc-api", "billing-delivery-status"]).is_ok());
    assert!(
        Cli::try_parse_from([
            "mkc-api",
            "requeue-billing-delivery",
            "--event",
            "evt_fixture"
        ])
        .is_ok()
    );
    assert!(Cli::try_parse_from(["mkc-api", "requeue-billing-delivery"]).is_err());
}

#[test]
fn build_check_recovery_requires_a_build_uuid() {
    assert!(
        Cli::try_parse_from([
            "mkc-api",
            "requeue-build-check",
            "--build",
            "00000000-0000-0000-0000-000000000001"
        ])
        .is_ok()
    );
    assert!(Cli::try_parse_from(["mkc-api", "requeue-build-check"]).is_err());
    assert!(Cli::try_parse_from(["mkc-api", "requeue-build-check", "--build", "invalid"]).is_err());
}
