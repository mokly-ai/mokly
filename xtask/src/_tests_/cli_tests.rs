//! CLI parsing regressions for suite and shard selection.

use clap::Parser;

use crate::check::VerificationSuite;

use super::{Cli, Command};

#[test]
fn parses_every_suite_and_a_valid_shard() {
    for suite in ["repository", "package", "unit", "browser"] {
        let cli =
            Cli::try_parse_from(["xtask", "check", "--suite", suite]).expect("known suite parses");
        let Command::Check {
            suite: parsed,
            shard,
        } = cli.command
        else {
            panic!("check command expected");
        };
        assert_eq!(parsed.map(VerificationSuite::as_str), Some(suite));
        assert!(shard.is_none());
    }

    let cli = Cli::try_parse_from(["xtask", "check", "--suite", "browser", "--shard", "3/4"])
        .expect("browser shard parses");
    let Command::Check { shard, .. } = cli.command else {
        panic!("check command expected");
    };
    assert_eq!(shard.expect("shard exists").to_string(), "3/4");
}

#[test]
fn rejects_unknown_suite_and_missing_or_invalid_shard_values() {
    for args in [
        vec!["xtask", "check", "--suite", "unknown"],
        vec!["xtask", "check", "--suite", "unit", "--shard"],
        vec!["xtask", "check", "--suite", "unit", "--shard", "0/4"],
        vec![
            "xtask",
            "check",
            "--suite",
            "unit",
            "--shard",
            "1/9007199254740992",
        ],
    ] {
        assert!(Cli::try_parse_from(args).is_err());
    }
}
