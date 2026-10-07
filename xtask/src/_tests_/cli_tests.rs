//! CLI parsing and validation for suite, shard, and dependency audit selection.

use std::path::PathBuf;
use std::sync::Arc;

use clap::Parser;
use unimock::{MockFn, Unimock, matching};

use crate::check::request::{CheckRequest, DependencyAudit, VerificationSuite};
use crate::check::runner::{CheckRunnerRunMock, CheckRunnerSourceFileLengthMock};
use crate::error::Error;
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
            dependency_audit,
        } = cli.command
        else {
            panic!("check command expected");
        };
        assert_eq!(parsed.map(VerificationSuite::as_str), Some(suite));
        assert!(shard.is_none());
        assert!(dependency_audit.is_none());
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
        CheckRunnerRunMock
            .next_call(
                matching!((request) if request == &CheckRequest::new(None, None, None).unwrap()),
            )
            .returns(Ok(())),
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
        dependency_audit: None,
    })
    .unwrap();
    app.run(Command::RustFileLengthLint { all: false }).unwrap();
}

#[test]
fn parses_dependency_audit_values_and_keeps_omission_optional() {
    for (value, expected) in [
        ("baseline", DependencyAudit::Baseline),
        ("strict", DependencyAudit::Strict),
    ] {
        let cli = Cli::try_parse_from(["xtask", "check", "--dependency-audit", value])
            .expect("known audit mode parses");
        assert!(matches!(
            cli.command,
            Command::Check { dependency_audit: Some(mode), .. } if mode == expected
        ));
    }
    let cli = Cli::try_parse_from(["xtask", "check"]).expect("default check parses");
    assert!(matches!(
        cli.command,
        Command::Check {
            dependency_audit: None,
            ..
        }
    ));
    for args in [
        vec!["xtask", "check", "--dependency-audit"],
        vec!["xtask", "check", "--dependency-audit", "unknown"],
    ] {
        assert!(Cli::try_parse_from(args).is_err());
    }
}

#[test]
fn application_dispatches_both_dependency_audit_modes() {
    for suite in [None, Some(VerificationSuite::Repository)] {
        for mode in [DependencyAudit::Baseline, DependencyAudit::Strict] {
            let expected = CheckRequest::new(suite, None, Some(mode)).unwrap();
            let app = Application {
                check_runner: Arc::new(Unimock::new(
                    CheckRunnerRunMock
                        .next_call(&|matching| {
                            matching.func(move |request, _| request == &expected);
                        })
                        .returns(Ok(())),
                )),
                rust_file_length_auditor: Arc::new(Unimock::new(())),
                workspace: PathBuf::from("/workspace"),
            };
            app.run(Command::Check {
                suite,
                shard: None,
                dependency_audit: Some(mode),
            })
            .expect("valid mode is forwarded");
        }
    }
}

#[test]
fn application_rejects_explicit_audit_modes_before_running_checks() {
    let app = Application {
        check_runner: Arc::new(Unimock::new(())),
        rust_file_length_auditor: Arc::new(Unimock::new(())),
        workspace: PathBuf::from("/workspace"),
    };
    for suite in [
        VerificationSuite::Package,
        VerificationSuite::Unit,
        VerificationSuite::Browser,
        VerificationSuite::Hydration,
    ] {
        for mode in ["baseline", "strict"] {
            let cli = Cli::try_parse_from([
                "xtask",
                "check",
                "--suite",
                suite.as_str(),
                "--dependency-audit",
                mode,
            ])
            .expect("mode and suite parse before validation");
            assert!(matches!(
                app.run(cli.command),
                Err(Error::UnsupportedDependencyAudit { suite: rejected }) if rejected == suite
            ));
        }
    }
}
