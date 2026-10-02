//! CLI parsing regressions for suite and shard selection.

use std::path::PathBuf;
use std::sync::Arc;

use clap::Parser;
use unimock::{MockFn, Unimock, matching};

use crate::check::{CheckRunnerRunMock, CheckRunnerSourceFileLengthMock, VerificationSuite};
use crate::rust_file_length::RustFileLengthAuditorRunMock;

use super::{Application, Cli, Command, Xtask};

#[test]
fn parses_every_suite_and_a_valid_shard() {
    for suite in ["repository", "package", "unit", "browser", "hydration"] {
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

#[test]
fn parses_source_file_length_lint_with_and_without_all() {
    for (arguments, expected) in [
        (vec!["xtask", "source-file-length-lint"], false),
        (vec!["xtask", "source-file-length-lint", "--all"], true),
    ] {
        let parsed = Cli::try_parse_from(arguments).expect("length command parses");
        assert!(matches!(parsed.command, Command::SourceFileLengthLint { all } if all == expected));
    }
}

#[test]
fn application_dispatches_source_length_and_complete_check() {
    let root = PathBuf::from("/workspace");
    let checks = Arc::new(Unimock::new((
        CheckRunnerSourceFileLengthMock
            .next_call(matching!((all) if *all))
            .returns(Ok(())),
        CheckRunnerRunMock.next_call(matching!((request) if request == &crate::check::CheckRequest::new(None, None).unwrap())).returns(Ok(())),
    )));
    let app = Application {
        check_runner: checks,
        rust_file_length_auditor: Arc::new(Unimock::new(
            RustFileLengthAuditorRunMock
                .next_call(matching!((workspace) if workspace.to_str() == Some("/workspace")))
                .returns(Ok(())),
        )),
        workspace: root,
    };
    app.run(Command::SourceFileLengthLint { all: true })
        .unwrap();
    app.run(Command::Check {
        suite: None,
        shard: None,
    })
    .unwrap();
    app.run(Command::RustFileLengthLint { all: false }).unwrap();
}
