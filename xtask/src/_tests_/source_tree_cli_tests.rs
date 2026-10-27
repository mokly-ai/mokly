//! Argument parsing of `cargo xtask source-tree` before any Git or file read.

use clap::Parser;
use clap::error::ErrorKind;

use crate::source_tree::records::SourceFingerprint;

use super::{Cli, Command};

fn valid() -> String {
    format!("sha256:{}", "a".repeat(64))
}

#[test]
fn source_tree_arguments_accept_an_exact_fingerprint_and_optional_head_output() {
    let plain = Cli::try_parse_from(["xtask", "source-tree"]).unwrap();
    let Command::SourceTree { expect, print_head } = plain.command else {
        panic!("source-tree command expected");
    };
    assert_eq!(expect, None);
    assert!(!print_head);
    let probe = Cli::try_parse_from(["xtask", "source-tree", "--expect", &valid(), "--print-head"])
        .unwrap();
    let Command::SourceTree { expect, print_head } = probe.command else {
        panic!("source-tree command expected");
    };
    assert_eq!(expect, Some(SourceFingerprint::parse(&valid()).unwrap()));
    assert!(print_head);
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
fn source_tree_fingerprint_errors_use_only_the_source_tree_usage() {
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
