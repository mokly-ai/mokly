//! End-to-end binary exit statuses and stream contracts.

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

use mokly_cli::version::VERSION;
use serde_json::Value;

fn run(args: &[&str], mode: &str) -> Output {
    Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(args)
        .env("MOKLY_OUTPUT", mode)
        .env_remove("MOKLY_SIDECARS")
        .env_remove("MOKLY_ENDPOINT")
        .env_remove("MOKLY_TOKEN")
        .output()
        .unwrap()
}

#[test]
fn help_and_version_work_in_every_mode_and_subcommand() {
    for mode in ["plain", "rich"] {
        for command in [None, Some("serve"), Some("build"), Some("publish")] {
            let mut long = command.into_iter().collect::<Vec<_>>();
            long.push("--help");
            let mut short = command.into_iter().collect::<Vec<_>>();
            short.push("-h");
            let help = run(&long, mode);
            let alias = run(&short, mode);
            assert_eq!(help.status.code(), Some(0));
            assert_eq!(alias.status.code(), Some(0));
            assert_eq!(help.stdout, alias.stdout);
            assert!(help.stderr.is_empty());
            assert!(alias.stderr.is_empty());
            assert!(!help.stdout.contains(&0x1b));
            for flag in ["--version", "-v"] {
                let mut args = command.into_iter().collect::<Vec<_>>();
                args.push(flag);
                let output = run(&args, mode);
                assert_eq!(output.status.code(), Some(0));
                assert_eq!(output.stdout, format!("{}\n", VERSION).as_bytes());
                assert!(output.stderr.is_empty());
            }
        }
    }
}

#[test]
fn absent_subsystems_fail_with_exactly_one_line_and_no_stack() {
    for args in [vec![], vec!["serve"]] {
        let output = run(&args, "rich");
        assert_eq!(output.status.code(), Some(1));
        assert!(output.stdout.is_empty());
        let error = String::from_utf8(output.stderr).unwrap();
        assert_eq!(error.lines().count(), 1);
        assert!(error.contains("is not available in this build."));
        assert!(!error.contains("SECRET"));
    }
}

#[test]
fn invalid_commands_exit_one_and_do_not_echo_secrets() {
    let output = run(
        &["publish", "--token=secret/a==", "--unknown=secret/a=="],
        "plain",
    );
    assert_eq!(output.status.code(), Some(1));
    let error = String::from_utf8(output.stderr).unwrap();
    assert!(error.starts_with("[mokly/cli-invalid] "));
    assert!(!error.contains("secret/a=="));
    assert!(!error.contains("stack"));
    let output = run(&["serve", "--strict"], "plain");
    assert_eq!(
        String::from_utf8(output.stderr).unwrap(),
        "[mokly/cli-invalid] --strict belongs to build or publish\n"
    );
}

#[test]
fn version_uses_the_public_package_metadata_and_has_one_final_lf() {
    let package: Value = serde_json::from_str(
        &fs::read_to_string(
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly/package.json"),
        )
        .unwrap(),
    )
    .unwrap();
    let expected = format!("{}\n", package["version"].as_str().unwrap());
    for flag in ["--version", "-v"] {
        let output = run(&[flag], "rich");
        assert_eq!(output.status.code(), Some(0));
        assert_eq!(output.stdout, expected.as_bytes());
        assert!(output.stderr.is_empty());
    }
}
