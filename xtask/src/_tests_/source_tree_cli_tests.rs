//! Argument parsing and dispatch of `cargo xtask source-tree`, before any Git
//! or file read.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use clap::Parser;
use clap::error::ErrorKind;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::source_tree;
use crate::source_tree::command::{SourceTreeCommandRunMock, SourceTreeRequest};
use crate::source_tree::records::SourceFingerprint;

use super::{Application, Cli, Command, Xtask};

fn valid() -> String {
    format!("sha256:{}", "a".repeat(64))
}

fn parsed(args: &[&str]) -> SourceTreeRequest {
    let mut argv = vec!["xtask", "source-tree"];
    argv.extend(args.iter().copied());
    let Command::SourceTree(request) = Cli::try_parse_from(&argv).unwrap().command else {
        panic!("source-tree command expected");
    };
    request
}

/// An application whose only live boundary is the source-tree command.
fn application(source_tree: Unimock) -> Application {
    let unused = || Arc::new(Unimock::new(()));
    Application {
        artifacts: Arc::new(Unimock::new(())),
        selector: unused(),
        check_runner: unused(),
        remote_runner: unused(),
        source_tree: Arc::new(source_tree),
        rust_file_length_auditor: unused(),
        environment: unused(),
        reporter: unused(),
        interrupt: unused(),
        workspace: PathBuf::from("/workspace"),
    }
}

#[test]
fn source_tree_arguments_accept_an_exact_fingerprint_and_optional_head_output() {
    assert_eq!(
        parsed(&[]),
        SourceTreeRequest {
            expected: None,
            print_head: false,
        }
    );
    assert_eq!(
        parsed(&["--expect", &valid(), "--print-head"]),
        SourceTreeRequest {
            expected: Some(SourceFingerprint::parse(&valid()).unwrap()),
            print_head: true,
        }
    );
}

#[test]
fn source_tree_arguments_reject_every_other_form() {
    let newline = format!("{}\n", valid());
    for args in [
        vec!["--expect"],
        vec!["--expect", "invalid"],
        vec!["--expect", &newline],
        vec!["--unknown"],
        vec!["--print-head", "--print-head"],
        vec!["--print-head", "true"],
        vec!["--expect", &valid(), "--expect", &valid()],
    ] {
        let mut argv = vec!["xtask", "source-tree"];
        argv.extend(args.iter().copied());
        assert!(Cli::try_parse_from(&argv).is_err(), "{args:?}");
    }
}

#[test]
fn source_tree_fingerprint_errors_use_only_the_source_tree_arguments() {
    for args in [vec!["--expect"], vec!["--expect", "invalid"]] {
        let mut argv = vec!["xtask", "source-tree"];
        argv.extend(args.iter().copied());
        let error = Cli::try_parse_from(&argv).unwrap_err();
        assert_ne!(error.kind(), ErrorKind::DisplayHelp);
        let rendered = error.render().to_string();
        assert!(rendered.contains("'--expect <FINGERPRINT>'"), "{rendered}");
        assert!(!rendered.contains("testbox-suite"), "{rendered}");
    }
    let rendered = Cli::try_parse_from(["xtask", "source-tree", "--expect", "invalid"])
        .unwrap_err()
        .render()
        .to_string();
    assert!(
        rendered.contains("expected fingerprint must match sha256:<64 lowercase hex digits>"),
        "{rendered}"
    );
}

#[test]
fn the_application_passes_the_workspace_and_the_parsed_request() {
    let expected = parsed(&["--expect", &valid(), "--print-head"]);
    let request = expected.clone();
    let app = application(Unimock::new(
        SourceTreeCommandRunMock
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(
                move |_, root: &Path, actual: &SourceTreeRequest| {
                    assert_eq!(root, Path::new("/workspace"));
                    assert_eq!(*actual, request);
                    Ok(())
                },
            )),
    ));
    app.run(Command::SourceTree(expected)).unwrap();
}

#[test]
fn a_fingerprint_failure_keeps_both_prefixes_and_both_values() {
    let actual = format!("sha256:{}", "b".repeat(64));
    let app = application(Unimock::new(
        SourceTreeCommandRunMock
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                Err(source_tree::error::Error::Mismatch {
                    expected: valid(),
                    actual: actual.clone(),
                })
            })),
    ));
    let error = app
        .run(Command::SourceTree(parsed(&["--expect", &valid()])))
        .unwrap_err();
    assert!(matches!(error, Error::SourceTree { .. }));
    assert_eq!(
        error.to_string(),
        format!(
            "[xtask/check] [xtask/source-tree] source-tree fingerprint does not match: expected {}; actual sha256:{}",
            valid(),
            "b".repeat(64)
        )
    );
}
